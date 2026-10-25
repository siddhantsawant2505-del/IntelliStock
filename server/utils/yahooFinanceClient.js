const yahooFinance = require('yahoo-finance2').default
const { createCache } = require('./cache')
const { AppError } = require('./http')

yahooFinance.suppressNotices(['yahooSurvey'])

const DEFAULT_OPTIONS = {
  timeout: 6000,
  maxRetries: 2,
  retryDelay: 750
}

// Quotes go stale quickly, charts and search results do not. Caching is what
// keeps the watchlist and search endpoints inside upstream rate limits.
const CACHE_TTL = {
  quote: 60 * 1000,
  chart: 5 * 60 * 1000,
  search: 10 * 60 * 1000,
  quoteSummary: 30 * 60 * 1000
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Only network hiccups are worth retrying; 429s and bad symbols are not. */
const isTransient = (error) => {
  const message = String(error?.message || '')
  return /timeout|timed out|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|network/i.test(message)
}

/**
 * Turns an upstream failure into an error the API can safely return. The raw
 * provider message (often a wall of HTML or "Too Many Requests") never reaches
 * a client.
 */
const toPublicError = (error, context) => {
  const message = String(error?.message || '')

  if (/too many requests|rate.?limit|\b429\b/i.test(message)) {
    return new AppError(503, 'Market data is being rate limited upstream. Please try again in a minute.')
  }
  if (/not found|no data found|delisted|invalid symbol|\b404\b/i.test(message)) {
    return new AppError(404, `No market data found for ${context}.`)
  }
  if (/<!doctype|<html|unexpected token|not valid json/i.test(message)) {
    return new AppError(502, 'The market data provider returned an unreadable response. Please try again.')
  }
  return new AppError(503, 'Market data is temporarily unavailable. Please try again shortly.')
}

const withTimeout = async (promise, ms, label) => {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

const createYahooFinanceClient = (options = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const cache = createCache({ ttlMs: 60 * 1000, maxEntries: 500 })

  const withRetry = async (fn, context) => {
    let lastError
    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      try {
        return await withTimeout(fn(), config.timeout, context)
      } catch (error) {
        lastError = error
        if (!isTransient(error) || attempt === config.maxRetries) break
        await delay(config.retryDelay * 2 ** attempt)
      }
    }
    console.warn(`${context} failed: ${lastError?.message}`)
    throw toPublicError(lastError, context)
  }

  const cachedCall = (cacheKey, ttl, fn, context) =>
    cache.wrap(cacheKey, () => withRetry(fn, context), ttl)

  return {
    quote: (symbol) => {
      const ticker = String(symbol).toUpperCase()
      return cachedCall(
        `quote:${ticker}`,
        CACHE_TTL.quote,
        () => yahooFinance.quote(ticker),
        ticker
      )
    },

    search: (query, options = {}) =>
      cachedCall(
        `search:${query}:${JSON.stringify(options)}`,
        CACHE_TTL.search,
        () => yahooFinance.search(query, options),
        `search "${query}"`
      ),

    chart: (symbol, options = {}) => {
      const ticker = String(symbol).toUpperCase()
      const queryOptions = {
        period1: options.period1 || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        period2: options.period2 || new Date(),
        interval: options.interval || '1d'
      }
      return cachedCall(
        `chart:${ticker}:${queryOptions.period1.toISOString()}:${queryOptions.interval}`,
        CACHE_TTL.chart,
        () => yahooFinance.chart(ticker, queryOptions),
        ticker
      )
    },

    quoteSummary: (symbol, options = {}) => {
      const ticker = String(symbol).toUpperCase()
      return cachedCall(
        `summary:${ticker}:${JSON.stringify(options)}`,
        CACHE_TTL.quoteSummary,
        () => yahooFinance.quoteSummary(ticker, options),
        ticker
      )
    },

    clearCache: () => cache.clear()
  }
}

module.exports = createYahooFinanceClient

const express = require('express')
const axios = require('axios')
const createYahooFinanceClient = require('../utils/yahooFinanceClient')
const User = require('../models/User')
const { auth } = require('../middleware/auth')
const { asyncHandler, AppError } = require('../utils/http')
const { parseSymbol, parseIntInRange, parsePagination } = require('../utils/validate')

const yahooFinance = createYahooFinanceClient()

const router = express.Router()

const POSITIVE_WORDS = [
  'surge', 'gain', 'rise', 'jump', 'beat', 'exceed', 'growth', 'profit',
  'success', 'record', 'high', 'boost', 'strong', 'positive', 'rally',
  'upgrade', 'outperform', 'bullish', 'expand', 'breakthrough'
]
const NEGATIVE_WORDS = [
  'fall', 'drop', 'decline', 'loss', 'miss', 'weak', 'concern', 'risk',
  'low', 'cut', 'negative', 'downgrade', 'bearish', 'challenge',
  'struggle', 'plunge', 'crash', 'slump', 'warning'
]

const analyzeSentiment = (title = '') => {
  const lowerTitle = title.toLowerCase()
  const positiveCount = POSITIVE_WORDS.filter((word) => lowerTitle.includes(word)).length
  const negativeCount = NEGATIVE_WORDS.filter((word) => lowerTitle.includes(word)).length

  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}

const toNewsItem = (article, symbols) => ({
  id: article.uuid || `${symbols[0]}-${article.providerPublishTime || article.title}`,
  title: article.title,
  summary: article.summary || article.title,
  impact: analyzeSentiment(article.title),
  stocks: symbols,
  timestamp: article.providerPublishTime
    ? new Date(article.providerPublishTime * 1000).toISOString()
    : new Date().toISOString(),
  source: article.publisher || 'Yahoo Finance',
  url: article.link
})

const fetchNewsForSymbol = async (symbol, newsCount = 10) => {
  const result = await yahooFinance.search(symbol, { newsCount })
  return (result?.news || [])
    .filter((article) => article && article.title && article.link)
    .map((article) => toNewsItem(article, [symbol]))
}

// NOTE: static paths must be registered before '/:symbol', otherwise Express
// matches "/search/..." as symbol="search" and the route never runs.
router.get('/search/:query', auth, asyncHandler(async (req, res) => {
  const query = String(req.params.query || '').trim()
  if (query.length < 1 || query.length > 40) {
    throw new AppError(400, 'Search query must be between 1 and 40 characters')
  }

  const searchResults = await yahooFinance.search(query)
  const matches = (searchResults?.quotes || [])
    .filter((result) => result.quoteType === 'EQUITY' && result.symbol)
    .slice(0, 10)

  if (matches.length === 0) {
    return res.json([])
  }

  const symbols = matches.map((result) => result.symbol)
  let quotes = []
  try {
    const quoteResult = await yahooFinance.quote(symbols)
    quotes = Array.isArray(quoteResult) ? quoteResult : [quoteResult]
  } catch (error) {
    console.warn('Batch quote for search failed:', error.message)
  }

  const priceBySymbol = new Map(
    quotes.filter(Boolean).map((quote) => [quote.symbol, quote.regularMarketPrice])
  )

  res.json(matches.map((result) => ({
    symbol: result.symbol,
    name: result.longname || result.shortname || result.symbol,
    price: priceBySymbol.get(result.symbol) ?? null,
    exchange: result.exchDisp || result.exchange || 'N/A'
  })))
}))

router.get('/news/watchlist', auth, asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 })

  const user = await User.findById(req.user._id).select('watchlist')
  const watchlist = user?.watchlist || []

  if (watchlist.length === 0) {
    return res.json({ news: [], hasMore: false, total: 0, page, totalPages: 0 })
  }

  const perSymbolNews = await Promise.all(
    watchlist.map(async (stock) => {
      try {
        return await fetchNewsForSymbol(stock.symbol, 10)
      } catch (error) {
        console.warn(`News lookup failed for ${stock.symbol}: ${error.message}`)
        return []
      }
    })
  )

  const newsById = new Map()
  perSymbolNews.flat().forEach((item) => {
    const existing = newsById.get(item.id)
    if (!existing) {
      newsById.set(item.id, item)
      return
    }
    item.stocks.forEach((symbol) => {
      if (!existing.stocks.includes(symbol)) existing.stocks.push(symbol)
    })
  })

  const allNews = [...newsById.values()]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const startIndex = (page - 1) * limit
  res.json({
    news: allNews.slice(startIndex, startIndex + limit),
    hasMore: startIndex + limit < allNews.length,
    total: allNews.length,
    page,
    totalPages: Math.ceil(allNews.length / limit)
  })
}))

router.get('/news/:symbol', auth, asyncHandler(async (req, res) => {
  const symbol = parseSymbol(req.params.symbol)
  const news = await fetchNewsForSymbol(symbol, 20)
  res.json(news)
}))

router.post('/predict', auth, asyncHandler(async (req, res) => {
  const symbol = parseSymbol(req.body?.symbol)
  const days = parseIntInRange(req.body?.days, {
    min: 1,
    max: 30,
    field: 'days',
    fallback: 1
  })

  const mlServerUrl = process.env.ML_SERVER_URL
  if (!mlServerUrl) {
    throw new AppError(503, 'Prediction service is not configured (ML_SERVER_URL is unset)')
  }

  let prediction
  try {
    const mlResponse = await axios.post(
      `${mlServerUrl.replace(/\/+$/, '')}/predict`,
      { symbol, days },
      { timeout: 15000 }
    )
    prediction = mlResponse.data
  } catch (error) {
    console.warn('ML server error:', error.message)
    throw new AppError(503, 'ML prediction service is currently unavailable. Please start the ML server and try again.')
  }

  if (!prediction || typeof prediction !== 'object') {
    throw new AppError(502, 'Prediction service returned an invalid response')
  }

  // $push avoids the read-modify-save race on the whole user document.
  await User.updateOne(
    { _id: req.user._id },
    {
      $push: {
        predictions: {
          symbol,
          prediction: prediction.recommendation,
          confidence: prediction.confidence,
          targetPrice: prediction.predictedPrice
        }
      }
    }
  )

  res.json(prediction)
}))

router.get('/:symbol/history', auth, asyncHandler(async (req, res) => {
  const symbol = parseSymbol(req.params.symbol)
  const periodMap = { '7d': 7, '1mo': 30, '3mo': 90, '1y': 365 }
  const period = String(req.query.period || '1mo')
  const days = periodMap[period]

  if (!days) {
    throw new AppError(400, `period must be one of: ${Object.keys(periodMap).join(', ')}`)
  }

  const chartData = await yahooFinance.chart(symbol, {
    period1: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    interval: '1d'
  })

  const quotes = chartData?.quotes || []
  if (quotes.length === 0) {
    throw new AppError(404, `No historical data available for ${symbol}`)
  }

  res.json(
    quotes
      .filter((item) => item.close !== null && item.close !== undefined)
      .map((item) => ({
        date: new Date(item.date * 1000).toISOString().split('T')[0],
        value: item.close,
        open: item.open,
        high: item.high,
        low: item.low,
        volume: item.volume
      }))
  )
}))

router.get('/:symbol', auth, asyncHandler(async (req, res) => {
  const symbol = parseSymbol(req.params.symbol)
  const quote = await yahooFinance.quote(symbol)

  if (!quote) {
    throw new AppError(404, `No quote available for ${symbol}`)
  }

  res.json({
    symbol: quote.symbol,
    name: quote.longName || quote.shortName || quote.symbol,
    currentPrice: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
    volume: quote.regularMarketVolume,
    marketCap: quote.marketCap,
    sector: quote.sector || 'N/A',
    high: quote.regularMarketDayHigh,
    low: quote.regularMarketDayLow,
    open: quote.regularMarketOpen,
    previousClose: quote.regularMarketPreviousClose
  })
}))

module.exports = router


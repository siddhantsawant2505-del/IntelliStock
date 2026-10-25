const { AppError } = require('./http')

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

/** Normalises and validates a ticker symbol. */
const parseSymbol = (raw) => {
  const symbol = String(raw || '').trim().toUpperCase()
  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new AppError(400, 'Invalid stock symbol')
  }
  return symbol
}

/** Parses an integer within an inclusive range. */
const parseIntInRange = (raw, { min, max, field = 'value', fallback }) => {
  if (raw === undefined || raw === null || raw === '') {
    if (fallback !== undefined) return fallback
    throw new AppError(400, `${field} is required`)
  }

  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError(400, `${field} must be an integer between ${min} and ${max}`)
  }
  return value
}

/** Parses page/limit query parameters with hard upper bounds. */
const parsePagination = (query = {}, { defaultLimit = 10, maxLimit = 50 } = {}) => {
  const page = parseIntInRange(query.page, { min: 1, max: 10000, field: 'page', fallback: 1 })
  const limit = parseIntInRange(query.limit, { min: 1, max: maxLimit, field: 'limit', fallback: defaultLimit })
  return { page, limit }
}

// Built without literal backslashes so the source stays easy to read/copy.
const BACKSLASH = String.fromCharCode(92)
const REGEX_SPECIALS = '.+*?^${}()|[]' + BACKSLASH

/** Escapes user input before it is used inside a regular expression. */
const escapeRegex = (value) =>
  String(value)
    .split('')
    .map((char) => (REGEX_SPECIALS.includes(char) ? BACKSLASH + char : char))
    .join('')

module.exports = { parseSymbol, parseIntInRange, parsePagination, escapeRegex, SYMBOL_PATTERN }

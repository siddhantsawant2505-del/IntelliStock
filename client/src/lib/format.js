/**
 * Presentation helpers shared across pages.
 *
 * These were previously re-implemented per page with slightly different
 * formats, which made the same timestamp render three different ways.
 */

const EMPTY = '\u2014'

/** `$1,234.56` — never `NaN` when the value is missing or unparsable. */
export const formatCurrency = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return EMPTY
  return `$${number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/** `12.5%` with a sign when requested. */
export const formatPercent = (value, { signed = false } = {}) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return EMPTY
  const prefix = signed && number > 0 ? '+' : ''
  return `${prefix}${number.toFixed(2)}%`
}

/** `Mar 4, 2026` for day-granularity fields like join dates. */
export const formatDate = (value) => {
  if (!value) return EMPTY
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? EMPTY : date.toLocaleDateString()
}

/** `Mar 4, 2:35 PM` for event logs where the time matters. */
export const formatDateTime = (value) => {
  if (!value) return EMPTY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Relative label for feed timestamps: `Just now`, `3h ago`, else the date. */
export const formatRelativeTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

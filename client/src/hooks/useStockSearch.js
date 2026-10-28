import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../lib/api'

/**
 * Debounced symbol search with a stale-response guard.
 *
 * Predictor and Watchlist each hand-rolled this: a 400 ms debounce plus a way
 * to drop a slow response that belongs to a query the user has already
 * replaced. Both now share this hook, which guards twice - with a cancelled
 * flag for unmounts and a query comparison for keystrokes that arrived while
 * the request was in flight.
 *
 * @param {object}  options
 * @param {number}  options.minChars  below this the query is cleared, not fetched
 * @param {number}  options.delay     debounce window in milliseconds
 * @param {string}  options.errorMessage toast text when the request fails
 */
export const useStockSearch = ({
  minChars = 2,
  delay = 400,
  errorMessage = 'Search failed'
} = {}) => {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const latestQuery = useRef('')

  useEffect(() => {
    const query = term.trim()
    // Set synchronously so a keystroke during flight invalidates the in-flight
    // response before the timeout below has even fired.
    latestQuery.current = query

    if (query.length < minChars) {
      setResults([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/stocks/search/${encodeURIComponent(query)}`)
        if (!cancelled && query === latestQuery.current) {
          setResults(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (!cancelled && query === latestQuery.current) {
          setResults([])
          toast.error(getErrorMessage(error, errorMessage))
        }
      } finally {
        if (!cancelled && query === latestQuery.current) setLoading(false)
      }
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, minChars, delay, errorMessage])

  const clear = useCallback(() => {
    latestQuery.current = ''
    setTerm('')
    setResults([])
    setLoading(false)
  }, [])

  return { term, setTerm, results, loading, clear }
}

export default useStockSearch

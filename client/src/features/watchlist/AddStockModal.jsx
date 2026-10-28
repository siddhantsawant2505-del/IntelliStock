import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useStockSearch } from '../../hooks/useStockSearch'
import api, { getErrorMessage } from '../../lib/api'
import toast from 'react-hot-toast'

/**
 * Modal for finding a symbol and adding it to the watchlist.
 *
 * Extracted from the Watchlist page, which owned the dialog, its debounced
 * search, its stale-response guard and its open/close keyboard handling all in
 * one 450-line component. Search state now lives here, so opening the dialog
 * resets it for free.
 *
 * @param {boolean}  open
 * @param {Function} onClose   dismiss the dialog
 * @param {Array}    watchlist current holdings, used to disable duplicates
 * @param {Function} onAdd     called with the chosen stock after a successful save
 */
const AddStockModal = ({ open, onClose, watchlist, onAdd }) => {
  const { term, setTerm, results, loading, clear } = useStockSearch({
    errorMessage: 'Search failed'
  })
  const [adding, setAdding] = useState('')

  // Escape dismisses the dialog. Re-run on `open` so the listener only exists
  // while the dialog is mounted.
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const addStock = async (stock) => {
    setAdding(stock.symbol)
    try {
      await api.post('/users/watchlist', { symbol: stock.symbol, name: stock.name })
      toast.success(`${stock.symbol} added to watchlist`)
      clear()
      onAdd(stock)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add stock'))
    } finally {
      setAdding('')
    }
  }

  const searchTerm = term.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-stock-title"
      onClick={onClose}
    >
      <div className="card w-full max-w-md" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 id="add-stock-title" className="text-lg font-semibold text-white">Add a stock</h3>
          <button
            onClick={onClose}
            aria-label="Close add stock dialog"
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            autoFocus
            type="text"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by symbol or company name"
            className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : searchTerm.length < 2 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              Type at least two characters to search.
            </p>
          ) : results.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No matching stocks found.</p>
          ) : (
            results.map((stock) => {
              const alreadyAdded = watchlist.some((entry) => entry.symbol === stock.symbol)
              return (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{stock.symbol}</div>
                    <div className="text-sm text-gray-400 truncate">{stock.name}</div>
                  </div>
                  <button
                    onClick={() => addStock(stock)}
                    disabled={alreadyAdded || adding === stock.symbol}
                    className="ml-3 px-3 py-1 rounded text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {alreadyAdded ? 'Added' : adding === stock.symbol ? 'Adding…' : 'Add'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default AddStockModal

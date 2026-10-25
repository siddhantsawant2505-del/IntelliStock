import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Star,
  TrendingUp,
  TrendingDown,
  Trash2,
  Plus,
  Search,
  BarChart3,
  X
} from 'lucide-react'
import api, { getErrorMessage } from '../lib/api'
import StockChart from '../components/Charts/StockChart'
import toast from 'react-hot-toast'

const Watchlist = () => {
  const [watchlist, setWatchlist] = useState([])
  const [selectedStock, setSelectedStock] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [adding, setAdding] = useState('')
  const navigate = useNavigate()

  const fetchWatchlist = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/users/watchlist')
      setWatchlist(data)
      setSelectedStock((current) => {
        if (current) {
          return data.find((stock) => stock.symbol === current.symbol) || data[0] || null
        }
        return data[0] || null
      })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load watchlist'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  // Debounced symbol search for the add dialog, with a guard so a slow earlier
  // response cannot overwrite results for a newer query.
  useEffect(() => {
    const term = searchTerm.trim()
    if (term.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return undefined
    }

    let cancelled = false
    setSearchLoading(true)

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/stocks/search/${encodeURIComponent(term)}`)
        if (!cancelled) setSearchResults(data)
      } catch (error) {
        if (!cancelled) {
          setSearchResults([])
          toast.error(getErrorMessage(error, 'Search failed'))
        }
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTerm])

  useEffect(() => {
    if (!showAddModal) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowAddModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showAddModal])

  const addStock = async (stock) => {
    setAdding(stock.symbol)
    try {
      await api.post('/users/watchlist', { symbol: stock.symbol, name: stock.name })
      toast.success(`${stock.symbol} added to watchlist`)
      setShowAddModal(false)
      setSearchTerm('')
      setSearchResults([])
      await fetchWatchlist()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add stock'))
    } finally {
      setAdding('')
    }
  }

  const removeFromWatchlist = async (symbol) => {
    try {
      await api.delete(`/users/watchlist/${symbol}`)
      setWatchlist((prev) => prev.filter((stock) => stock.symbol !== symbol))
      setSelectedStock((current) => {
        if (current?.symbol !== symbol) return current
        const remaining = watchlist.filter((stock) => stock.symbol !== symbol)
        return remaining[0] || null
      })
      toast.success('Stock removed from watchlist')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove stock'))
    }
  }

  const getPredictionColor = (prediction) => {
    switch (prediction) {
      case 'Buy':
        return 'text-green-400 bg-green-900/30'
      case 'Sell':
        return 'text-red-400 bg-red-900/30'
      default:
        return 'text-yellow-400 bg-yellow-900/30'
    }
  }

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'Positive':
        return 'text-green-400'
      case 'Negative':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Your Watchlist
              </h1>
              <p className="text-gray-400">
                Monitor your favorite stocks and AI predictions
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Add Stock</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="card">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                  </div>
                ) : watchlist.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No stocks in watchlist</h3>
                    <p className="text-gray-400 mb-6">Add stocks to your watchlist to track them here</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="btn-primary inline-flex items-center space-x-2"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Add Your First Stock</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-4 text-gray-400 font-medium">Stock</th>
                          <th className="text-right py-4 text-gray-400 font-medium">Price</th>
                          <th className="text-right py-4 text-gray-400 font-medium">Change</th>
                          <th className="text-center py-4 text-gray-400 font-medium">Prediction</th>
                          <th className="text-center py-4 text-gray-400 font-medium">Confidence</th>
                          <th className="text-center py-4 text-gray-400 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {watchlist.map((stock, index) => (
                          <motion.tr
                            key={stock.symbol}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`border-b border-gray-700 hover:bg-gray-800 transition-colors cursor-pointer ${
                              selectedStock?.symbol === stock.symbol ? 'bg-primary-900/20' : ''
                            }`}
                            onClick={() => setSelectedStock(stock)}
                          >
                            <td className="py-4">
                              <div className="flex items-center space-x-3">
                                <Star className="h-5 w-5 text-yellow-400 fill-current" />
                                <div>
                                  <div className="font-semibold text-white">{stock.symbol}</div>
                                  <div className="text-sm text-gray-400">{stock.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-right text-white font-medium">
                              {stock.unavailable ? <span className="text-gray-500">—</span> : `$${stock.price.toFixed(2)}`}
                            </td>
                            <td className="py-4 text-right">
                              {stock.unavailable ? (
                                <span className="text-gray-500">—</span>
                              ) : (
                                <div className={`${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  <div className="flex items-center justify-end space-x-1">
                                    {stock.change >= 0 ? (
                                      <TrendingUp className="h-4 w-4" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4" />
                                    )}
                                    <span>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}</span>
                                  </div>
                                  <div className="text-sm">
                                    ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPredictionColor(stock.prediction)}`}>
                                {stock.prediction}
                              </span>
                            </td>
                            <td className="py-4 text-center">
                              <div className="text-white font-medium">{stock.confidence}%</div>
                              <div className="w-16 bg-gray-600 rounded-full h-2 mx-auto mt-1">
                                <div
                                  className="bg-primary-500 h-2 rounded-full"
                                  style={{ width: `${stock.confidence}%` }}
                                ></div>
                              </div>
                            </td>
                            <td className="py-4 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFromWatchlist(stock.symbol)
                                }}
                                aria-label={`Remove ${stock.symbol} from watchlist`}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              {!loading && selectedStock && (
                <motion.div
                  key={selectedStock.symbol}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">{selectedStock.symbol}</h3>
                        <p className="text-gray-400">{selectedStock.name}</p>
                      </div>
                      <Star className="h-6 w-6 text-yellow-400 fill-current" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Price</span>
                        <span className="text-white font-semibold">
                          {selectedStock.unavailable ? '—' : `$${selectedStock.price.toFixed(2)}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Target Price</span>
                        <span className="text-primary-400 font-semibold">
                          {selectedStock.targetPrice > 0 ? `$${selectedStock.targetPrice.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sentiment</span>
                        <span className={`font-semibold ${getSentimentColor(selectedStock.sentiment)}`}>
                          {selectedStock.sentiment}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedStock.prediction !== 'N/A' && (
                    <div className="card">
                      <h4 className="text-lg font-semibold text-white mb-4">AI Prediction</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Recommendation</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPredictionColor(selectedStock.prediction)}`}>
                            {selectedStock.prediction}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Confidence</span>
                          <span className="text-white font-semibold">{selectedStock.confidence}%</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-3">
                          <div
                            className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${selectedStock.confidence}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="card">
                    <h4 className="text-lg font-semibold text-white mb-4">Quick Actions</h4>
                    <button
                      onClick={() => navigate('/predictor', { state: { symbol: selectedStock.symbol } })}
                      className="w-full btn-primary flex items-center justify-center space-x-2"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>Run AI Prediction</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {selectedStock?.data?.length > 0 && (
            <div className="card mt-10">
              <h4 className="text-lg font-semibold text-white mb-4">7-Day Trend for {selectedStock.symbol}</h4>
              <StockChart
                data={selectedStock.data}
                title=""
                color={selectedStock.change >= 0 ? '#10b981' : '#ef4444'}
                style={{ width: '100%' }}
              />
            </div>
          )}
        </motion.div>
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-stock-title"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card w-full max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="add-stock-title" className="text-lg font-semibold text-white">Add a stock</h3>
              <button
                onClick={() => setShowAddModal(false)}
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
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by symbol or company name"
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {searchLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : searchTerm.trim().length < 2 ? (
                <p className="text-gray-400 text-sm text-center py-6">
                  Type at least two characters to search.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No matching stocks found.</p>
              ) : (
                searchResults.map((stock) => {
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
      )}
    </div>
  )
}

export default Watchlist

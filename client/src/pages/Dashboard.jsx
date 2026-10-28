import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle
} from 'lucide-react'
import api, { getErrorMessage } from '../lib/api'
import StockChart from '../components/Charts/StockChart'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/format'

const Dashboard = () => {
  const { user } = useAuth()
  const [portfolioData, setPortfolioData] = useState([])
  const [watchlistData, setWatchlistData] = useState([])
  const [stats, setStats] = useState([])
  const [recentPredictions, setRecentPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [profileResponse, watchlistResponse] = await Promise.all([
        api.get('/users/profile'),
        api.get('/users/watchlist')
      ])

      const profile = profileResponse.data
      const watchlist = watchlistResponse.data || []

      const portfolioValue = watchlist.reduce((sum, stock) => sum + (stock.price || 0), 0)
      const dailyChange = watchlist.reduce((sum, stock) => sum + (stock.change || 0), 0)
      const previousValue = portfolioValue - dailyChange
      const changePercent = previousValue > 0 ? (dailyChange / previousValue) * 100 : 0

      // Sum the real per-symbol closes the API returns instead of inventing a
      // random walk. Dates present in some symbols but not others still total
      // correctly because each series is bucketed by date.
      const valueByDate = new Map()
      watchlist.forEach((stock) => {
        ;(stock.data || []).forEach((point) => {
          if (typeof point?.value !== 'number') return
          valueByDate.set(point.date, (valueByDate.get(point.date) || 0) + point.value)
        })
      })

      setPortfolioData(
        [...valueByDate.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
      )

      setWatchlistData(watchlist)

      const predictions = [...(profile.predictions || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      setRecentPredictions(
        predictions.slice(0, 4).map((p) => ({
          stock: p.symbol,
          prediction: p.prediction || 'Hold',
          confidence: Math.round(p.confidence || 0),
          target: formatCurrency(p.targetPrice)
        }))
      )

      setStats([
        {
          title: 'Watchlist Value',
          value: formatCurrency(portfolioValue),
          change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% today`,
          changeType: dailyChange >= 0 ? 'positive' : 'negative',
          icon: DollarSign
        },
        {
          title: "Today's Change",
          value: `${dailyChange >= 0 ? '+' : '-'}${formatCurrency(Math.abs(dailyChange))}`,
          change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% today`,
          changeType: dailyChange >= 0 ? 'positive' : 'negative',
          icon: TrendingUp
        },
        {
          title: 'Predictions Run',
          value: predictions.length.toString(),
          change: predictions.length > 0 ? 'all time' : 'none yet',
          changeType: predictions.length > 0 ? 'positive' : 'negative',
          icon: BarChart3
        },
        {
          title: 'Watchlist Items',
          value: watchlist.length.toString(),
          change: watchlist.length > 0 ? 'tracked' : 'empty',
          changeType: watchlist.length > 0 ? 'positive' : 'negative',
          icon: Star
        }
      ])
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your dashboard right now'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-gray-400">
              Here's your portfolio overview and market insights.
            </p>
          </div>

          {error && (
            <div className="card border border-red-500/40 bg-red-900/10 mb-8 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Dashboard unavailable</p>
                <p className="text-gray-400 text-sm mt-1">{error}</p>
                <button onClick={fetchDashboardData} className="btn-secondary mt-4 text-sm">
                  Try again
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="card hover:border-primary-500 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">{stat.title}</p>
                      <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                      <div className="flex items-center mt-2">
                        {stat.changeType === 'positive' ? (
                          <ArrowUpRight className="h-4 w-4 text-green-400 mr-1" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-400 mr-1" />
                        )}
                        <span className={`text-sm ${
                          stat.changeType === 'positive' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {stat.change}
                        </span>
                      </div>
                    </div>
                    <div className="text-primary-400">
                      <Icon className="h-8 w-8" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <StockChart
                data={portfolioData}
                title="Watchlist Performance (7 days)"
                color="#10b981"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="card"
            >
              <h3 className="text-lg font-semibold mb-4 text-white">Recent Predictions</h3>
              {recentPredictions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No predictions yet. Try the Stock Predictor!
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPredictions.map((item) => (
                    <div key={`${item.stock}-${item.target}-${item.confidence}`} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="font-semibold text-white">{item.stock}</div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          item.prediction.includes('Buy') ? 'bg-green-900 text-green-300' :
                          item.prediction.includes('Sell') ? 'bg-red-900 text-red-300' :
                          'bg-yellow-900 text-yellow-300'
                        }`}>
                          {item.prediction}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">{item.target}</div>
                        <div className="text-gray-400 text-sm">{item.confidence}% confidence</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="card"
          >
            <h3 className="text-lg font-semibold mb-4 text-white">Your Watchlist</h3>
            {watchlistData.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                Your watchlist is empty. Add stocks to track them here!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 text-gray-400 font-medium">Symbol</th>
                      <th className="text-left py-3 text-gray-400 font-medium">Name</th>
                      <th className="text-right py-3 text-gray-400 font-medium">Price</th>
                      <th className="text-right py-3 text-gray-400 font-medium">Change</th>
                      <th className="text-right py-3 text-gray-400 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistData.map((stock) => (
                      <tr key={stock.symbol} className="border-b border-gray-700 hover:bg-gray-800 transition-colors">
                        <td className="py-3 font-semibold text-white">{stock.symbol}</td>
                        <td className="py-3 text-gray-300">{stock.name}</td>
                        <td className="py-3 text-right text-white">
                          {stock.unavailable ? <span className="text-gray-500">unavailable</span> : formatCurrency(stock.price)}
                        </td>
                        <td className={`py-3 text-right ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.unavailable ? '—' : `${stock.change >= 0 ? '+' : ''}${(stock.change || 0).toFixed(2)}`}
                        </td>
                        <td className={`py-3 text-right ${stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.unavailable ? '—' : `${stock.changePercent >= 0 ? '+' : ''}${(stock.changePercent || 0).toFixed(2)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, UserCheck, BarChart3, TrendingUp, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import OverviewTab from '../features/admin/OverviewTab'
import UsersTab from '../features/admin/UsersTab'
import AnalyticsTab from '../features/admin/AnalyticsTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'User Management' },
  { key: 'analytics', label: 'Analytics' }
]

const Admin = () => {
  const [users, setUsers] = useState([])
  const [analytics, setAnalytics] = useState({})
  const [activity, setActivity] = useState([])
  const [selectedTab, setSelectedTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [statsResponse, usersResponse, analyticsResponse, activityResponse] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users', { params: { limit: 50 } }),
        api.get('/admin/analytics'),
        api.get('/admin/activity', { params: { limit: 10 } })
      ])

      setUsers(
        (usersResponse.data.users || []).map((user) => {
          const predictions = user.predictions || []
          const avgConfidence = predictions.length > 0
            ? Math.round(predictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictions.length)
            : null

          return {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            joinDate: formatDate(user.createdAt),
            lastLogin: formatDate(user.lastLogin),
            predictions: predictions.length,
            confidence: avgConfidence
          }
        })
      )

      setAnalytics({ ...statsResponse.data, ...analyticsResponse.data })
      setActivity(activityResponse.data || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load admin data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdminData()
  }, [fetchAdminData])

  const toggleUserStatus = async (userId) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return

    const newStatus = user.status === 'active' ? 'banned' : 'active'

    try {
      await api.put(`/admin/users/${userId}/status`, { status: newStatus })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)))
      toast.success(`User ${newStatus === 'active' ? 'reactivated' : 'suspended'}`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update user status'))
    }
  }

  const stats = [
    {
      title: 'Total Users',
      value: (analytics.totalUsers ?? 0).toLocaleString(),
      change: `${analytics.dailyActiveUsers ?? 0} active in the last 24h`,
      icon: Users,
      color: 'text-blue-400'
    },
    {
      title: 'Active Users',
      value: (analytics.activeUsers ?? 0).toLocaleString(),
      change: `${analytics.bannedUsers ?? 0} suspended`,
      icon: UserCheck,
      color: 'text-green-400'
    },
    {
      title: 'Total Predictions',
      value: (analytics.totalPredictions ?? 0).toLocaleString(),
      change: `${analytics.totalStocks ?? 0} saved stock records`,
      icon: BarChart3,
      color: 'text-purple-400'
    },
    {
      title: 'Avg. Model Confidence',
      value: `${analytics.averageConfidence ?? 0}%`,
      change: 'Self-reported by the ML service',
      icon: TrendingUp,
      color: 'text-yellow-400'
    }
  ]

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
              Admin Dashboard
            </h1>
            <p className="text-gray-400">
              Monitor platform activity and manage users
            </p>
          </div>

          {error && (
            <div className="card border border-red-500/40 bg-red-900/10 mb-8 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Could not load admin data</p>
                <p className="text-gray-400 text-sm mt-1">{error}</p>
                <button onClick={fetchAdminData} className="btn-secondary mt-4 text-sm">
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
                      <p className="text-gray-400 text-sm mt-1">{stat.change}</p>
                    </div>
                    <div className={stat.color}>
                      <Icon className="h-8 w-8" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="mb-8">
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedTab === tab.key
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {selectedTab === 'overview' && <OverviewTab analytics={analytics} />}
          {selectedTab === 'users' && (
            <UsersTab users={users} onToggleStatus={toggleUserStatus} />
          )}
          {selectedTab === 'analytics' && (
            <AnalyticsTab analytics={analytics} activity={activity} />
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Admin

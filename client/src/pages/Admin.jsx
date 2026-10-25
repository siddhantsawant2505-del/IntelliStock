import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  UserCheck,
  UserX,
  BarChart3,
  TrendingUp,
  Activity,
  AlertTriangle,
  AlertCircle
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api, { getErrorMessage } from '../lib/api'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'User Management' },
  { key: 'analytics', label: 'Analytics' }
]

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—')

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—'

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

          {selectedTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="card"
              >
                <h3 className="text-lg font-semibold mb-4 text-white">User Growth (7 days)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.userGrowth || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#f9fafb'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="card"
              >
                <h3 className="text-lg font-semibold mb-4 text-white">Prediction Confidence Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.predictionAccuracy || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(analytics.predictionAccuracy || []).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#f9fafb'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {(analytics.predictionAccuracy || []).map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-gray-300 text-sm">{item.name}</span>
                      </div>
                      <span className="text-white font-medium">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {selectedTab === 'users' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="card"
            >
              <h3 className="text-lg font-semibold mb-4 text-white">User Management</h3>
              {users.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No users found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 text-gray-400 font-medium">User</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Role</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Status</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Joined</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Last login</th>
                        <th className="text-right py-3 text-gray-400 font-medium">Predictions</th>
                        <th className="text-right py-3 text-gray-400 font-medium">Avg. confidence</th>
                        <th className="text-center py-3 text-gray-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-800 transition-colors">
                          <td className="py-3">
                            <div>
                              <div className="font-semibold text-white">{user.name}</div>
                              <div className="text-sm text-gray-400">{user.email}</div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === 'admin' ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-300'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              user.status === 'active'
                                ? 'bg-green-900 text-green-300'
                                : user.status === 'banned'
                                  ? 'bg-red-900 text-red-300'
                                  : 'bg-yellow-900 text-yellow-300'
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-300">{user.joinDate}</td>
                          <td className="py-3 text-gray-300">{user.lastLogin}</td>
                          <td className="py-3 text-right text-white">{user.predictions}</td>
                          <td className="py-3 text-right text-white">
                            {user.confidence === null ? '—' : `${user.confidence}%`}
                          </td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() => toggleUserStatus(user.id)}
                              aria-label={user.status === 'active' ? `Suspend ${user.email}` : `Reactivate ${user.email}`}
                              title={user.status === 'active' ? 'Suspend user' : 'Reactivate user'}
                              className={`p-2 rounded-lg transition-colors ${
                                user.status === 'active'
                                  ? 'text-red-400 hover:bg-red-900/20'
                                  : 'text-green-400 hover:bg-green-900/20'
                              }`}
                            >
                              {user.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {selectedTab === 'analytics' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card text-center">
                  <Activity className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Active in 24h</h3>
                  <p className="text-3xl font-bold text-blue-400">{analytics.dailyActiveUsers ?? 0}</p>
                  <p className="text-gray-400 text-sm mt-1">Users who logged in today</p>
                </div>

                <div className="card text-center">
                  <BarChart3 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Predictions (7d)</h3>
                  <p className="text-3xl font-bold text-green-400">
                    {(analytics.predictionVolume || []).reduce((sum, day) => sum + day.predictions, 0)}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">Requests recorded this week</p>
                </div>

                <div className="card text-center">
                  <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Suspended Accounts</h3>
                  <p className="text-3xl font-bold text-yellow-400">{analytics.bannedUsers ?? 0}</p>
                  <p className="text-gray-400 text-sm mt-1">Banned by an admin</p>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4 text-white">Recent Platform Activity</h3>
                {activity.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No activity recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {activity.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${
                          item.type === 'success' ? 'bg-green-400' :
                          item.type === 'warning' ? 'bg-yellow-400' :
                          'bg-blue-400'
                        }`}></div>
                        <div className="flex-1">
                          <div className="text-white text-sm">{item.event}</div>
                          <div className="text-gray-400 text-xs">{formatTime(item.time)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Admin

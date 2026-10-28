import { motion } from 'framer-motion'
import { BarChart3, Activity, AlertTriangle } from 'lucide-react'
import { formatDateTime } from '../../lib/format'

/**
 * Analytics tab: aggregate counters plus the recent-activity feed.
 * Split out of the Admin page to keep each tab independently readable.
 */
const AnalyticsTab = ({ analytics, activity }) => (
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
                <div className="text-gray-400 text-xs">{formatDateTime(item.time)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
)

export default AnalyticsTab

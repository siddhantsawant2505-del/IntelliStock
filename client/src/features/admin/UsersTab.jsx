import { motion } from 'framer-motion'
import { UserCheck, UserX } from 'lucide-react'

/**
 * User management tab: the user table with suspend/reactivate actions.
 * Split out of the Admin page so it renders independently of the charts.
 */
const UsersTab = ({ users, onToggleStatus }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="card"
  >
    <h3 className="text-lg font-semibold text-white mb-4">User Management</h3>
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
                    onClick={() => onToggleStatus(user.id)}
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
)

export default UsersTab

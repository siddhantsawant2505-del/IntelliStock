const express = require('express')
const mongoose = require('mongoose')
const User = require('../models/User')
const Stock = require('../models/Stock')
const { adminAuth, invalidateAuthUser } = require('../middleware/auth')
const { asyncHandler, AppError } = require('../utils/http')
const { parseIntInRange, escapeRegex } = require('../utils/validate')

const router = express.Router()

const USER_STATUSES = ['active', 'banned', 'pending']

const toObjectId = (value, field) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(400, `${field} is not a valid id`)
  }
  return value
}

const averageOf = (values) => {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const dayKey = (date) => new Date(date).toISOString().split('T')[0]

router.get('/stats', adminAuth, asyncHandler(async (req, res) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [totalUsers, activeUsers, bannedUsers, totalStocks, dailyActiveUsers, confidenceRows] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'banned' }),
      Stock.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: oneDayAgo } }),
      User.aggregate([
        { $unwind: '$predictions' },
        { $group: { _id: null, total: { $sum: 1 }, avgConfidence: { $avg: '$predictions.confidence' } } }
      ])
    ])

  const totalPredictions = confidenceRows[0]?.total || 0
  // This is the models' self-reported confidence, not measured accuracy.
  const averageConfidence = Math.round(confidenceRows[0]?.avgConfidence || 0)

  res.json({
    totalUsers,
    activeUsers,
    bannedUsers,
    totalStocks,
    totalPredictions,
    averageConfidence,
    dailyActiveUsers
  })
}))

router.get('/users', adminAuth, asyncHandler(async (req, res) => {
  const page = parseIntInRange(req.query.page, { min: 1, max: 10000, field: 'page', fallback: 1 })
  const limit = parseIntInRange(req.query.limit, { min: 1, max: 100, field: 'limit', fallback: 10 })
  const { status, search } = req.query

  const query = {}
  if (status) {
    if (!USER_STATUSES.includes(status)) {
      throw new AppError(400, `status must be one of: ${USER_STATUSES.join(', ')}`)
    }
    query.status = status
  }

  if (search) {
    const term = String(search).trim().slice(0, 60)
    if (term) {
      // Escaped so characters like "(" or ".*" cannot become a regex or a
      // catastrophic-backtracking pattern.
      const pattern = new RegExp(escapeRegex(term), 'i')
      query.$or = [{ name: pattern }, { email: pattern }]
    }
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ])

  res.json({
    users,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total
  })
}))

router.put('/users/:userId/status', adminAuth, asyncHandler(async (req, res) => {
  const userId = toObjectId(req.params.userId, 'userId')
  const { status } = req.body || {}

  if (!USER_STATUSES.includes(status)) {
    throw new AppError(400, `status must be one of: ${USER_STATUSES.join(', ')}`)
  }

  if (String(userId) === String(req.user._id) && status !== 'active') {
    throw new AppError(400, 'You cannot ban or deactivate your own admin account')
  }

  const user = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-password')
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  // Banning must take effect on the account's very next request, not when the
  // auth cache happens to expire.
  invalidateAuthUser(userId)

  res.json({ message: 'User status updated', user })
}))

router.delete('/users/:userId', adminAuth, asyncHandler(async (req, res) => {
  const userId = toObjectId(req.params.userId, 'userId')

  if (String(userId) === String(req.user._id)) {
    throw new AppError(400, 'You cannot delete your own admin account')
  }

  const user = await User.findByIdAndDelete(userId)
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  invalidateAuthUser(userId)

  res.json({ message: 'User deleted successfully' })
}))

router.get('/analytics', adminAuth, asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  since.setHours(0, 0, 0, 0)

  const [signups, predictions] = await Promise.all([
    User.find({ createdAt: { $gte: since } }).select('createdAt').lean(),
    User.aggregate([
      { $unwind: '$predictions' },
      { $match: { 'predictions.createdAt': { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$predictions.createdAt' } }, count: { $sum: 1 } } }
    ])
  ])

  const signUpsByDay = signups.reduce((map, user) => {
    const key = dayKey(user.createdAt)
    map[key] = (map[key] || 0) + 1
    return map
  }, {})

  const predictionsByDay = predictions.reduce((map, row) => {
    map[row._id] = row.count
    return map
  }, {})

  // A single pass over the last seven days, instead of re-summing all history
  // for every day (which was O(days * users)).
  const totalUsers = await User.countDocuments()
  const days = []
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push(date.toISOString().split('T')[0])
  }

  const signUpsInWindow = Object.values(signUpsByDay).reduce((sum, count) => sum + count, 0)
  let runningTotal = totalUsers - signUpsInWindow

  const userGrowth = days.map((date) => {
    runningTotal += signUpsByDay[date] || 0
    return { date, users: runningTotal, signups: signUpsByDay[date] || 0 }
  })

  const predictionVolume = days.map((date) => ({
    date,
    predictions: predictionsByDay[date] || 0
  }))

  const confidenceBuckets = [
    { name: 'Excellent (90%+)', test: (c) => c >= 90, color: '#10b981' },
    { name: 'Good (80-89%)', test: (c) => c >= 80 && c < 90, color: '#3b82f6' },
    { name: 'Average (70-79%)', test: (c) => c >= 70 && c < 80, color: '#f59e0b' },
    { name: 'Low (<70%)', test: (c) => c < 70, color: '#ef4444' }
  ]

  const allConfidences = (
    await User.aggregate([{ $unwind: '$predictions' }, { $group: { _id: null, values: { $push: '$predictions.confidence' } } }])
  )[0]?.values || []

  const total = allConfidences.length || 1
  const predictionAccuracy = confidenceBuckets.map((bucket) => ({
    name: bucket.name,
    value: Math.round((allConfidences.filter((c) => bucket.test(c || 0)).length / total) * 100),
    color: bucket.color
  }))

  res.json({
    userGrowth,
    predictionVolume,
    predictionAccuracy,
    averageConfidence: Math.round(averageOf(allConfidences.filter((c) => typeof c === 'number'))),
    totalPredictions: allConfidences.length
  })
}))

router.get('/activity', adminAuth, asyncHandler(async (req, res) => {
  const limit = parseIntInRange(req.query.limit, { min: 1, max: 50, field: 'limit', fallback: 10 })

  const [newUsers, recentPredictions, bannedUsers] = await Promise.all([
    User.find().select('name email createdAt status').sort({ createdAt: -1 }).limit(limit).lean(),
    User.aggregate([
      { $unwind: '$predictions' },
      { $sort: { 'predictions.createdAt': -1 } },
      { $limit: limit },
      { $project: { name: 1, email: 1, prediction: '$predictions' } }
    ]),
    User.find({ status: 'banned' }).select('name email updatedAt').sort({ updatedAt: -1 }).limit(5).lean()
  ])

  const activities = [
    ...newUsers.map((user) => ({
      id: `user-${user._id}`,
      time: user.createdAt,
      event: `New user registration: ${user.email}`,
      type: 'info'
    })),
    ...recentPredictions.map((row) => ({
      id: `prediction-${row._id}-${row.prediction.createdAt}`,
      time: row.prediction.createdAt,
      event: `${row.email || row.name || 'A user'} ran a prediction for ${row.prediction.symbol} (${row.prediction.confidence || 0}% confidence)`,
      type: 'success'
    })),
    ...bannedUsers.map((user) => ({
      id: `banned-${user._id}`,
      time: user.updatedAt,
      event: `Account suspended: ${user.email}`,
      type: 'warning'
    }))
  ]
    .filter((activity) => activity.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, limit)

  res.json(activities)
}))

module.exports = router

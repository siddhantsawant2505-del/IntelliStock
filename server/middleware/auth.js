const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { createCache } = require('../utils/cache')

/**
 * Auth runs on every request, and all it needs from the database is the answer
 * to "does this account still exist, and is it still allowed in?". Routes that
 * need the full document (watchlist, predictions) load it themselves, so this
 * lookup was a second, redundant round-trip on every authenticated call.
 *
 * Caching that answer for a few seconds removes one Mongo round-trip per
 * request. The cached value is always fetched with `-password`, and writes that
 * change a user's standing (ban, unban, delete, profile edit) invalidate the
 * entry immediately, so revocation never waits for the TTL. `AUTH_USER_CACHE_MS`
 * tunes the window; set it to 0 to disable caching entirely.
 */
const configuredCacheTtl = process.env.AUTH_USER_CACHE_MS
const parsedCacheTtl = configuredCacheTtl === undefined || configuredCacheTtl === ''
  ? 5000
  : Number(configuredCacheTtl)
const USER_CACHE_TTL_MS = Number.isFinite(parsedCacheTtl) ? Math.max(0, parsedCacheTtl) : 5000
const userCache = createCache({ ttlMs: USER_CACHE_TTL_MS, maxEntries: 2000 })

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

const findAuthUser = (userId) => {
  if (USER_CACHE_TTL_MS <= 0) {
    return User.findById(userId).select('-password').lean()
  }

  return userCache.wrap(`auth:${userId}`, async () => {
    const user = await User.findById(userId).select('-password').lean()
    // Misses are cached too, so a valid token for a deleted account cannot be
    // used to hammer the database.
    return user || null
  }, USER_CACHE_TTL_MS)
}

/** Drops a cached auth entry. Call after any write that changes the user. */
const invalidateAuthUser = (userId) => {
  if (userId) userCache.remove(`auth:${userId}`)
}

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await findAuthUser(decoded.userId)
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' })
    }

    if (user.status === 'banned') {
      return res.status(403).json({ message: 'Account has been banned' })
    }

    // Return a request-local copy so routes cannot poison the shared cache.
    // Copy nested user data too: a shallow freeze would still share mutable
    // watchlist/prediction objects with future requests.
    const requestUser = structuredClone({ ...user, _id: String(user._id) })
    req.user = deepFreeze(requestUser)
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token is not valid' })
    }
    console.error('Auth middleware error:', error)
    res.status(401).json({ message: 'Token is not valid' })
  }
}

const adminAuth = async (req, res, next) => {
  await auth(req, res, (error) => {
    if (error) return next(error)
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    next()
  })
}

module.exports = { auth, adminAuth, invalidateAuthUser }
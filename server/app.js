const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoose = require('mongoose')

const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const stockRoutes = require('./routes/stocks')
const adminRoutes = require('./routes/admin')
const { AppError } = require('./utils/http')

const DEFAULT_CLIENT_ORIGIN = 'http://localhost:3000'

// MongoDB treats a leading "$" in a value or a "." in a key as query syntax,
// so `{ email: { "$ne": null } }` would otherwise become a real query. Every
// route already coerces its inputs to strings, but rejecting the syntax here
// means a future route cannot reintroduce operator injection by accident.
const UNSAFE_KEY = /^\$/
const hasDot = (key) => key.includes('.')

const hasUnsafeKey = (value) => {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasUnsafeKey)
  return Object.entries(value).some(
    ([key, child]) => UNSAFE_KEY.test(key) || hasDot(key) || hasUnsafeKey(child)
  )
}

const rejectUnsafeKeys = (req, res, next) => {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query) || hasUnsafeKey(req.params)) {
    return res.status(400).json({ message: 'Request contains invalid parameter names' })
  }
  next()
}

const parseOrigins = (value) => {
  const origins = String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  // A blank or malformed CLIENT_ORIGIN must not silently deny every browser
  // origin; fall back to the local default rather than an empty allowlist.
  return origins.length > 0 ? origins : [DEFAULT_CLIENT_ORIGIN]
}

const createApp = () => {
  const app = express()
  const allowedOrigins = parseOrigins(process.env.CLIENT_ORIGIN)

  app.disable('x-powered-by')
  app.use(helmet({
    // This server only emits JSON, so no origin should ever be allowed to
    // load anything from it as a page, style or script.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
    // Nothing here is embeddable, so deny framing outright.
    frameguard: { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'same-site' }
  }))

  app.use(cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (curl, health checks, same-origin)
      // are allowed; browsers always send one for cross-origin calls.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new AppError(403, 'Origin not allowed by CORS policy'))
    },
    credentials: true
  }))

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // After the body parsers: the syntax this rejects only exists once JSON has
  // been parsed into objects.
  app.use(rejectUnsafeKeys)

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please slow down and try again shortly' }
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts, please try again later' }
  })

  app.use('/api', generalLimiter)
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)

  app.get('/api/health', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? 'ok' : 'degraded',
      database: dbConnected ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/stocks', stockRoutes)
  app.use('/api/admin', adminRoutes)

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
  })

  // Single place that decides what a client may see. Internal messages, stack
  // traces and driver errors never leave the server.
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err)
    }

    let status = err.statusCode || 500
    let message = err.message

    if (err.name === 'ValidationError') {
      status = 400
      message = Object.values(err.errors || {}).map((e) => e.message).join(', ') || 'Invalid input'
    } else if (err.name === 'CastError') {
      status = 400
      message = `Invalid value for ${err.path}`
    } else if (err.type === 'entity.parse.failed') {
      status = 400
      message = 'Request body is not valid JSON'
    } else if (err.code === 11000) {
      status = 409
      message = 'That record already exists'
    } else if (!(err instanceof AppError) && status >= 500) {
      message = 'Something went wrong on our end'
    }

    if (status >= 500) {
      console.error(err.stack || err)
    }

    res.status(status).json({ message })
  })

  return app
}

module.exports = { createApp, parseOrigins, hasUnsafeKey }

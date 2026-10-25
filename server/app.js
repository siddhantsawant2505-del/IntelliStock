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

const parseOrigins = (value) =>
  String(value || DEFAULT_CLIENT_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const createApp = () => {
  const app = express()
  const allowedOrigins = parseOrigins(process.env.CLIENT_ORIGIN)

  app.disable('x-powered-by')
  app.use(helmet())

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

module.exports = { createApp, parseOrigins }

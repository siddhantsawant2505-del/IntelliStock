require('dotenv').config()

const mongoose = require('mongoose')
const { createApp } = require('./app')

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET']

const missing = REQUIRED_ENV.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
    'Copy server/.env.example to server/.env and fill in the values.'
  )
  process.exit(1)
}

if (process.env.JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    // A short or guessable secret lets anyone mint a valid token for any user.
    console.error(
      'JWT_SECRET must be at least 32 characters long in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    )
    process.exit(1)
  }
  console.warn('Warning: JWT_SECRET should be at least 32 characters long for real deployments.')
}

const PORT = Number(process.env.PORT) || 5000

const start = async () => {
  mongoose.set('strictQuery', true)

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    })
    console.log('Connected to MongoDB')
  } catch (error) {
    // Serving API traffic without a database only produces confusing 500s.
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  }

  const app = createApp()
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  })

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT.`)
    } else {
      console.error('Server error:', error.message)
    }
    process.exit(1)
  })

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`)
    server.close(async () => {
      await mongoose.connection.close()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start()

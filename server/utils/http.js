/**
 * Error type that carries an HTTP status code so routes can throw and let the
 * central error middleware decide what the client is allowed to see.
 */
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = { AppError, asyncHandler }

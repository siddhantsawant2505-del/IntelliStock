const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { auth } = require('../middleware/auth')
const { asyncHandler, AppError } = require('../utils/http')

const router = express.Router()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const generateToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })

const requireText = (value, field, { min = 1, max = 200 } = {}) => {
  const text = String(value ?? '').trim()
  if (text.length < min || text.length > max) {
    throw new AppError(400, `${field} must be between ${min} and ${max} characters`)
  }
  return text
}

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status
})

router.post('/register', asyncHandler(async (req, res) => {
  const name = requireText(req.body?.name, 'Name', { min: 2, max: 50 })
  const email = requireText(req.body?.email, 'Email', { max: 120 }).toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(400, 'Please enter a valid email address')
  }
  // bcrypt only hashes the first 72 bytes, so longer passwords are misleading.
  if (password.length < 6 || password.length > 72) {
    throw new AppError(400, 'Password must be between 6 and 72 characters')
  }

  const existingUser = await User.findOne({ email })
  if (existingUser) {
    throw new AppError(409, 'An account with this email already exists')
  }

  const user = await User.create({ name, email, password })

  res.status(201).json({
    message: 'User created successfully',
    token: generateToken(user._id),
    user: publicUser(user)
  })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const email = requireText(req.body?.email, 'Email', { max: 120 }).toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    throw new AppError(400, 'Email and password are required')
  }

  const user = await User.findOne({ email })
  // Same message and status for unknown email and wrong password so the
  // endpoint cannot be used to enumerate registered accounts.
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(401, 'Invalid email or password')
  }

  if (user.status === 'banned') {
    throw new AppError(403, 'This account has been suspended')
  }

  user.lastLogin = new Date()
  await user.save()

  res.json({
    message: 'Login successful',
    token: generateToken(user._id),
    user: publicUser(user)
  })
}))

router.get('/me', auth, (req, res) => {
  res.json(req.user)
})

router.post('/logout', auth, (req, res) => {
  // JWTs are stateless; the client discards the token.
  res.json({ message: 'Logout successful' })
})

module.exports = router

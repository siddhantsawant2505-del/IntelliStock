const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const supabase = require('../config/supabase')
const { auth } = require('../middleware/auth')

const router = express.Router()

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' })
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' })
    }

    const salt = await bcrypt.genSalt(12)
    const hashedPassword = await bcrypt.hash(password, salt)

    const { data: user, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword }])
      .select()
      .single()

    if (error) throw error

    const token = generateToken(user.id)

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({
      message: 'Error creating user',
      error: error.message
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (!user || error) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    if (user.status === 'banned') {
      return res.status(403).json({ message: 'Account has been banned' })
    }

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)

    const token = generateToken(user.id)

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      message: 'Error logging in',
      error: error.message
    })
  }
})

router.get('/me', auth, async (req, res) => {
  try {
    res.json(req.user)
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({
      message: 'Error fetching user data',
      error: error.message
    })
  }
})

router.post('/logout', auth, async (req, res) => {
  try {
    res.json({ message: 'Logout successful' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      message: 'Error logging out',
      error: error.message
    })
  }
})

module.exports = router
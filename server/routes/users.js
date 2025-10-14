const express = require('express')
const supabase = require('../config/supabase')
const { auth } = require('../middleware/auth')

const router = express.Router()

router.get('/profile', auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, status, created_at')
      .eq('id', req.user.id)
      .single()

    if (error) throw error

    const { data: watchlist } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', req.user.id)

    const { data: predictions } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    res.json({ ...user, watchlist: watchlist || [], predictions: predictions || [] })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({
      message: 'Error fetching profile',
      error: error.message
    })
  }
})

router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body
    const updates = {}
    if (name) updates.name = name
    if (email) updates.email = email
    updates.updated_at = new Date().toISOString()

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single()

    if (error) throw error

    res.json({ message: 'Profile updated successfully', user })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({
      message: 'Error updating profile',
      error: error.message
    })
  }
})

router.post('/watchlist', auth, async (req, res) => {
  try {
    const { symbol, name } = req.body

    const { data: existing } = await supabase
      .from('watchlists')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('symbol', symbol)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ message: 'Stock already in watchlist' })
    }

    const { data, error } = await supabase
      .from('watchlists')
      .insert([{ user_id: req.user.id, symbol, name }])
      .select()

    if (error) throw error

    res.json({ message: 'Stock added to watchlist', watchlist: data })
  } catch (error) {
    console.error('Add to watchlist error:', error)
    res.status(500).json({
      message: 'Error adding to watchlist',
      error: error.message
    })
  }
})

router.delete('/watchlist/:symbol', auth, async (req, res) => {
  try {
    const { symbol } = req.params

    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', req.user.id)
      .eq('symbol', symbol)

    if (error) throw error

    res.json({ message: 'Stock removed from watchlist' })
  } catch (error) {
    console.error('Remove from watchlist error:', error)
    res.status(500).json({
      message: 'Error removing from watchlist',
      error: error.message
    })
  }
})

router.get('/watchlist', auth, async (req, res) => {
  try {
    const { data: watchlist, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(watchlist || [])
  } catch (error) {
    console.error('Get watchlist error:', error)
    res.status(500).json({
      message: 'Error fetching watchlist',
      error: error.message
    })
  }
})

router.get('/predictions', auth, async (req, res) => {
  try {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(predictions || [])
  } catch (error) {
    console.error('Get predictions error:', error)
    res.status(500).json({
      message: 'Error fetching predictions',
      error: error.message
    })
  }
})

module.exports = router
const express = require('express')
const createYahooFinanceClient = require('../utils/yahooFinanceClient')
const User = require('../models/User')
const { auth } = require('../middleware/auth')
const { asyncHandler, AppError } = require('../utils/http')
const { parseSymbol } = require('../utils/validate')

const yahooFinance = createYahooFinanceClient()

const router = express.Router()

const MAX_WATCHLIST_SIZE = 30
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const sentimentFromPrediction = (prediction) => {
  if (!prediction || prediction === 'N/A') return 'N/A'
  if (prediction === 'Buy') return 'Positive'
  if (prediction === 'Sell') return 'Negative'
  return 'Neutral'
}

router.get('/profile', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    throw new AppError(404, 'User not found')
  }
  res.json(user)
}))

router.put('/profile', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim()
    if (name.length < 2 || name.length > 50) {
      throw new AppError(400, 'Name must be between 2 and 50 characters')
    }
    user.name = name
  }

  if (req.body?.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email)) {
      throw new AppError(400, 'Please enter a valid email address')
    }
    if (email !== user.email) {
      const taken = await User.findOne({ email, _id: { $ne: user._id } })
      if (taken) {
        throw new AppError(409, 'That email is already in use')
      }
    }
    user.email = email
  }

  await user.save()
  res.json({ message: 'Profile updated successfully', user })
}))

router.post('/watchlist', auth, asyncHandler(async (req, res) => {
  const symbol = parseSymbol(req.body?.symbol)

  const user = await User.findById(req.user._id)
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  const alreadyTracked = user.watchlist.some((stock) => stock.symbol === symbol)
  if (alreadyTracked) {
    throw new AppError(409, `${symbol} is already in your watchlist`)
  }

  if (user.watchlist.length >= MAX_WATCHLIST_SIZE) {
    throw new AppError(400, `Watchlists are limited to ${MAX_WATCHLIST_SIZE} symbols`)
  }

  // Confirm the ticker actually exists before storing it, otherwise typos sit
  // in the watchlist forever and every refresh pays for a failed upstream call.
  let quote
  try {
    quote = await yahooFinance.quote(symbol)
  } catch (error) {
    // A provider outage is not the same as a bad ticker: only report "not
    // found" when the provider actually said the symbol does not exist.
    if (error instanceof AppError && error.statusCode !== 404) throw error
    throw new AppError(404, `No stock found for symbol ${symbol}`)
  }
  if (!quote) {
    throw new AppError(404, `No stock found for symbol ${symbol}`)
  }

  const name = String(req.body?.name || '').trim() ||
    quote.longName || quote.shortName || symbol

  user.watchlist.push({ symbol, name })
  await user.save()

  res.status(201).json({ message: 'Stock added to watchlist', watchlist: user.watchlist })
}))

router.delete('/watchlist/:symbol', auth, asyncHandler(async (req, res) => {
  const symbol = parseSymbol(req.params.symbol)

  const user = await User.findById(req.user._id)
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  const before = user.watchlist.length
  user.watchlist = user.watchlist.filter((stock) => stock.symbol !== symbol)

  if (user.watchlist.length === before) {
    throw new AppError(404, `${symbol} is not in your watchlist`)
  }

  await user.save()
  res.json({ message: 'Stock removed from watchlist', watchlist: user.watchlist })
}))

router.get('/watchlist', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  if (user.watchlist.length === 0) {
    return res.json([])
  }

  const latestPredictionFor = (symbol) =>
    user.predictions
      .filter((prediction) => prediction.symbol === symbol)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]

  const enrichedWatchlist = await Promise.all(
    user.watchlist.map(async (stock) => {
      const prediction = latestPredictionFor(stock.symbol)
      const base = {
        symbol: stock.symbol,
        name: stock.name,
        price: 0,
        change: 0,
        changePercent: 0,
        prediction: prediction?.prediction || 'N/A',
        confidence: prediction?.confidence || 0,
        targetPrice: prediction?.targetPrice || 0,
        sentiment: sentimentFromPrediction(prediction?.prediction),
        data: [],
        addedAt: stock.addedAt,
        unavailable: true
      }

      try {
        const quote = await yahooFinance.quote(stock.symbol)
        if (!quote) return base

        let historicalData = []
        try {
          const chartData = await yahooFinance.chart(stock.symbol, {
            period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            interval: '1d'
          })
          historicalData = (chartData?.quotes || [])
            .filter((item) => item.close !== null && item.close !== undefined)
            .map((item) => ({
              date: new Date(item.date * 1000).toISOString().split('T')[0],
              value: item.close
            }))
        } catch (error) {
          console.warn(`Chart lookup failed for ${stock.symbol}: ${error.message}`)
        }

        return {
          ...base,
          unavailable: false,
          name: stock.name || quote.longName || quote.shortName || stock.symbol,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          data: historicalData
        }
      } catch (error) {
        console.warn(`Quote lookup failed for ${stock.symbol}: ${error.message}`)
        return base
      }
    })
  )

  res.json(enrichedWatchlist)
}))

router.get('/predictions', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  res.json(
    [...user.predictions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
  )
}))

module.exports = router

/**
 * Seeds the demo accounts documented in the README.
 *
 * Idempotent: running it twice does not duplicate users or duplicate
 * watchlist entries. Safe to run against a development database only.
 */
require('dotenv').config()

const mongoose = require('mongoose')
const User = require('../models/User')

const DEMO_USERS = [
  {
    name: 'Admin User',
    email: 'admin@intellistock.com',
    password: 'password123',
    role: 'admin',
    watchlist: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' }
    ]
  },
  {
    name: 'Demo User',
    email: 'user@example.com',
    password: 'password123',
    role: 'user',
    watchlist: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' }
    ]
  }
]

const seed = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Copy server/.env.example to server/.env first.')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })

  for (const demo of DEMO_USERS) {
    const existing = await User.findOne({ email: demo.email })

    if (existing) {
      existing.role = demo.role
      existing.status = 'active'
      for (const stock of demo.watchlist) {
        if (!existing.watchlist.some((entry) => entry.symbol === stock.symbol)) {
          existing.watchlist.push(stock)
        }
      }
      await existing.save()
      console.log(`Updated demo account: ${demo.email} (${demo.role})`)
      continue
    }

    await User.create(demo)
    console.log(`Created demo account: ${demo.email} (${demo.role})`)
  }

  console.log('\nSeed complete. Sign in with password123 for either account.')
  await mongoose.connection.close()
}

seed().catch(async (error) => {
  console.error('Seed failed:', error.message)
  await mongoose.connection.close().catch(() => {})
  process.exit(1)
})

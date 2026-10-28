const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')

// Environment must be in place before the app is built: createApp() reads the
// CORS allowlist when it runs, and token helpers read JWT_SECRET on use.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'api-test-secret-api-test-secret-0123456789'
process.env.CLIENT_ORIGIN = 'http://localhost:3000'

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/intellistock_test'
const ALLOWED_ORIGIN = 'http://localhost:3000'
const TEST_RUN_ID = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const TEST_ADMIN_EMAIL = `admin-${TEST_RUN_ID}@test.dev`
const TEST_USER_EMAIL = `user-${TEST_RUN_ID}@test.dev`

const { createApp } = require('../app')
const User = require('../models/User')

let server
let baseUrl
let adminToken
let userToken
let userId

const request = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body === undefined ? undefined : body
  })

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return { status: response.status, headers: response.headers, data }
}

const login = async (email, password) => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
  assert.equal(response.status, 200, `login failed: ${JSON.stringify(response.data)}`)
  return response.data.token
}

test.before(async () => {
  await mongoose.connect(TEST_MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  await User.create({ name: 'Admin User', email: TEST_ADMIN_EMAIL, password: 'password123', role: 'admin' })
  const regular = await User.create({ name: 'Regular User', email: TEST_USER_EMAIL, password: 'password123' })
  userId = String(regular._id)

  const app = createApp()
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`

  adminToken = await login(TEST_ADMIN_EMAIL, 'password123')
  userToken = await login(TEST_USER_EMAIL, 'password123')

  return { app }
})

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (mongoose.connection.readyState === 1) {
    await User.deleteMany({ email: { $in: [TEST_ADMIN_EMAIL, TEST_USER_EMAIL] } })
    await mongoose.connection.close()
  }
})

test('static stock routes are registered before the parameterised ones', () => {
  const app = createApp()
  const stocksLayer = app._router.stack.find(
    (layer) => layer.name === 'router' && layer.regexp && layer.regexp.test('/api/stocks')
  )
  assert.ok(stocksLayer, 'stocks router should be mounted')

  const paths = stocksLayer.handle.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path)

  const indexOfPath = (path) => {
    const index = paths.indexOf(path)
    assert.notEqual(index, -1, `expected route ${path} to exist, got ${JSON.stringify(paths)}`)
    return index
  }

  assert.ok(indexOfPath('/news/watchlist') < indexOfPath('/news/:symbol'),
    '/news/watchlist must precede /news/:symbol or it resolves as symbol="watchlist"')
  assert.ok(indexOfPath('/search/:query') < indexOfPath('/:symbol'),
    '/search/:query must precede /:symbol')
  assert.ok(indexOfPath('/:symbol/history') < indexOfPath('/:symbol'),
    '/:symbol/history must precede /:symbol')
})

test('/api/stocks/news/watchlist is not swallowed by /news/:symbol', async () => {
  const response = await request('/api/stocks/news/watchlist?limit=10', { token: userToken })

  // The test user has an empty watchlist, so this route answers immediately
  // without touching Yahoo. If it were shadowed by /news/:symbol the request
  // would try to parse "watchlist" as a ticker and return 400 instead.
  assert.equal(response.status, 200)
  assert.deepEqual(response.data.news, [])
  assert.equal(response.data.hasMore, false)
})

test('security headers are applied and the framework is not advertised', async () => {
  const response = await request('/api/health')

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-powered-by'), null)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.match(response.headers.get('content-security-policy') || '', /default-src 'none'/)
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
})

test('CORS only allows configured origins', async () => {
  const foreign = await request('/api/health', { headers: { origin: 'https://evil.example' } })
  assert.equal(foreign.status, 403)

  const allowed = await request('/api/health', { headers: { origin: ALLOWED_ORIGIN } })
  assert.equal(allowed.status, 200)
  assert.equal(allowed.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN)

  // Browsers always send Origin on cross-origin calls; health checks do not.
  const noOrigin = await request('/api/health')
  assert.equal(noOrigin.status, 200)
})

test('malformed JSON and unknown routes are handled without leaking internals', async () => {
  const malformed = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"email":'
  })
  assert.equal(malformed.status, 400)
  assert.match(malformed.data.message, /JSON/i)

  const missing = await request('/api/definitely-not-a-route')
  assert.equal(missing.status, 404)
  assert.match(missing.data.message, /not found/i)
})

test('MongoDB operator syntax in the body is rejected', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: { $ne: null }, password: { $gt: '' } })
  })

  assert.equal(response.status, 400)
  assert.match(response.data.message, /invalid parameter/i)
})

test('login never reveals whether an account exists', async () => {
  const unknown = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `nobody-${TEST_RUN_ID}@test.dev`, password: 'password123' })
  })
  const wrongPassword = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: TEST_USER_EMAIL, password: 'wrong-password' })
  })

  assert.equal(unknown.status, 401)
  assert.equal(wrongPassword.status, 401)
  assert.equal(unknown.data.message, wrongPassword.data.message)
})

test('protected routes reject missing and malformed tokens', async () => {
  assert.equal((await request('/api/auth/me')).status, 401)
  assert.equal((await request('/api/auth/me', { token: 'not-a-jwt' })).status, 401)
  assert.equal(
    (await request('/api/auth/me', { token: `${adminToken}tampered` })).status,
    401
  )

  const valid = await request('/api/auth/me', { token: userToken })
  assert.equal(valid.status, 200)
  assert.equal(valid.data.email, TEST_USER_EMAIL)
  // The password hash must never travel to the client.
  assert.equal(valid.data.password, undefined)
})

test('profile responses never include the password hash', async () => {
  const response = await request('/api/users/profile', { token: userToken })
  assert.equal(response.status, 200)
  assert.equal(response.data.password, undefined)
  assert.equal(response.data.email, TEST_USER_EMAIL)
})

test('admin routes refuse non-admin callers', async () => {
  const stats = await request('/api/admin/stats', { token: userToken })
  assert.equal(stats.status, 403)
  assert.match(stats.data.message, /admin/i)

  const list = await request('/api/admin/users', { token: userToken })
  assert.equal(list.status, 403)

  const asAdmin = await request('/api/admin/stats', { token: adminToken })
  assert.equal(asAdmin.status, 200)
  assert.equal(typeof asAdmin.data.totalUsers, 'number')
  assert.equal(typeof asAdmin.data.averageConfidence, 'number')
})

test('an admin cannot ban or delete their own account', async () => {
  const admin = await User.findOne({ email: TEST_ADMIN_EMAIL })

  const ban = await request(`/api/admin/users/${admin._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'banned' })
  })
  assert.equal(ban.status, 400)

  const remove = await request(`/api/admin/users/${admin._id}`, {
    method: 'DELETE',
    token: adminToken
  })
  assert.equal(remove.status, 400)
})

test('invalid ids and invalid statuses are rejected', async () => {
  const badId = await request('/api/admin/users/not-an-id/status', {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'active' })
  })
  assert.equal(badId.status, 400)

  const badStatus = await request(`/api/admin/users/${userId}/status`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'definitely-not-a-status' })
  })
  assert.equal(badStatus.status, 400)
})

test('banning takes effect on the account\'s very next request', async () => {
  // Warm the auth cache first, so this only passes if the write invalidates it.
  assert.equal((await request('/api/auth/me', { token: userToken })).status, 200)

  const banned = await request(`/api/admin/users/${userId}/status`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'banned' })
  })
  assert.equal(banned.status, 200)

  const afterBan = await request('/api/auth/me', { token: userToken })
  assert.equal(afterBan.status, 403)
  assert.match(afterBan.data.message, /banned/i)

  // Restoring access works and is equally immediate.
  const restored = await request(`/api/admin/users/${userId}/status`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'active' })
  })
  assert.equal(restored.status, 200)
  assert.equal((await request('/api/auth/me', { token: userToken })).status, 200)
})

test('the health endpoint reports database state', async () => {
  const response = await request('/api/health')
  assert.equal(response.status, 200)
  assert.equal(response.data.database, 'connected')
  assert.equal(response.data.status, 'ok')
})

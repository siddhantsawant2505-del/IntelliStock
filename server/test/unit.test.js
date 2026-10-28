const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-unit-test-secret-1234'
process.env.CLIENT_ORIGIN = 'http://localhost:3000'

const { parseSymbol, parseIntInRange, parsePagination, escapeRegex } = require('../utils/validate')
const { AppError } = require('../utils/http')
const { createCache } = require('../utils/cache')
const { hasUnsafeKey, parseOrigins } = require('../app')

test('parseSymbol accepts real tickers and rejects injection attempts', () => {
  assert.equal(parseSymbol('aapl'), 'AAPL')
  assert.equal(parseSymbol(' BRK.B '), 'BRK.B')

  for (const bad of ['../../etc/passwd', 'a'.repeat(20), "AAPL'; DROP--", '', null, undefined, 42]) {
    assert.throws(() => parseSymbol(bad), (error) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.statusCode, 400)
      return true
    }, `expected ${JSON.stringify(bad)} to be rejected`)
  }
})

test('parseIntInRange bounds and fallbacks', () => {
  assert.equal(parseIntInRange('5', { min: 1, max: 10 }), 5)
  assert.equal(parseIntInRange(undefined, { min: 1, max: 10, fallback: 3 }), 3)
  assert.equal(parseIntInRange('', { min: 1, max: 10, fallback: 3 }), 3)

  for (const bad of ['0', '11', '1.5', 'abc', '-1', 'NaN']) {
    assert.throws(() => parseIntInRange(bad, { min: 1, max: 10, field: 'page' }),
      /page must be an integer/, `expected ${bad} to be rejected`)
  }
})

test('parsePagination enforces hard upper bounds on limit', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10 })
  assert.deepEqual(parsePagination({ page: '3', limit: '25' }), { page: 3, limit: 25 })

  // A client cannot ask for an unbounded page size even when the default is larger.
  assert.throws(() => parsePagination({ limit: '5000' }, { maxLimit: 50 }), /limit/)
  assert.throws(() => parsePagination({ page: '-2' }), /page/)
  assert.throws(() => parsePagination({ page: '1e999' }), /page/)
})

test('escapeRegex neutralises regex metacharacters', () => {
  const escaped = escapeRegex('a.b*c(d)[e]$f^g|h+i?j{k}l\\m')
  assert.doesNotThrow(() => new RegExp(escaped))

  // A user-supplied ".*" must be literal, not a wildcard.
  assert.equal(new RegExp(`^${escapeRegex('.*')}$`).test('anything'), false)
  assert.equal(new RegExp(`^${escapeRegex('.*')}$`).test('.*'), true)
})

test('hasUnsafeKey rejects MongoDB operator and dotted-key syntax', () => {
  assert.equal(hasUnsafeKey({ email: 'a@b.co' }), false)
  assert.equal(hasUnsafeKey({ nested: { deep: [1, 2] } }), false)
  assert.equal(hasUnsafeKey(null), false)

  assert.equal(hasUnsafeKey({ email: { $ne: null } }), true)
  assert.equal(hasUnsafeKey({ $where: 'sleep(1000)' }), true)
  assert.equal(hasUnsafeKey({ 'a.b': 'c' }), true)
  assert.equal(hasUnsafeKey({ user: { 'password.$gt': '' } }), true)
  assert.equal(hasUnsafeKey(JSON.parse('{"__proto__":{"polluted":true}}')), true)
  assert.equal(hasUnsafeKey({ constructor: { prototype: { polluted: true } } }), true)
  assert.equal(hasUnsafeKey([{ $gt: 1 }]), true)
})

test('parseOrigins is a strict allowlist', () => {
  assert.deepEqual(parseOrigins(undefined), ['http://localhost:3000'])
  assert.deepEqual(parseOrigins('https://a.com, https://b.com'), ['https://a.com', 'https://b.com'])
  // Never an empty allowlist: that would mean "allow nothing" is impossible to hit by accident.
  assert.deepEqual(parseOrigins('  '), ['http://localhost:3000'])
})

test('cache serves hits, expires entries and de-duplicates in-flight work', async () => {
  const cache = createCache({ ttlMs: 50, maxEntries: 2 })

  assert.equal(cache.get('missing'), undefined)

  let calls = 0
  const loader = async () => {
    calls += 1
    return `value-${calls}`
  }

  // Concurrent callers share one underlying request.
  const [a, b] = await Promise.all([cache.wrap('k', loader), cache.wrap('k', loader)])
  assert.equal(a, 'value-1')
  assert.equal(b, 'value-1')
  assert.equal(calls, 1)

  assert.equal(await cache.wrap('k', loader), 'value-1')
  assert.equal(calls, 1)

  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(await cache.wrap('k', loader), 'value-2')
  assert.equal(calls, 2)

  // Failed loads must not be cached.
  await assert.rejects(cache.wrap('boom', async () => { throw new Error('nope') }))
  await assert.rejects(cache.wrap('boom', async () => { throw new Error('nope') }))

  cache.remove('k')
  assert.equal(cache.get('k'), undefined)

  // maxEntries bounds memory.
  cache.set('a', 1)
  cache.set('b', 2)
  cache.set('c', 3)
  assert.ok(cache.size <= 2)
})

test('cache invalidation wins over a stale in-flight load', async () => {
  const cache = createCache()
  let resolveOldLoad
  const oldLoad = cache.wrap('user:1', () => new Promise((resolve) => {
    resolveOldLoad = resolve
  }))

  cache.remove('user:1')
  cache.set('user:1', { status: 'banned' })
  resolveOldLoad({ status: 'active' })
  await oldLoad

  assert.deepEqual(cache.get('user:1'), { status: 'banned' })

  let resolveBeforeClear
  const beforeClear = cache.wrap('user:2', () => new Promise((resolve) => {
    resolveBeforeClear = resolve
  }))
  cache.clear()
  resolveBeforeClear({ status: 'active' })
  await beforeClear
  assert.equal(cache.get('user:2'), undefined)
})

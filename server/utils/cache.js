/**
 * Small in-memory TTL cache with in-flight request de-duplication.
 *
 * Upstream quote/chart calls are the slowest and most rate-limited part of this
 * app, so identical concurrent lookups share one request instead of stampeding
 * the provider.
 */
const createCache = ({ ttlMs = 60_000, maxEntries = 500 } = {}) => {
  const store = new Map()

  const evictIfNeeded = () => {
    while (store.size > maxEntries) {
      const oldestKey = store.keys().next().value
      store.delete(oldestKey)
    }
  }

  const get = (key) => {
    const entry = store.get(key)
    if (!entry) return undefined
    if (entry.expires <= Date.now()) {
      store.delete(key)
      return undefined
    }
    return entry.value
  }

  const set = (key, value, ttl = ttlMs) => {
    store.delete(key)
    store.set(key, { value, expires: Date.now() + ttl })
    evictIfNeeded()
    return value
  }

  const wrap = async (key, fn, ttl = ttlMs) => {
    const entry = store.get(key)

    if (entry) {
      if (entry.promise) return entry.promise
      if (entry.expires > Date.now()) return entry.value
      store.delete(key)
    }

    const promise = (async () => {
      try {
        const value = await fn()
        set(key, value, ttl)
        return value
      } catch (error) {
        store.delete(key)
        throw error
      }
    })()

    store.set(key, { promise, expires: Date.now() + ttl })
    return promise
  }

  const clear = () => store.clear()

  return { get, set, wrap, clear, get size() { return store.size } }
}

module.exports = { createCache }

import axios from 'axios'

// VITE_API_URL is expected to be the API *origin* (e.g. http://localhost:5000).
// In development the Vite proxy forwards /api to the Express server, so the
// same-origin default works without any environment configuration.
const configuredOrigin = import.meta.env.VITE_API_URL
const baseURL = configuredOrigin
  ? `${configuredOrigin.replace(/\/+$/, '')}/api`
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 20000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      const { pathname } = window.location
      if (pathname !== '/login' && pathname !== '/') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Extract a user-facing message from an axios error without ever leaking
 * server internals (stack traces, driver errors) into the UI.
 */
export const getErrorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || error?.message || fallback

export default api

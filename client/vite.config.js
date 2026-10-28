import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const createContentSecurityPolicy = (mode, env) => {
  const connectSources = ["'self'"]

  if (env.VITE_API_URL) {
    let apiUrl
    try {
      apiUrl = new URL(env.VITE_API_URL)
    } catch {
      throw new Error('VITE_API_URL must be an absolute API origin, such as https://api.example.com')
    }

    if (!['http:', 'https:'].includes(apiUrl.protocol)) {
      throw new Error('VITE_API_URL must use HTTP or HTTPS')
    }
    if (mode === 'production' && apiUrl.protocol !== 'https:') {
      throw new Error('VITE_API_URL must use HTTPS in production')
    }

    connectSources.push(apiUrl.origin)
  }

  // Vite's development server uses a WebSocket for HMR. Keep this local
  // allowance out of production builds.
  if (mode === 'development') {
    connectSources.push('ws://localhost:3000', 'ws://127.0.0.1:3000')
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`
  ].join('; ')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const contentSecurityPolicy = createContentSecurityPolicy(mode, env)

  return {
    plugins: [
      react(),
      {
        name: 'intellistock-content-security-policy',
        transformIndexHtml(html) {
          const policy = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">`
          return html.replace('</head>', `  ${policy}\n  </head>`)
        }
      }
    ],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/ml-api': {
          target: 'http://localhost:8000',
          changeOrigin: true
        }
      }
    }
  }
})
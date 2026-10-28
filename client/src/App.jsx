import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Layout/Navbar'
import Footer from './components/Layout/Footer'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import AdminRoute from './components/Auth/AdminRoute'
import PageLoader from './components/UI/LoadingSpinner'

// Every route is lazy so the public landing page does not ship recharts,
// framer-motion and the admin panel in the initial payload.
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Predictor = lazy(() => import('./pages/Predictor'))
const News = lazy(() => import('./pages/News'))
const Watchlist = lazy(() => import('./pages/Watchlist'))
const Admin = lazy(() => import('./pages/Admin'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Navbar />
      
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/predictor" element={
            <ProtectedRoute>
              <Predictor />
            </ProtectedRoute>
          } />
          
          <Route path="/news" element={
            <ProtectedRoute>
              <News />
            </ProtectedRoute>
          } />
          
          <Route path="/watchlist" element={
            <ProtectedRoute>
              <Watchlist />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Footer />
    </div>
  )
}

export default App
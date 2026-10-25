import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <SearchX className="h-16 w-16 text-primary-400 mx-auto mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Link to="/" className="btn-primary inline-flex items-center px-6 py-3">
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default NotFound

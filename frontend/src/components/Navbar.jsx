import { LogOut } from 'lucide-react'
import { useStore } from '../store/store'
import { useNavigate } from 'react-router-dom'

export function Navbar() {
  const { user, logout } = useStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-2xl font-bold text-blue-600">📈 STK</div>
            <span className="ml-2 text-sm text-gray-600">Stock Tracker</span>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-600">{user.username}</span>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

import { LogOut, Moon, Sun, Settings, Menu, X } from 'lucide-react'
import { useStore } from '../store/store'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export function Navbar() {
  const { user, logout, darkMode, toggleDarkMode } = useStore()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleDarkModeToggle = () => {
    toggleDarkMode()
    if (!darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">📈 STK</div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Stock Tracker</span>
          </div>

          {/* User Info - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-600 dark:text-gray-400">{user.username}</span>
            )}
            <button
              onClick={handleDarkModeToggle}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="pt-4 space-y-2">
              {user && (
                <div className="px-2 py-2 text-sm text-gray-600 dark:text-gray-400">
                  Logged in as: {user.username}
                </div>
              )}
              <button
                onClick={() => {
                  handleDarkModeToggle()
                  setMobileMenuOpen(false)
                }}
                className="w-full text-left px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition flex items-center gap-2"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-yellow-500" />
                    Light mode
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    Dark mode
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  navigate('/settings')
                  setMobileMenuOpen(false)
                }}
                className="w-full text-left px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition flex items-center gap-2 text-gray-600 dark:text-gray-400"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => {
                  handleLogout()
                  setMobileMenuOpen(false)
                }}
                className="w-full text-left px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition flex items-center gap-2 text-gray-600 dark:text-gray-400"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

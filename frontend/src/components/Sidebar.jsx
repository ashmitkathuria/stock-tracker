import { Home, BarChart3, Briefcase, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export function Sidebar() {
  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: BarChart3, label: 'Watchlist', path: '/watchlist' },
    { icon: Briefcase, label: 'Portfolio', path: '/portfolio' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-full overflow-y-auto">
      <div className="p-6">
        <nav className="space-y-2">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Moon, Sun, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import apiClient from '../config/api'
import { useStore } from '../store/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { usePageTitle } from '../hooks/usePageTitle'

export function SettingsPage() {
  usePageTitle('Settings')
  const navigate = useNavigate()
  const { user, darkMode, toggleDarkMode, logout } = useStore()

  // Password change state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteUsername, setDeleteUsername] = useState('')
  const [deleteError, setDeleteError] = useState('')

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match')
      }
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }
      return await apiClient.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      })
    },
    onSuccess: () => {
      toast.success('Password changed successfully')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    },
    onError: (error) => {
      setPasswordError(error.message || error.detail || 'Failed to change password')
    },
  })

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      if (deleteUsername !== user?.username) {
        throw new Error('Username does not match')
      }
      return await apiClient.delete('/auth/me')
    },
    onSuccess: () => {
      toast.success('Account deleted')
      logout()
      navigate('/login')
    },
    onError: (error) => {
      setDeleteError(error.message || error.detail || 'Failed to delete account')
    },
  })

  const handleDarkModeToggle = () => {
    toggleDarkMode()
    if (!darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleDeleteAccount = () => {
    setDeleteError('')
    deleteAccountMutation.mutate()
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account and preferences</p>
      </div>

      {/* Account Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Account</h2>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Username</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{user?.username}</p>
        </div>
        {user?.email && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Email</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.email}</p>
          </div>
        )}
      </div>

      {/* Appearance Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Appearance</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? (
              <Moon className="w-5 h-5 text-yellow-500" />
            ) : (
              <Sun className="w-5 h-5 text-yellow-600" />
            )}
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Dark Mode</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {darkMode ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDarkModeToggle}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            }`}
          >
            {darkMode ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Security</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter new password (min 8 characters)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Confirm new password"
            />
          </div>
          {passwordError && (
            <p className="text-red-600 dark:text-red-400 text-sm">{passwordError}</p>
          )}
          <button
            onClick={() => changePasswordMutation.mutate()}
            disabled={!oldPassword || !newPassword || !confirmPassword || changePasswordMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-6 flex items-center gap-2">
          <Trash2 className="w-6 h-6" />
          Danger Zone
        </h2>
        <p className="text-red-700 dark:text-red-300 mb-4">
          Deleting your account is permanent and cannot be undone. All your data will be deleted.
        </p>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false)
          setDeleteUsername('')
          setDeleteError('')
        }}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message={`This action cannot be undone. Type your username "${user?.username}" to confirm.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteAccountMutation.isPending}
      >
        <div className="mt-4">
          <input
            type="text"
            value={deleteUsername}
            onChange={(e) => setDeleteUsername(e.target.value)}
            placeholder={user?.username}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {deleteError && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-2">{deleteError}</p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  )
}

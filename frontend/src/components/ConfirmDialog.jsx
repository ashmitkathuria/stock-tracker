import { AlertCircle } from 'lucide-react'
import { Modal } from './Modal'

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'primary', loading = false }) {
  const buttonClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    danger: 'bg-red-600 hover:bg-red-700',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4 mb-4">
        <AlertCircle className={`w-6 h-6 flex-shrink-0 ${variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-white font-semibold ${buttonClasses[variant]} transition disabled:opacity-50`}
        >
          {loading ? 'Loading...' : confirmText}
        </button>
      </div>
    </Modal>
  )
}

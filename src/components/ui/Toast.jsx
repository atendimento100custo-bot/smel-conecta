// src/components/ui/Toast.jsx
import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

const ICONS = {
  success: <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />,
  error:   <XCircle     size={16} className="text-red-500 flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
}

export function Toast({ message, type = 'error', onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null
  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border max-w-xs w-[90vw] text-sm font-medium animate-slide-up ${
      type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200'
      : type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200'
      : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200'
    }`}>
      {ICONS[type]}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14}/></button>
    </div>
  )
}

// Hook simples para usar o toast
export function useToast() {
  const [toast, setToast] = useState(null)
  const showToast = (message, type = 'error') => setToast({ message, type })
  const hideToast = () => setToast(null)
  const toastEl = toast ? <Toast message={toast.message} type={toast.type} onClose={hideToast} /> : null
  return { showToast, toastEl }
}

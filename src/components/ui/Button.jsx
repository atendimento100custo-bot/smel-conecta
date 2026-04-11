// src/components/ui/Button.jsx
import { clsx } from 'clsx'

const variants = {
  primary: 'bg-gradient-to-r from-primary-700 to-primary-500 text-white shadow-sm shadow-primary-100 hover:opacity-90',
  secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({
  variant = 'primary', size = 'md', className, children, ...props
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

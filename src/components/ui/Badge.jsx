// src/components/ui/Badge.jsx
import { clsx } from 'clsx'

const colors = {
  green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  red:    'bg-red-50 text-red-600 border-red-100',
  amber:  'bg-amber-50 text-amber-700 border-amber-100',
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  gray:   'bg-slate-100 text-slate-600 border-slate-200',
}

export default function Badge({ color = 'gray', children, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
      colors[color], className
    )}>
      {children}
    </span>
  )
}

// src/components/Topbar.jsx
import { Menu } from 'lucide-react'
import { useSidebar } from '../contexts/SidebarContext'

export default function Topbar({ title, action }) {
  const { toggle } = useSidebar()
  return (
    <div className="h-12 bg-white dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700 px-3 md:px-5 flex items-center justify-between flex-shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={toggle}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors flex-shrink-0"
        >
          <Menu size={17} />
        </button>
        <h1 className="text-[13px] md:text-[14px] font-bold text-navy-900 dark:text-white truncate">{title}</h1>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

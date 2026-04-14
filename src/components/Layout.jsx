// src/components/Layout.jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext'

function LayoutInner() {
  const { open, close } = useSidebar()
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-navy-900">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={close}
        />
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  )
}

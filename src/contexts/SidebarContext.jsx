// src/contexts/SidebarContext.jsx
import { createContext, useContext, useState } from 'react'

const SidebarCtx = createContext(null)

export function SidebarProvider({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <SidebarCtx.Provider value={{
      open,
      toggle: () => setOpen(s => !s),
      close: () => setOpen(false),
    }}>
      {children}
    </SidebarCtx.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarCtx)
}

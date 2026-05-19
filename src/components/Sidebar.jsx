// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { useSidebar } from '../contexts/SidebarContext'
import {
  LayoutDashboard, MapPin, Trophy, Users,
  UserCheck, BarChart2, Key, Settings, LogOut, Sun, Moon, X, History
} from 'lucide-react'

const NAV = [
  {
    label: 'Visão Geral',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', minRole: 'estagiario' },
    ]
  },
  {
    label: 'Gestão',
    items: [
      { to: '/polos', icon: MapPin, label: 'Polos', minRole: 'estagiario' },
      { to: '/modalidades', icon: Trophy, label: 'Modalidades', minRole: 'coordenador' },
      { to: '/alunos', icon: Users, label: 'Alunos', minRole: 'professor' },
      { to: '/equipes', icon: UserCheck, label: 'Equipe', minRole: 'coordenador' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { to: '/relatorios', icon: BarChart2, label: 'Relatórios', minRole: 'professor' },
      { to: '/gerenciar-acesso', icon: Key, label: 'Acessos', minRole: 'admin' },
      { to: '/historico', icon: History, label: 'Histórico', minRole: 'admin' },
      { to: '/configuracoes', icon: Settings, label: 'Configurações', minRole: 'estagiario' },
    ]
  },
]

export default function Sidebar() {
  const { profile, hasMinRole, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const { open, close } = useSidebar()

  const initials = profile?.nome
    ? profile.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-40 w-[220px] flex-shrink-0
      bg-white dark:bg-navy-800 border-r border-slate-200 dark:border-navy-700
      flex flex-col transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
      md:relative md:translate-x-0 md:z-auto
    `}>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src="/logo-smel.png" alt="SMEL" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-extrabold text-navy-900 dark:text-white tracking-tight leading-none">SMEL Conecta</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">Volta Redonda</div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={close}
            className="md:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(section => {
          const visibleItems = section.items.filter(i => hasMinRole(i.minRole))
          if (!visibleItems.length) return null
          return (
            <div key={section.label} className="mb-1">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-2 py-1.5 mt-2">
                {section.label}
              </p>
              {visibleItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={close}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-colors mb-0.5 ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 hover:text-slate-800 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon size={15} />
                  {label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-slate-200 dark:border-navy-700 space-y-2">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
        >
          {dark ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} />}
          {dark ? 'Modo Claro' : 'Modo Escuro'}
        </button>

        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-50 dark:bg-navy-900">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-navy-900 dark:text-white truncate">{profile?.nome ?? '—'}</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 capitalize">{profile?.cargo ?? ''}</div>
          </div>
          <button onClick={signOut} className="text-slate-400 hover:text-red-500 transition-colors p-0.5">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}

// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard, MapPin, Trophy, Users, BookOpen,
  UserCheck, ClipboardList, Stethoscope, Star,
  Bus, BarChart2, Key, Settings, LogOut
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
      { to: '/turmas', icon: BookOpen, label: 'Turmas', minRole: 'professor' },
      { to: '/alunos', icon: Users, label: 'Alunos', minRole: 'professor' },
      { to: '/equipes', icon: UserCheck, label: 'Equipe', minRole: 'coordenador' },
    ]
  },
  {
    label: 'Operacional',
    items: [
      { to: '/presenca', icon: ClipboardList, label: 'Presença', minRole: 'estagiario' },
      { to: '/registro-aula', icon: ClipboardList, label: 'Registro de Aula', minRole: 'professor' },
      { to: '/atestados', icon: Stethoscope, label: 'Atestados', minRole: 'professor' },
    ]
  },
  {
    label: 'Melhor Idade',
    items: [
      { to: '/melhor-idade', icon: Star, label: 'Elegibilidade', minRole: 'professor' },
      { to: '/viagens', icon: Bus, label: 'Viagens', minRole: 'coordenador' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { to: '/relatorios', icon: BarChart2, label: 'Relatórios', minRole: 'professor' },
      { to: '/gerenciar-acesso', icon: Key, label: 'Acessos', minRole: 'admin' },
      { to: '/configuracoes', icon: Settings, label: 'Configurações', minRole: 'admin' },
    ]
  },
]

export default function Sidebar() {
  const { profile, hasMinRole, signOut } = useAuth()

  const initials = profile?.nome
    ? profile.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-700 to-primary-500 flex items-center justify-center text-white text-base shadow-sm shadow-primary-200">
            ⚽
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-navy-900 tracking-tight leading-none">SMEL Conecta</div>
            <div className="text-[9px] text-slate-400 font-normal mt-0.5">Volta Redonda</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(section => {
          const visibleItems = section.items.filter(i => hasMinRole(i.minRole))
          if (!visibleItems.length) return null
          return (
            <div key={section.label} className="mb-1">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5 mt-2">
                {section.label}
              </p>
              {visibleItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-colors mb-0.5 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-semibold'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
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
      <div className="px-3 py-3 border-t border-slate-200">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-50">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-navy-900 truncate">{profile?.nome ?? '—'}</div>
            <div className="text-[9px] text-slate-400 capitalize">{profile?.cargo ?? ''}</div>
          </div>
          <button onClick={signOut} className="text-slate-400 hover:text-red-500 transition-colors p-0.5">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}

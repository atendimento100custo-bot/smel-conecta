// src/contexts/PermissoesContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// Telas "operacionais" que o admin pode liberar/ocultar por cargo.
// Telas exclusivas de admin (Acessos, Histórico, Infra, Supervisão, esta própria
// tela de permissões) ficam sempre travadas no código — nunca entram aqui,
// pra o admin nunca correr risco de se trancar fora do próprio sistema.
export const TELAS_CONFIGURAVEIS = [
  { tela: 'dashboard',   label: 'Dashboard' },
  { tela: 'polos',       label: 'Polos' },
  { tela: 'presenca',    label: 'Chamada' },
  { tela: 'modalidades', label: 'Modalidades' },
  { tela: 'alunos',      label: 'Alunos' },
  { tela: 'equipes',     label: 'Equipe' },
  { tela: 'relatorios',  label: 'Relatórios' },
]

export const CARGOS_CONFIGURAVEIS = ['estagiario', 'professor', 'coordenador']

// Valores padrão — idênticos aos minRole hardcoded que existiam antes desta tela.
// Servem de fallback enquanto a tabela carrega e para qualquer combinação
// tela+cargo ainda não configurada no banco.
export const DEFAULTS = {
  dashboard:   { estagiario: true,  professor: true,  coordenador: true },
  polos:       { estagiario: true,  professor: true,  coordenador: true },
  presenca:    { estagiario: true,  professor: true,  coordenador: true },
  modalidades: { estagiario: false, professor: false, coordenador: true },
  alunos:      { estagiario: false, professor: true,  coordenador: true },
  equipes:     { estagiario: false, professor: false, coordenador: true },
  relatorios:  { estagiario: false, professor: true,  coordenador: true },
}

const PermissoesContext = createContext(null)

export function PermissoesProvider({ children }) {
  const { user } = useAuth()
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('permissoes_tela').select('tela,cargo,habilitado')
    const map = {}
    for (const row of data ?? []) {
      if (!map[row.tela]) map[row.tela] = {}
      map[row.tela][row.cargo] = row.habilitado
    }
    setOverrides(map)
    setLoading(false)
  }, [])

  // Recarrega quando o usuário loga (a primeira tentativa, pré-login, não
  // retorna nada porque a RLS exige auth.uid() — cai no DEFAULTS até aqui).
  useEffect(() => { reload() }, [reload, user])

  // Admin nunca é bloqueado pela matriz — acesso total sempre garantido.
  function podeAcessar(tela, cargo) {
    if (cargo === 'admin') return true
    if (!cargo || !tela) return false
    const over = overrides[tela]?.[cargo]
    if (over !== undefined) return over
    return DEFAULTS[tela]?.[cargo] ?? false
  }

  return (
    <PermissoesContext.Provider value={{ podeAcessar, loading, reload, overrides }}>
      {children}
    </PermissoesContext.Provider>
  )
}

export function usePermissoesTela() {
  const ctx = useContext(PermissoesContext)
  if (!ctx) throw new Error('usePermissoesTela deve ser usado dentro de PermissoesProvider')
  return ctx
}

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Helpers de papel
  const isAdmin = profile?.cargo === 'admin'
  const isCoordenador = profile?.cargo === 'coordenador'
  const isProfessor = profile?.cargo === 'professor'
  const isEstagiario = profile?.cargo === 'estagiario'
  // Dono do sistema — só uma conta específica (marcada no banco), não "qualquer admin".
  // Telas de manutenção/auditoria (Histórico, Permissões, Infraestrutura) ficam só pra ele,
  // mesmo que outras contas tenham cargo admin pra gerenciar o dia a dia.
  const isOwner = profile?.is_owner === true

  function hasMinRole(minRole) {
    const order = { admin: 4, coordenador: 3, professor: 2, estagiario: 1 }
    return (order[profile?.cargo] ?? 0) >= (order[minRole] ?? 0)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signOut,
      isAdmin, isCoordenador, isProfessor, isEstagiario, isOwner,
      hasMinRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

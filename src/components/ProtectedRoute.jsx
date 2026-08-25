// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePermissoesTela } from '../contexts/PermissoesContext'

export default function ProtectedRoute({ children, minRole = 'estagiario', tela, ownerOnly = false }) {
  const { user, profile, loading, hasMinRole, isOwner } = useAuth()
  const { podeAcessar, loading: loadingPerms } = usePermissoesTela()

  if (loading || (tela && loadingPerms)) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (profile && !hasMinRole(minRole)) return <Navigate to="/" replace />
  if (profile && ownerOnly && !isOwner) return <Navigate to="/" replace />
  if (profile && tela && !podeAcessar(tela, profile.cargo)) return <Navigate to="/" replace />

  return children
}

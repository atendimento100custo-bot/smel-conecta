// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, minRole = 'estagiario' }) {
  const { user, profile, loading, hasMinRole } = useAuth()

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (profile && !hasMinRole(minRole)) return <Navigate to="/" replace />

  return children
}

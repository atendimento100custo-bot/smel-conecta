// src/pages/Dashboard.jsx
// Escolhe a versão certa: admin vê o painel completo, o resto da equipe
// vê a versão simplificada (menos informação, mais foco no dia a dia).
import { useAuth } from '../hooks/useAuth'
import DashboardAdmin from './DashboardAdmin'
import DashboardStaff from './DashboardStaff'

export default function Dashboard() {
  const { isAdmin } = useAuth()
  return isAdmin ? <DashboardAdmin /> : <DashboardStaff />
}

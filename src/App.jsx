// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Polos from './pages/Polos'
import Modalidades from './pages/Modalidades'
import Equipes from './pages/Equipes'
import Turmas from './pages/Turmas'
import Alunos from './pages/Alunos'
import Presenca from './pages/Presenca'
import Atestados from './pages/Atestados'
import RegistroAula from './pages/RegistroAula'
import MelhorIdade from './pages/MelhorIdade'
import Viagens from './pages/Viagens'
import Relatorios from './pages/Relatorios'
import GerenciarAcesso from './pages/GerenciarAcesso'
import Configuracoes from './pages/Configuracoes'

function R({ minRole, children }) {
  return <ProtectedRoute minRole={minRole}>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<R minRole="estagiario"><Layout /></R>}>
        <Route index element={<Dashboard />} />
        <Route path="polos" element={<Polos />} />
        <Route path="modalidades" element={<R minRole="coordenador"><Modalidades /></R>} />
        <Route path="equipes" element={<R minRole="coordenador"><Equipes /></R>} />
        <Route path="turmas" element={<R minRole="professor"><Turmas /></R>} />
        <Route path="alunos" element={<R minRole="professor"><Alunos /></R>} />
        <Route path="presenca" element={<Presenca />} />
        <Route path="registro-aula" element={<R minRole="professor"><RegistroAula /></R>} />
        <Route path="atestados" element={<R minRole="professor"><Atestados /></R>} />
        <Route path="melhor-idade" element={<R minRole="professor"><MelhorIdade /></R>} />
        <Route path="viagens" element={<R minRole="coordenador"><Viagens /></R>} />
        <Route path="relatorios" element={<R minRole="professor"><Relatorios /></R>} />
        <Route path="gerenciar-acesso" element={<R minRole="admin"><GerenciarAcesso /></R>} />
        <Route path="configuracoes" element={<R minRole="admin"><Configuracoes /></R>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

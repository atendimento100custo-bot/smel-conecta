// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Polos from './pages/Polos'
import PoloDetalhe from './pages/PoloDetalhe'
import Modalidades from './pages/Modalidades'
import Equipes from './pages/Equipes'
import Turmas from './pages/Turmas'
import Alunos from './pages/Alunos'
import AlunoDetalhe from './pages/AlunoDetalhe'
import Presenca from './pages/Presenca'
import Atestados from './pages/Atestados'
import RegistroAula from './pages/RegistroAula'
import MelhorIdade from './pages/MelhorIdade'
import Viagens from './pages/Viagens'
import Relatorios from './pages/Relatorios'
import GerenciarAcesso from './pages/GerenciarAcesso'
import Configuracoes from './pages/Configuracoes'
import Historico from './pages/Historico'
import Infra from './pages/Infra'
import Supervisao from './pages/Supervisao'
import PermissoesAcesso from './pages/PermissoesAcesso'

function R({ minRole, tela, children }) {
  return <ProtectedRoute minRole={minRole} tela={tela}>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<R minRole="estagiario"><Layout /></R>}>
        <Route index element={<R minRole="estagiario" tela="dashboard"><Dashboard /></R>} />
        <Route path="polos" element={<R minRole="estagiario" tela="polos"><Polos /></R>} />
        <Route path="polos/:id" element={<R minRole="estagiario" tela="polos"><PoloDetalhe /></R>} />
        <Route path="modalidades" element={<R minRole="coordenador" tela="modalidades"><Modalidades /></R>} />
        <Route path="equipes" element={<R minRole="coordenador" tela="equipes"><Equipes /></R>} />
        <Route path="turmas" element={<R minRole="professor"><Turmas /></R>} />
        <Route path="alunos" element={<R minRole="professor" tela="alunos"><Alunos /></R>} />
        <Route path="alunos/:id" element={<R minRole="professor" tela="alunos"><AlunoDetalhe /></R>} />
        <Route path="presenca" element={<R minRole="estagiario" tela="presenca"><Presenca /></R>} />
        <Route path="registro-aula" element={<R minRole="professor"><RegistroAula /></R>} />
        <Route path="atestados" element={<R minRole="professor"><Atestados /></R>} />
        <Route path="melhor-idade" element={<R minRole="professor"><MelhorIdade /></R>} />
        <Route path="viagens" element={<R minRole="coordenador"><Viagens /></R>} />
        <Route path="relatorios" element={<R minRole="professor" tela="relatorios"><Relatorios /></R>} />
        <Route path="gerenciar-acesso" element={<R minRole="admin"><GerenciarAcesso /></R>} />
        <Route path="historico" element={<R minRole="admin"><Historico /></R>} />
        <Route path="infra" element={<R minRole="admin"><Infra /></R>} />
        <Route path="supervisao" element={<R minRole="admin"><Supervisao /></R>} />
        <Route path="permissoes-acesso" element={<R minRole="admin"><PermissoesAcesso /></R>} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

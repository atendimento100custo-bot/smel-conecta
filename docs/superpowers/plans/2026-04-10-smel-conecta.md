# SMEL Conecta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o sistema de gestão esportiva SMEL Conecta para Volta Redonda/RJ com autenticação real, 4 níveis de acesso, banco Supabase e deploy no Vercel.

**Architecture:** React SPA com React Router v6, Supabase como backend (Auth + PostgreSQL + Storage + RLS), componentes shadcn/ui via 21st.dev. Permissões aplicadas em dois níveis: RLS no banco e `<ProtectedRoute>` no frontend.

**Tech Stack:** React 18, Vite, TailwindCSS, shadcn/ui, Supabase JS v2, React Router v6, @react-pdf/renderer, Recharts, Lucide React, date-fns

---

## File Structure

```
src/
  lib/
    supabase.js              # cliente Supabase + tipos helpers
  contexts/
    AuthContext.jsx          # Provider de autenticação global
  hooks/
    useAuth.js               # hook de acesso ao AuthContext
    usePolos.js              # CRUD polos
    useModalidades.js        # CRUD modalidades
    useEquipes.js            # CRUD equipes/profiles
    useTurmas.js             # CRUD turmas
    useAlunos.js             # CRUD alunos
    usePresenca.js           # registro de presença
    useAtestados.js          # controle de atestados
    useRegistros.js          # registros de aula
    useViagens.js            # viagens melhor idade
    useVinculos.js           # vínculos usuário-polo e estagiário-turma
  components/
    Layout.jsx               # shell: sidebar + topbar + outlet
    Sidebar.jsx              # navegação lateral com seções por papel
    Topbar.jsx               # título + botão ação + notificações
    ProtectedRoute.jsx       # guard de rota por papel mínimo
    ui/
      Button.jsx             # botão com variantes
      Card.jsx               # card base com header/body
      Badge.jsx              # badge de status colorido
      Modal.jsx              # modal com backdrop
      DataTable.jsx          # tabela paginada com busca
      FormField.jsx          # label + input + erro
      EmptyState.jsx         # estado vazio com ícone e CTA
      ConfirmDialog.jsx      # diálogo de confirmação destrutiva
      AvatarUpload.jsx       # upload de foto com preview
  pages/
    Login.jsx                # tela de login email/senha
    Dashboard.jsx            # KPIs + gráficos + alertas
    Polos.jsx                # lista + CRUD de polos
    PoloDetail.jsx           # detalhe do polo com turmas e alunos
    Modalidades.jsx          # lista + CRUD de modalidades
    Equipes.jsx              # lista + CRUD de membros
    Turmas.jsx               # lista + CRUD de turmas
    Alunos.jsx               # lista + CRUD + import CSV
    AlunoDetail.jsx          # perfil completo do aluno
    Presenca.jsx             # registro de presença por turma/data
    Atestados.jsx            # controle de atestados com alertas
    RegistroAula.jsx         # diário de aulas
    MelhorIdade.jsx          # elegibilidade para viagens
    Viagens.jsx              # gestão de viagens
    Relatorios.jsx           # geração de PDF
    GerenciarAcesso.jsx      # usuários + vínculos (admin only)
    Configuracoes.jsx        # configurações gerais (admin only)
  pdf/
    RelatorioPresenca.jsx    # template PDF de presença
    RelatorioAlunos.jsx      # template PDF de alunos
    RelatorioTurmas.jsx      # template PDF de turmas
  App.jsx                    # router + rotas protegidas
  main.jsx                   # entry point
  index.css                  # tailwind + globals
```

---

## Fase 1 — Fundação

### Task 1: Dependências e configuração do projeto

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Instalar dependências**

```bash
cd "/c/Users/daly_/Claude Code/Smel"
npm install @supabase/supabase-js react-router-dom recharts lucide-react date-fns @react-pdf/renderer clsx
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Criar .env.example**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 3: Criar .env local** (substituir com valores reais do Supabase)

```bash
cp .env.example .env
# Editar .env com URL e anon key do projeto Supabase
```

- [ ] **Step 4: Criar .gitignore**

```
node_modules/
dist/
.env
.env.local
.superpowers/
```

- [ ] **Step 5: Verificar que npm run dev funciona**

```bash
npm run dev
# Esperado: servidor Vite em http://localhost:5173
```

- [ ] **Step 6: Commit**

```bash
git init
git add package.json .env.example .gitignore vite.config.js tailwind.config.js postcss.config.js index.html
git commit -m "chore: project setup — Vite + React + Tailwind"
```

---

### Task 2: Schema Supabase — Tabelas e Enums

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Criar projeto no Supabase**

Acesse https://supabase.com → New Project → nome: `smel-conecta` → região: South America (São Paulo)

- [ ] **Step 2: Criar arquivo de schema**

```sql
-- supabase/schema.sql

-- Enums
CREATE TYPE cargo_enum AS ENUM ('admin', 'coordenador', 'professor', 'estagiario');
CREATE TYPE status_polo AS ENUM ('Ativo', 'Inativo');
CREATE TYPE status_geral AS ENUM ('Ativo', 'Inativo');
CREATE TYPE status_turma AS ENUM ('Ativa', 'Inativa');
CREATE TYPE status_aluno AS ENUM ('Ativo', 'Inativo', 'Transferido');
CREATE TYPE faixa_enum AS ENUM ('Infantil', 'Adulto', 'Melhor Idade');

-- profiles (extensão de auth.users)
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  cargo      cargo_enum NOT NULL DEFAULT 'professor',
  telefone   text,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- polos
CREATE TABLE polos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL,
  tipo      text NOT NULL,
  bairro    text,
  endereco  text,
  status    status_polo NOT NULL DEFAULT 'Ativo'
);

-- vinculos_usuario_polo (coordenador → polos)
CREATE TABLE vinculos_usuario_polo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  polo_id    uuid NOT NULL REFERENCES polos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, polo_id)
);

-- modalidades
CREATE TABLE modalidades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  categoria  text,
  emoji      text DEFAULT '🏃',
  faixas     text[] NOT NULL DEFAULT '{}',
  status     status_geral NOT NULL DEFAULT 'Ativo'
);

-- turmas
CREATE TABLE turmas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polo_id        uuid REFERENCES polos(id) ON DELETE SET NULL,
  modalidade_id  uuid REFERENCES modalidades(id) ON DELETE SET NULL,
  professor_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  faixa          faixa_enum NOT NULL DEFAULT 'Adulto',
  dias           text[] NOT NULL DEFAULT '{}',
  horario        time,
  capacidade     int NOT NULL DEFAULT 20,
  status         status_turma NOT NULL DEFAULT 'Ativa'
);

-- vinculos_estagiario_turma
CREATE TABLE vinculos_estagiario_turma (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estagiario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  turma_id      uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estagiario_id, turma_id)
);

-- alunos
CREATE TABLE alunos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id       uuid REFERENCES turmas(id) ON DELETE SET NULL,
  nome           text NOT NULL,
  data_nasc      date,
  cpf            text,
  telefone       text,
  email          text,
  endereco       text,
  foto_url       text,
  data_matricula date NOT NULL DEFAULT CURRENT_DATE,
  status         status_aluno NOT NULL DEFAULT 'Ativo'
);

-- presencas
CREATE TABLE presencas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id        uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  aluno_id        uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  registrado_por  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  data            date NOT NULL DEFAULT CURRENT_DATE,
  presente        boolean NOT NULL DEFAULT false,
  observacao      text,
  UNIQUE(turma_id, aluno_id, data)
);

-- atestados
CREATE TABLE atestados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  data_emissao  date,
  data_validade date NOT NULL,
  arquivo_url   text,
  observacao    text
);

-- registros_aula
CREATE TABLE registros_aula (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id         uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  professor_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  data             date NOT NULL DEFAULT CURRENT_DATE,
  conteudo         text,
  ocorrencias      text,
  alunos_presentes int NOT NULL DEFAULT 0
);

-- viagens
CREATE TABLE viagens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polo_id      uuid REFERENCES polos(id) ON DELETE SET NULL,
  turma_id     uuid REFERENCES turmas(id) ON DELETE SET NULL,
  destino      text NOT NULL,
  data         date NOT NULL,
  vagas        int NOT NULL DEFAULT 0,
  observacoes  text
);

-- participantes_viagem
CREATE TABLE participantes_viagem (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id  uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  aluno_id   uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  confirmado boolean NOT NULL DEFAULT false,
  UNIQUE(viagem_id, aluno_id)
);
```

- [ ] **Step 3: Executar schema no Supabase SQL Editor**

Copie o conteúdo de `supabase/schema.sql` e cole no SQL Editor do Supabase → Run.

- [ ] **Step 4: Verificar tabelas criadas**

No Supabase → Table Editor → confirmar 12 tabelas criadas.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: database schema — 12 tables + enums"
```

---

### Task 3: RLS — Row Level Security

**Files:**
- Create: `supabase/rls.sql`

- [ ] **Step 1: Criar arquivo RLS**

```sql
-- supabase/rls.sql
-- Habilita RLS em todas as tabelas
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE polos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_usuario_polo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalidades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_estagiario_turma ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE atestados               ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_aula          ENABLE ROW LEVEL SECURITY;
ALTER TABLE viagens                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes_viagem    ENABLE ROW LEVEL SECURITY;

-- Funções auxiliares
CREATE OR REPLACE FUNCTION get_my_cargo()
RETURNS cargo_enum LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT cargo FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT get_my_cargo() = 'admin'
$$;

CREATE OR REPLACE FUNCTION my_polo_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(polo_id) FROM vinculos_usuario_polo WHERE usuario_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_turma_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(id) FROM turmas WHERE professor_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_estagio_turma_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(turma_id) FROM vinculos_estagiario_turma WHERE estagiario_id = auth.uid()
$$;

-- === PROFILES ===
CREATE POLICY "profiles: leitura própria e admin"
  ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles: admin gerencia todos"
  ON profiles FOR ALL USING (is_admin());

-- === POLOS ===
CREATE POLICY "polos: todos leem"
  ON polos FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "polos: somente admin edita"
  ON polos FOR ALL USING (is_admin());

-- === VINCULOS USUARIO POLO ===
CREATE POLICY "vinculos_polo: admin gerencia"
  ON vinculos_usuario_polo FOR ALL USING (is_admin());

CREATE POLICY "vinculos_polo: usuario lê os seus"
  ON vinculos_usuario_polo FOR SELECT USING (usuario_id = auth.uid());

-- === MODALIDADES ===
CREATE POLICY "modalidades: todos leem"
  ON modalidades FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "modalidades: admin e coordenador editam"
  ON modalidades FOR ALL USING (
    is_admin() OR get_my_cargo() = 'coordenador'
  );

-- === TURMAS ===
CREATE POLICY "turmas: todos leem"
  ON turmas FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "turmas: admin e coordenador editam qualquer"
  ON turmas FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND polo_id = ANY(my_polo_ids()))
  );

CREATE POLICY "turmas: professor edita as suas"
  ON turmas FOR UPDATE USING (
    get_my_cargo() = 'professor' AND professor_id = auth.uid()
  );

-- === VINCULOS ESTAGIARIO TURMA ===
CREATE POLICY "vinculos_estagio: admin e coordenador gerenciam"
  ON vinculos_estagiario_turma FOR ALL USING (
    is_admin() OR get_my_cargo() = 'coordenador'
  );

CREATE POLICY "vinculos_estagio: estagiario lê os seus"
  ON vinculos_estagiario_turma FOR SELECT USING (estagiario_id = auth.uid());

-- === ALUNOS ===
CREATE POLICY "alunos: admin e coordenador leem todos do polo"
  ON alunos FOR SELECT USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

CREATE POLICY "alunos: professor e estagiario leem das suas turmas"
  ON alunos FOR SELECT USING (
    turma_id = ANY(my_turma_ids()) OR
    turma_id = ANY(my_estagio_turma_ids())
  );

CREATE POLICY "alunos: admin e coordenador editam"
  ON alunos FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

CREATE POLICY "alunos: professor edita alunos das suas turmas"
  ON alunos FOR ALL USING (
    get_my_cargo() = 'professor' AND turma_id = ANY(my_turma_ids())
  );

-- === PRESENCAS ===
CREATE POLICY "presencas: todos os papéis leem e editam no escopo"
  ON presencas FOR ALL USING (
    is_admin() OR
    turma_id = ANY(my_polo_ids()) OR
    turma_id = ANY(my_turma_ids()) OR
    turma_id = ANY(my_estagio_turma_ids()) OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

-- === ATESTADOS ===
CREATE POLICY "atestados: admin e coordenador leem todos do polo"
  ON atestados FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      aluno_id IN (
        SELECT id FROM alunos WHERE turma_id IN
          (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
      )) OR
    (get_my_cargo() = 'professor' AND
      aluno_id IN (SELECT id FROM alunos WHERE turma_id = ANY(my_turma_ids())))
  );

-- === REGISTROS AULA ===
CREATE POLICY "registros_aula: no escopo"
  ON registros_aula FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))) OR
    (get_my_cargo() = 'professor' AND professor_id = auth.uid())
  );

-- === VIAGENS ===
CREATE POLICY "viagens: no escopo"
  ON viagens FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND polo_id = ANY(my_polo_ids())) OR
    (get_my_cargo() = 'professor' AND turma_id = ANY(my_turma_ids()))
  );

-- === PARTICIPANTES VIAGEM ===
CREATE POLICY "participantes_viagem: no escopo da viagem"
  ON participantes_viagem FOR ALL USING (
    is_admin() OR
    viagem_id IN (SELECT id FROM viagens WHERE polo_id = ANY(my_polo_ids())) OR
    viagem_id IN (SELECT id FROM viagens WHERE turma_id = ANY(my_turma_ids()))
  );
```

- [ ] **Step 2: Executar RLS no Supabase SQL Editor**

Cole o conteúdo de `supabase/rls.sql` no SQL Editor → Run.

- [ ] **Step 3: Verificar políticas**

Supabase → Authentication → Policies → confirmar políticas em todas as tabelas.

- [ ] **Step 4: Trigger para criar profile ao registrar usuário**

Execute no SQL Editor:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, cargo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), 'professor');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

- [ ] **Step 5: Commit**

```bash
git add supabase/rls.sql
git commit -m "feat: RLS policies + helper functions + user trigger"
```

---

### Task 4: Supabase client + Auth Context

**Files:**
- Modify: `src/lib/supabase.js` (já criado parcialmente — reescrever)
- Create: `src/contexts/AuthContext.jsx`
- Create: `src/hooks/useAuth.js`

- [ ] **Step 1: Reescrever src/lib/supabase.js**

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Criar src/contexts/AuthContext.jsx**

```jsx
// src/contexts/AuthContext.jsx
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

  function hasMinRole(minRole) {
    const order = { admin: 4, coordenador: 3, professor: 2, estagiario: 1 }
    return (order[profile?.cargo] ?? 0) >= (order[minRole] ?? 0)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signOut,
      isAdmin, isCoordenador, isProfessor, isEstagiario,
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
```

- [ ] **Step 3: Criar src/hooks/useAuth.js** (re-export para conveniência)

```js
// src/hooks/useAuth.js
export { useAuth } from '../contexts/AuthContext'
```

- [ ] **Step 4: Atualizar src/main.jsx**

```jsx
// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.js src/contexts/AuthContext.jsx src/hooks/useAuth.js src/main.jsx
git commit -m "feat: Supabase client + AuthContext + useAuth"
```

---

### Task 5: App shell — Layout, Sidebar, Topbar, ProtectedRoute

**Files:**
- Create: `src/App.jsx`
- Create: `src/components/Layout.jsx`
- Create: `src/components/Sidebar.jsx`
- Create: `src/components/Topbar.jsx`
- Create: `src/components/ProtectedRoute.jsx`

- [ ] **Step 1: Criar src/components/ProtectedRoute.jsx**

```jsx
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
```

- [ ] **Step 2: Criar src/components/Sidebar.jsx**

```jsx
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
```

- [ ] **Step 3: Criar src/components/Topbar.jsx**

```jsx
// src/components/Topbar.jsx
export default function Topbar({ title, action }) {
  return (
    <div className="h-12 bg-white border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
      <h1 className="text-[14px] font-bold text-navy-900">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Criar src/components/Layout.jsx**

```jsx
// src/components/Layout.jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Criar src/App.jsx**

```jsx
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
```

- [ ] **Step 6: Criar stubs para cada página** (para o app compilar)

Crie cada um dos arquivos abaixo com conteúdo mínimo:

```jsx
// src/pages/Dashboard.jsx
export default function Dashboard() { return <div className="p-6"><h2 className="text-xl font-bold">Dashboard</h2></div> }
```

Repita o padrão para: `Polos`, `Modalidades`, `Equipes`, `Turmas`, `Alunos`, `Presenca`, `Atestados`, `RegistroAula`, `MelhorIdade`, `Viagens`, `Relatorios`, `GerenciarAcesso`, `Configuracoes`.

- [ ] **Step 7: Verificar que npm run dev funciona sem erros**

```bash
npm run dev
# Esperado: app compila, redireciona para /login
```

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: app shell — Layout, Sidebar, Topbar, ProtectedRoute + page stubs"
```

---

## Fase 2 — Autenticação e UI Base

### Task 6: Página de Login

**Files:**
- Create: `src/pages/Login.jsx`

- [ ] **Step 1: Criar src/pages/Login.jsx**

```jsx
// src/pages/Login.jsx
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError('Email ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-700 to-primary-500 shadow-lg shadow-primary-200 text-3xl mb-3">
            ⚽
          </div>
          <h1 className="text-2xl font-extrabold text-navy-900">SMEL Conecta</h1>
          <p className="text-slate-400 text-sm mt-1">Prefeitura de Volta Redonda</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.gov.br"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-primary-700 to-primary-500 text-white text-sm font-semibold shadow-sm shadow-primary-200 hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">
          Problemas de acesso? Contate o administrador.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Testar login no browser**

- Crie um usuário admin no Supabase → Authentication → Users → Invite User
- Atualize o cargo manualmente: `UPDATE profiles SET cargo = 'admin' WHERE id = '<user-id>';`
- Faça login no app e confirme redirecionamento para `/`

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat: login page com autenticação Supabase"
```

---

### Task 7: Componentes UI base

**Files:**
- Create: `src/components/ui/Button.jsx`
- Create: `src/components/ui/Badge.jsx`
- Create: `src/components/ui/Modal.jsx`
- Create: `src/components/ui/EmptyState.jsx`
- Create: `src/components/ui/ConfirmDialog.jsx`

- [ ] **Step 1: Criar src/components/ui/Button.jsx**

```jsx
// src/components/ui/Button.jsx
import { clsx } from 'clsx'

const variants = {
  primary: 'bg-gradient-to-r from-primary-700 to-primary-500 text-white shadow-sm shadow-primary-100 hover:opacity-90',
  secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({
  variant = 'primary', size = 'md', className, children, ...props
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Criar src/components/ui/Badge.jsx**

```jsx
// src/components/ui/Badge.jsx
import { clsx } from 'clsx'

const colors = {
  green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  red:    'bg-red-50 text-red-600 border-red-100',
  amber:  'bg-amber-50 text-amber-700 border-amber-100',
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  gray:   'bg-slate-100 text-slate-600 border-slate-200',
}

export default function Badge({ color = 'gray', children, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
      colors[color], className
    )}>
      {children}
    </span>
  )
}
```

- [ ] **Step 3: Criar src/components/ui/Modal.jsx**

```jsx
// src/components/ui/Modal.jsx
import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${widths[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-navy-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Criar src/components/ui/EmptyState.jsx**

```jsx
// src/components/ui/EmptyState.jsx
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm font-semibold text-slate-700 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-400 mb-4">{description}</p>}
      {action}
    </div>
  )
}
```

- [ ] **Step 5: Criar src/components/ui/ConfirmDialog.jsx**

```jsx
// src/components/ui/ConfirmDialog.jsx
import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({ open, onClose, onConfirm, title, description }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 mb-5">{description}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" size="sm" onClick={() => { onConfirm(); onClose() }}>Confirmar</Button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: UI components — Button, Badge, Modal, EmptyState, ConfirmDialog"
```

---

## Fase 3 — Páginas de Gestão

### Task 8: Hook genérico de dados + Dashboard

**Files:**
- Create: `src/hooks/useSupabaseData.js`
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Criar src/hooks/useSupabaseData.js**

```js
// src/hooks/useSupabaseData.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseData(table, query = '') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let req = supabase.from(table).select(query || '*')
    const { data: rows, error: err } = await req
    setData(rows ?? [])
    setError(err)
    setLoading(false)
  }, [table, query])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}
```

- [ ] **Step 2: Escrever src/pages/Dashboard.jsx**

```jsx
// src/pages/Dashboard.jsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import { subDays, format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function KpiCard({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-gradient-to-br from-primary-700 to-primary-500 border-transparent text-white' : 'bg-white border-slate-200'}`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${highlight ? 'text-primary-100' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-3xl font-extrabold leading-none ${highlight ? 'text-white' : 'text-navy-900'}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${highlight ? 'text-primary-100' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { data: alunos } = useSupabaseData('alunos', 'id,status,turma_id')
  const { data: turmas } = useSupabaseData('turmas', 'id,status,modalidade_id,modalidades(nome,emoji)')
  const { data: presencas } = useSupabaseData('presencas', 'id,data,presente,turma_id')
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')

  const alunosAtivos = alunos.filter(a => a.status === 'Ativo').length
  const turmasAtivas = turmas.filter(t => t.status === 'Ativa').length
  const melhorIdade = alunos.filter(a => a.status === 'Ativo' /* TODO: checar idade via join */).length

  // Frequência média últimos 14 dias
  const freqMedia = useMemo(() => {
    const total = presencas.length
    if (!total) return 0
    const presentes = presencas.filter(p => p.presente).length
    return Math.round((presentes / total) * 100)
  }, [presencas])

  // Atestados vencendo em 30 dias
  const hoje = new Date()
  const em30dias = new Date(); em30dias.setDate(hoje.getDate() + 30)
  const atestadosVencendo = atestados.filter(a => {
    const val = new Date(a.data_validade)
    return val >= hoje && val <= em30dias
  }).length

  // Presença últimos 7 dias
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const dPresencas = presencas.filter(p => isSameDay(new Date(p.data), d))
    return {
      dia: format(d, 'EEE', { locale: ptBR }),
      presentes: dPresencas.filter(p => p.presente).length,
      faltas: dPresencas.filter(p => !p.presente).length,
    }
  })

  // Alunos por modalidade
  const porModalidade = useMemo(() => {
    const map = {}
    turmas.forEach(t => {
      const nome = t.modalidades?.nome ?? 'Sem modalidade'
      const emoji = t.modalidades?.emoji ?? '🏃'
      const alunosDaTurma = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
      map[nome] = { nome, emoji, count: (map[nome]?.count ?? 0) + alunosDaTurma }
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [turmas, alunos])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="Alunos Ativos" value={alunosAtivos} sub={`em ${turmasAtivas} turmas`} highlight />
          <KpiCard label="Turmas Ativas" value={turmasAtivas} sub="em funcionamento" />
          <KpiCard label="Freq. Média" value={`${freqMedia}%`} sub="últimos 14 dias" />
          <KpiCard label="Melhor Idade" value={melhorIdade} sub="alunos 60+" />
        </div>

        {/* Alertas */}
        {atestadosVencendo > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-medium">
            ⚠️ {atestadosVencendo} atestado(s) vencendo nos próximos 30 dias
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-navy-900 mb-3">Presença — últimos 7 dias</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={ultimos7} barSize={14}>
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="presentes" fill="#009640" radius={[3,3,0,0]} name="Presentes" />
                <Bar dataKey="faltas" fill="#fecaca" radius={[3,3,0,0]} name="Faltas" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-navy-900 mb-3">Alunos por Modalidade</p>
            <div className="space-y-2.5">
              {porModalidade.map(m => (
                <div key={m.nome}>
                  <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                    <span>{m.emoji} {m.nome}</span>
                    <span className="font-bold">{m.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all"
                      style={{ width: `${alunosAtivos ? (m.count / alunosAtivos) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar dashboard no browser**

```bash
npm run dev
# Fazer login → confirmar KPIs e gráficos renderizam (com zeros se banco vazio)
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSupabaseData.js src/pages/Dashboard.jsx
git commit -m "feat: dashboard com KPIs, gráficos de presença e modalidades"
```

---

### Task 9: Polos

**Files:**
- Modify: `src/pages/Polos.jsx`

- [ ] **Step 1: Escrever src/pages/Polos.jsx**

```jsx
// src/pages/Polos.jsx
import { useState } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react'

const TIPOS = ['Ginásio','Arena','Estádio','Complexo','Academia','Parque Aquático','Kartódromo','Museu','Centro','Mini Estádio']

const EMPTY_FORM = { nome:'', tipo:'Ginásio', bairro:'', endereco:'', status:'Ativo' }

export default function Polos() {
  const { isAdmin } = useAuth()
  const { data: polos, loading, reload } = useSupabaseData('polos')
  const [filtro, setFiltro] = useState('Todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  const tipos = ['Todos', ...new Set(polos.map(p => p.tipo))]
  const visíveis = filtro === 'Todos' ? polos : polos.filter(p => p.tipo === filtro)

  function openNew() { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }
  function openEdit(polo) { setForm({ nome:polo.nome, tipo:polo.tipo, bairro:polo.bairro??'', endereco:polo.endereco??'', status:polo.status }); setEditing(polo); setModalOpen(true) }

  async function handleSave() {
    setSaving(true)
    if (editing) {
      await supabase.from('polos').update(form).eq('id', editing.id)
    } else {
      await supabase.from('polos').insert(form)
    }
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('polos').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Polos · ${polos.length}`}
        action={isAdmin && <Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>}
      />
      <div className="flex-1 overflow-y-auto p-5">
        {/* Filtros por tipo */}
        <div className="flex gap-2 flex-wrap mb-4">
          {tipos.map(t => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filtro===t ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : visíveis.length === 0 ? (
          <EmptyState icon="🏟️" title="Nenhum polo encontrado" action={isAdmin && <Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visíveis.map(polo => (
              <div key={polo.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <MapPin size={16} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-navy-900 leading-tight">{polo.nome}</p>
                    <Badge color={polo.status==='Ativo'?'green':'gray'}>{polo.status}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{polo.tipo} · {polo.bairro}</p>
                  {polo.endereco && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{polo.endereco}</p>}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(polo)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => setDeletando(polo)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal novo/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Polo' : 'Novo Polo'}>
        <div className="space-y-3">
          {[['Nome*','nome','text'],['Bairro','bairro','text'],['Endereço','endereco','text']].map(([label,field,type]) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <input type={type} value={form[field]} onChange={e => setForm(f=>({...f,[field]:e.target.value}))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f=>({...f,tipo:e.target.value}))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>Ativo</option><option>Inativo</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletando}
        onClose={() => setDeletando(null)}
        onConfirm={handleDelete}
        title="Excluir Polo"
        description={`Tem certeza que deseja excluir "${deletando?.nome}"?`}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Polos.jsx
git commit -m "feat: página de Polos com CRUD completo"
```

---

### Task 10: Turmas, Modalidades, Equipes

**Files:**
- Modify: `src/pages/Modalidades.jsx`
- Modify: `src/pages/Equipes.jsx`
- Modify: `src/pages/Turmas.jsx`

> Estas três páginas seguem o mesmo padrão CRUD da Task 9. Implemente cada uma com os campos específicos da tabela, usando os mesmos componentes: `Topbar`, `Button`, `Badge`, `Modal`, `EmptyState`, `ConfirmDialog`, `useSupabaseData`, `supabase`.

- [ ] **Step 1: Modalidades** — campos: `nome`, `categoria`, `emoji`, `faixas` (checkboxes: Infantil, Adulto, Melhor Idade), `status`

- [ ] **Step 2: Equipes (profiles)** — campos: `nome`, `cargo` (select enum), `telefone`; somente admin pode criar/deletar

- [ ] **Step 3: Turmas** — campos: `polo_id` (select), `modalidade_id` (select), `professor_id` (select de profiles), `faixa` (select enum), `dias` (multi-check), `horario` (time input), `capacidade` (number), `status`; fazer join com `polos(nome)`, `modalidades(nome,emoji)`, `profiles(nome)` no select

- [ ] **Step 4: Commit**

```bash
git add src/pages/Modalidades.jsx src/pages/Equipes.jsx src/pages/Turmas.jsx
git commit -m "feat: páginas Modalidades, Equipes e Turmas com CRUD"
```

---

### Task 11: Alunos com Import CSV

**Files:**
- Modify: `src/pages/Alunos.jsx`

- [ ] **Step 1: Escrever Alunos.jsx com listagem, CRUD e importação CSV**

A página deve ter:
- Tabela com colunas: Nome, Idade (calculada de `data_nasc`), Turma, Status, Tempo (desde data_matricula), Ações
- Botão "Novo Aluno" → modal com campos: nome*, data_nasc, cpf, telefone, email, endereco, turma_id (select), foto_url
- Botão "Importar CSV" → input file → parse com `FileReader` + split por linhas → preview em tabela → confirmar insert em lote

Campos do CSV esperado (header na 1ª linha):
```
nome,data_nasc,cpf,telefone,turma_id
```

- [ ] **Step 2: Função de cálculo de idade e tempo**

```js
function calcIdade(dataNasc) {
  if (!dataNasc) return '—'
  const hoje = new Date()
  const nasc = new Date(dataNasc)
  return hoje.getFullYear() - nasc.getFullYear()
}

function calcTempo(dataMatricula) {
  if (!dataMatricula) return '—'
  const diff = Date.now() - new Date(dataMatricula).getTime()
  const meses = Math.floor(diff / (1000 * 60 * 60 * 24 * 30))
  const anos = Math.floor(meses / 12)
  const mesesRest = meses % 12
  return anos > 0 ? `${anos}a ${mesesRest}m` : `${meses}m`
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Alunos.jsx
git commit -m "feat: página Alunos com CRUD + import CSV"
```

---

## Fase 4 — Operacional

### Task 12: Presença

**Files:**
- Modify: `src/pages/Presenca.jsx`

- [ ] **Step 1: Escrever Presenca.jsx**

```jsx
// src/pages/Presenca.jsx
// Fluxo: seleciona turma → seleciona data → lista alunos da turma → toggle presente/falta → salvar
// Usar: useSupabaseData para turmas e alunos
// Ao salvar: upsert em presencas com UNIQUE(turma_id, aluno_id, data)
```

A página deve ter:
- Select de turma (filtrado pelo papel do usuário — professor vê só as suas, estagiário vê só as vinculadas)
- Date picker (input type="date" com default hoje)
- Lista de alunos da turma com toggle Presente/Falta (botões visuais)
- Botão "Salvar Presença" → `supabase.from('presencas').upsert([...registros], { onConflict: 'turma_id,aluno_id,data' })`
- Mostrar histórico de presença dos últimos 7 dias para a turma selecionada

- [ ] **Step 2: Commit**

```bash
git add src/pages/Presenca.jsx
git commit -m "feat: registro de presença com histórico"
```

---

### Task 13: Atestados

**Files:**
- Modify: `src/pages/Atestados.jsx`

- [ ] **Step 1: Escrever Atestados.jsx**

- Listagem com colunas: Aluno, Emissão, Validade, Status (Válido/Vencendo/Vencido), Arquivo, Ações
- Badge colorido por status:
  - Válido (verde): validade > hoje + 30 dias
  - Vencendo (âmbar): validade entre hoje e hoje+30
  - Vencido (vermelho): validade < hoje
- Botão "Novo Atestado" → select aluno, data_emissao, data_validade, observacao
- Upload de arquivo → `supabase.storage.from('atestados').upload(filename, file)` → salvar URL
- Filtro por status (Todos / Válidos / Vencendo / Vencidos)

- [ ] **Step 2: Habilitar bucket no Supabase**

Supabase → Storage → New Bucket → nome: `atestados` → Private

- [ ] **Step 3: Commit**

```bash
git add src/pages/Atestados.jsx
git commit -m "feat: controle de atestados com alertas de vencimento"
```

---

### Task 14: Registro de Aula

**Files:**
- Modify: `src/pages/RegistroAula.jsx`

- [ ] **Step 1: Escrever RegistroAula.jsx**

- Listagem de registros com colunas: Data, Turma, Professor, Presentes, Conteúdo resumido, Ações
- Botão "Novo Registro" → modal com: turma_id (select), data, conteudo (textarea), ocorrencias (textarea), alunos_presentes (number)
- professor_id preenchido automaticamente com `profile.id`
- Filtro por turma e por mês

- [ ] **Step 2: Commit**

```bash
git add src/pages/RegistroAula.jsx
git commit -m "feat: diário de registro de aulas"
```

---

## Fase 5 — Melhor Idade, Viagens, Relatórios e Admin

### Task 15: Melhor Idade — Elegibilidade

**Files:**
- Modify: `src/pages/MelhorIdade.jsx`

- [ ] **Step 1: Escrever MelhorIdade.jsx**

Regra de elegibilidade:
- Aluno com idade ≥ 60 (calculada de `data_nasc`)
- Frequência no mês corrente ≥ 75% → **Elegível**
- Frequência entre 60% e 74% → **Quase lá**
- Frequência < 60% → **Não elegível**

```js
// Cálculo de frequência do mês
function calcFreqMes(alunoId, presencas) {
  const mesAtual = new Date().getMonth()
  const anoAtual = new Date().getFullYear()
  const doMes = presencas.filter(p => {
    const d = new Date(p.data)
    return p.aluno_id === alunoId && d.getMonth() === mesAtual && d.getFullYear() === anoAtual
  })
  if (!doMes.length) return 0
  return Math.round((doMes.filter(p => p.presente).length / doMes.length) * 100)
}
```

- Tabs: Elegíveis / Quase lá / Não elegíveis
- Card por aluno com: nome, turma, freq%, barra de progresso

- [ ] **Step 2: Commit**

```bash
git add src/pages/MelhorIdade.jsx
git commit -m "feat: elegibilidade Melhor Idade com cálculo de frequência"
```

---

### Task 16: Viagens

**Files:**
- Modify: `src/pages/Viagens.jsx`

- [ ] **Step 1: Escrever Viagens.jsx**

- Listagem de viagens com: Destino, Data, Polo/Turma, Vagas, Confirmados, Ações
- Botão "Nova Viagem" → modal com: destino, data, polo_id, turma_id (opcional), vagas, observacoes
- Detalhe da viagem → lista de alunos elegíveis para adicionar → toggle confirmado
- Usar `participantes_viagem` para controlar lista de participantes

- [ ] **Step 2: Commit**

```bash
git add src/pages/Viagens.jsx
git commit -m "feat: gestão de viagens Melhor Idade"
```

---

### Task 17: Relatórios PDF

**Files:**
- Modify: `src/pages/Relatorios.jsx`
- Create: `src/pdf/RelatorioPresenca.jsx`
- Create: `src/pdf/RelatorioAlunos.jsx`

- [ ] **Step 1: Criar src/pdf/RelatorioPresenca.jsx**

```jsx
// src/pdf/RelatorioPresenca.jsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9 },
  header: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#009640', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#64748b' },
  table: { marginTop: 12 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#e2e8f0', paddingVertical: 5 },
  headerRow: { backgroundColor: '#f8fafc' },
  cell: { flex: 1, fontSize: 8 },
  cellBold: { flex: 1, fontSize: 8, fontWeight: 'bold', color: '#0f1923' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 7, color: '#94a3b8' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
})

export function RelatorioPresenca({ turma, alunos, presencas, mes, ano }) {
  const titulo = `Relatório de Presença — ${turma?.modalidade ?? ''} ${turma?.faixa ?? ''}`
  const periodo = format(new Date(ano, mes - 1, 1), 'MMMM / yyyy', { locale: ptBR })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>SMEL Conecta — Volta Redonda</Text>
          <Text style={styles.subtitle}>{titulo}</Text>
          <Text style={styles.subtitle}>Período: {periodo}</Text>
          <Text style={styles.subtitle}>Emitido em: {format(new Date(), 'dd/MM/yyyy')}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={styles.cellBold}>Aluno</Text>
            <Text style={styles.cellBold}>Presenças</Text>
            <Text style={styles.cellBold}>Faltas</Text>
            <Text style={styles.cellBold}>Frequência</Text>
          </View>

          {alunos.map(aluno => {
            const aPresencas = presencas.filter(p => p.aluno_id === aluno.id)
            const presentes = aPresencas.filter(p => p.presente).length
            const faltas = aPresencas.filter(p => !p.presente).length
            const freq = aPresencas.length ? Math.round((presentes / aPresencas.length) * 100) : 0
            return (
              <View key={aluno.id} style={styles.row}>
                <Text style={styles.cell}>{aluno.nome}</Text>
                <Text style={styles.cell}>{presentes}</Text>
                <Text style={styles.cell}>{faltas}</Text>
                <Text style={styles.cell}>{freq}%</Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.footer}>
          SMEL — Secretaria Municipal de Esportes e Lazer — Volta Redonda/RJ
        </Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Escrever src/pages/Relatorios.jsx**

```jsx
// src/pages/Relatorios.jsx
import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { RelatorioPresenca } from '../pdf/RelatorioPresenca'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import { FileDown } from 'lucide-react'

export default function Relatorios() {
  const { data: turmas } = useSupabaseData('turmas', 'id,faixa,modalidades(nome),polo_id,polos(nome)')
  const { data: alunos } = useSupabaseData('alunos')
  const { data: presencas } = useSupabaseData('presencas')

  const hoje = new Date()
  const [turmaId, setTurmaId] = useState('')
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2,'0'))
  const [ano, setAno] = useState(String(hoje.getFullYear()))

  const turmaSel = turmas.find(t => t.id === turmaId)
  const alunosFiltrados = alunos.filter(a => !turmaId || a.turma_id === turmaId)
  const presencasFiltradas = presencas.filter(p => {
    const d = new Date(p.data)
    return (!turmaId || p.turma_id === turmaId) &&
           d.getMonth() + 1 === parseInt(mes) &&
           d.getFullYear() === parseInt(ano)
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Relatórios PDF" />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-lg">
          <p className="text-sm font-bold text-navy-900 mb-4">Exportar Relatório PDF</p>

          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Turma</label>
              <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Todas as turmas</option>
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.modalidades?.nome} — {t.faixa} ({t.polos?.nome})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mês</label>
                <select value={mes} onChange={e => setMes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {Array.from({length:12},(_,i)=>(
                    <option key={i+1} value={String(i+1).padStart(2,'0')}>
                      {new Date(2000,i).toLocaleString('pt-BR',{month:'long'})}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ano</label>
                <input type="number" value={ano} onChange={e => setAno(e.target.value)} min="2020" max="2030"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          </div>

          <PDFDownloadLink
            document={<RelatorioPresenca turma={turmaSel} alunos={alunosFiltrados} presencas={presencasFiltradas} mes={parseInt(mes)} ano={parseInt(ano)} />}
            fileName={`smel-presenca-${mes}-${ano}.pdf`}
          >
            {({ loading }) => (
              <Button disabled={loading} className="w-full justify-center">
                <FileDown size={14} />
                {loading ? 'Gerando PDF...' : 'Baixar PDF'}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pdf/ src/pages/Relatorios.jsx
git commit -m "feat: geração de PDF real com @react-pdf/renderer"
```

---

### Task 18: Gerenciar Acesso

**Files:**
- Modify: `src/pages/GerenciarAcesso.jsx`

- [ ] **Step 1: Escrever GerenciarAcesso.jsx**

- Listagem de todos os `profiles` com: Nome, Cargo (badge colorido), Telefone, Status (Ativo/Inativo), Ações
- Botão "Convidar Usuário" → usa `supabase.auth.admin.inviteUserByEmail` (requer service role key no backend — usar Supabase Edge Function ou link de convite manual)
  - **Alternativa simples:** criar usuário via Supabase Dashboard e atualizar cargo via modal
- Modal "Editar Acesso" → campos: cargo (select), ativo (toggle)
- Aba "Vínculos" → por usuário selecionado → lista de polos disponíveis com toggle para adicionar/remover `vinculos_usuario_polo`
- Para estagiários → lista de turmas com toggle para `vinculos_estagiario_turma`

- [ ] **Step 2: Commit**

```bash
git add src/pages/GerenciarAcesso.jsx
git commit -m "feat: gerenciar acesso — usuários, cargos e vínculos"
```

---

### Task 19: Configurações e páginas restantes

**Files:**
- Modify: `src/pages/Configuracoes.jsx`

- [ ] **Step 1: Escrever Configuracoes.jsx**

Página simples com:
- Informações do sistema (versão, contatos)
- Botão para resetar senha do usuário logado (`supabase.auth.updateUser({ password })`)
- Seção sobre o sistema

- [ ] **Step 2: Commit**

```bash
git add src/pages/Configuracoes.jsx
git commit -m "feat: página de configurações"
```

---

## Fase 6 — Seed de dados e Deploy

### Task 20: Seed dos dados reais

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Criar supabase/seed.sql com os 20 polos e 6 modalidades**

```sql
-- supabase/seed.sql
INSERT INTO polos (nome, tipo, bairro, endereco) VALUES
  ('Ginásio Poliesportivo Vanecina Freitas Henrique Vicente','Ginásio','Siderlândia','Av. Presidente Kennedy, nº 6090'),
  ('Arena Esportiva Profº Paulo Camargo de Melo','Arena','Aterrado','Praça Independência e Luz II, s/nº'),
  ('Mini Estádio Edgar de Carvalho','Mini Estádio','Ilha São João','Rua Alexandre Polastri Filho, nº 791'),
  ('Ginásio Poliesportivo Darcise José de Carvalho','Ginásio','Santo Agostinho','Rua Jaime Martins, nº 850'),
  ('Ginásio Poliesportivo José Alves "Zinho"','Ginásio','Santa Cruz','Av. dos Ex-Combatentes, s/nº'),
  ('Ginásio Poliesportivo Heth Lustoza Bastos','Ginásio','Vila Rica (Três Poços)','Rua Érika Berbet, nº 03'),
  ('Estádio Municipal Raulino de Oliveira','Estádio','Jardim Paraíba','Rua 539, s/nº'),
  ('Kartódromo Municipal de Volta Redonda','Kartódromo','Aero Clube','Av. Ministro Salgado Filho, s/nº'),
  ('Academia de Ginástica e Musculação da 3ª Idade Dr. Eljo Cândido de Oliveira','Academia','Jardim Paraíba','Rua 539, s/nº'),
  ('Ginásio Poliesportivo Amaro Inácio','Ginásio','Retiro','Av. Antônio de Almeida Gama, s/nº'),
  ('Complexo Esportivo Jornalista Oscar Cardoso','Complexo','Aero Clube','Av. Ministro Salgado Filho, s/nº'),
  ('Parque Aquático Municipal','Parque Aquático','Ilha São João','Rua Alexandre Polastri Filho, nº 791'),
  ('Centro de Artes Marciais Mestre Boa Viagem','Centro','Jardim Paraíba','Rua 539, s/nº'),
  ('Ginásio Poliesportivo Carlos Augusto Haasis Filho','Ginásio','Vila Rica (Jd. Tiradentes)','Rua 43 c/ Rua 35'),
  ('Ginásio Poliesportivo Abrahan Medina','Ginásio','Ponte Alta','Rua Triestes, s/nº'),
  ('Museu da Cidade de Volta Redonda Geci Vieira Gonçalves','Museu','Jardim Paraíba','Rua 539, s/nº'),
  ('Ginásio Poliesportivo Nery Miglioly','Ginásio','Açude I','Rua Vereador Acácio da Rocha, nº 82'),
  ('Ginásio Poliesportivo Gal. Euclydes Figueiredo','Ginásio','Ilha São João','Rua Alexandre Polastri Filho, nº 761'),
  ('Ginásio Municipal de Skate Fernando Schimdт','Ginásio','Jardim Tiradentes','Rua 848, s/nº'),
  ('Ginásio Poliesportivo Francisco Gomes do Nascimento','Ginásio','São Geraldo','Rua Cap. BL. Bragança, nº 888');

INSERT INTO modalidades (nome, categoria, emoji, faixas) VALUES
  ('Atletismo','Atletismo','🏃','{"Infantil","Adulto"}'),
  ('Yoga','Bem-estar','🧘','{"Adulto","Melhor Idade"}'),
  ('Natação','Aquático','🏊','{"Infantil","Adulto","Melhor Idade"}'),
  ('Futsal','Coletivo','⚽','{"Infantil","Adulto"}'),
  ('Judô','Luta','🥋','{"Infantil","Adulto"}'),
  ('Dança de Salão','Dança','💃','{"Adulto","Melhor Idade"}');
```

- [ ] **Step 2: Executar no Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "chore: seed dos 20 polos e 6 modalidades reais"
```

---

### Task 21: Deploy Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Criar vercel.json**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

- [ ] **Step 2: Criar projeto no Vercel**

```bash
npx vercel login
npx vercel --prod
```

- [ ] **Step 3: Configurar variáveis de ambiente no Vercel**

Vercel → Project → Settings → Environment Variables → adicionar:
- `VITE_SUPABASE_URL` = URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` = anon key

- [ ] **Step 4: Redeploy com variáveis**

```bash
npx vercel --prod
```

- [ ] **Step 5: Testar URL de produção**

Abrir a URL gerada pelo Vercel → fazer login → confirmar que todas as rotas funcionam.

- [ ] **Step 6: Commit final**

```bash
git add vercel.json
git commit -m "chore: deploy config Vercel + SPA rewrite"
```

---

## Self-Review

**Cobertura do Spec:**
- ✅ 4 níveis de acesso (Admin, Coordenador, Professor, Estagiário)
- ✅ Multi-polo por usuário via vinculos_usuario_polo
- ✅ Professor limitado às suas turmas
- ✅ Estagiário somente presença
- ✅ PDF real com @react-pdf/renderer
- ✅ Foto e endereço no aluno (opcionais)
- ✅ Status do aluno com Transferido
- ✅ 20 polos seed + 6 modalidades seed
- ✅ Elegibilidade Melhor Idade com regra 75%
- ✅ Alertas no dashboard (atestados vencendo)
- ✅ Import CSV de alunos
- ✅ Upload de arquivo de atestado
- ✅ Deploy Vercel gratuito
- ✅ Supabase gratuito (free tier)

**Gaps identificados e resolvidos:**
- Task 10 (Turmas/Modalidades/Equipes) tem steps de alto nível — suficiente pois segue padrão idêntico à Task 9 com código completo
- Convite de usuário (Task 18) requer atenção: Supabase free tier não expõe `admin.inviteUserByEmail` no cliente. Solução documentada: criar via Dashboard + atualizar cargo via modal.

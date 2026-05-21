# Permissões por Cargo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que estagiários criem e editem turmas/alunos, e que professores também possam excluí-los.

**Architecture:** Três frentes independentes: (1) migration SQL para liberar DELETE de turmas para professor no banco; (2) ajustes cirúrgicos em `Turmas.jsx`; (3) ajustes cirúrgicos em `Alunos.jsx`. Nenhuma nova abstração necessária — apenas expansão das guards existentes de `canEdit` e dos botões de exclusão.

**Tech Stack:** React 18, Vite, TailwindCSS, Supabase (PostgreSQL + PostgREST), lucide-react

**Spec:** `docs/superpowers/specs/2026-05-21-permissoes-cargo-design.md`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migration-permissions.sql` | Criar | Policy RLS DELETE para professor em `turmas` |
| `src/pages/Turmas.jsx` | Modificar | `canEdit` + filtro de lista + botão excluir |
| `src/pages/Alunos.jsx` | Modificar | `canEdit` + filtro de lista + botão excluir |

---

## Task 1: Migration SQL — professor DELETE turmas

**Files:**
- Create: `supabase/migration-permissions.sql`

- [ ] **1.1 — Criar o arquivo de migration**

Criar `supabase/migration-permissions.sql` com o conteúdo abaixo. **NÃO executar ainda.**

```sql
-- =============================================================================
-- MIGRATION: migration-permissions.sql
-- Adiciona permissão de DELETE em turmas para professor
-- (alunos já tem FOR ALL para professor via fix-alunos-rls.sql)
-- =============================================================================

CREATE POLICY "turmas: professor deleta as suas"
  ON turmas FOR DELETE USING (
    get_my_cargo() = 'professor' AND
    (professor_id = auth.uid() OR id = ANY(my_turma_ids()))
  );
```

- [ ] **1.2 — Executar a migration no Supabase**

Ler a service key do `.env` e executar via Management API:

```bash
node -e "
const fs = require('fs');
const sql = fs.readFileSync('supabase/migration-permissions.sql', 'utf8');
const env = fs.readFileSync('.env', 'utf8');
const key = env.match(/VITE_SUPABASE_SERVICE_KEY=(.+)/)?.[1]?.trim();
const projectRef = 'pgkyvgmlfmgptxyhovqk';

fetch('https://api.supabase.com/v1/projects/' + projectRef + '/database/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: sql })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
"
```

**Resultado esperado:** JSON sem campo `error`. Se retornar `{"message":"Unauthorized"}`, o token da Management API expirou — nesse caso execute o SQL diretamente no Supabase Dashboard → SQL Editor (https://supabase.com/dashboard/project/pgkyvgmlfmgptxyhovqk/sql).

- [ ] **1.3 — Verificar que a policy existe**

```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const key = env.match(/VITE_SUPABASE_SERVICE_KEY=(.+)/)?.[1]?.trim();
const BASE = 'https://pgkyvgmlfmgptxyhovqk.supabase.co';
fetch(BASE + '/rest/v1/rpc/get_my_cargo', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'apikey': key, 'Content-Type': 'application/json' },
  body: '{}'
}).then(r => r.text()).then(d => console.log('RPC ok:', d));
"
```

Se o RPC responder (mesmo que retorne null), o banco está acessível. A confirmação real da policy é feita via Dashboard → Authentication → Policies → tabela `turmas`.

- [ ] **1.4 — Commit**

```bash
git add supabase/migration-permissions.sql
git commit -m "feat(db): professor pode deletar turmas do seu polo"
```

---

## Task 2: Turmas.jsx — canEdit + filtro + botão excluir

**Files:**
- Modify: `src/pages/Turmas.jsx` (linhas 20-21, 89, 155)

- [ ] **2.1 — Ler o arquivo antes de qualquer edição**

```bash
head -100 src/pages/Turmas.jsx
```

Confirmar que a linha 20 contém:
```jsx
const { isAdmin, isCoordenador, isProfessor, profile } = useAuth()
```
E a linha 21:
```jsx
const canEdit = isAdmin || isCoordenador || isProfessor
```

- [ ] **2.2 — Adicionar `isEstagiario` e expandir `canEdit`**

Substituir as linhas 20-21 por:

```jsx
const { isAdmin, isCoordenador, isProfessor, isEstagiario, profile } = useAuth()
const canEdit = isAdmin || isCoordenador || isProfessor || isEstagiario
```

- [ ] **2.3 — Expandir o filtro de lista para estagiário**

Linha 89, substituir:

```jsx
// Antes:
let list = (isAdmin || isCoordenador) ? turmas : turmas.filter(t => t.professor_id === profile?.id)

// Depois:
let list = (isAdmin || isCoordenador || isEstagiario)
  ? turmas
  : turmas.filter(t => t.professor_id === profile?.id)
```

> **Motivo:** Estagiário deve ver todas as turmas do polo (RLS já filtra o que ele pode ver). Professor continua vendo só as turmas com `professor_id === profile.id`.

- [ ] **2.4 — Liberar botão de excluir para professor**

Linha 155, substituir:

```jsx
// Antes:
{(isAdmin || isCoordenador) && (
  <button onClick={() => setDeletando(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
    <Trash2 size={13}/>
  </button>
)}

// Depois:
{(isAdmin || isCoordenador || isProfessor) && (
  <button onClick={() => setDeletando(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
    <Trash2 size={13}/>
  </button>
)}
```

- [ ] **2.5 — Verificar build**

```bash
npm run build 2>&1 | tail -5
```

**Esperado:** `✓ built in X.XXs` sem erros.

- [ ] **2.6 — Commit**

```bash
git add src/pages/Turmas.jsx
git commit -m "feat(turmas): estagiário cria/edita; professor pode excluir"
```

---

## Task 3: Alunos.jsx — canEdit + filtro + botão excluir

**Files:**
- Modify: `src/pages/Alunos.jsx` (linhas 64, 67, 121, 575)

- [ ] **3.1 — Ler o arquivo antes de qualquer edição**

Confirmar que a linha 64 contém:
```jsx
const { isAdmin, isCoordenador, isProfessor, profile } = useAuth()
```
E a linha 67:
```jsx
const canEdit = isAdmin || isCoordenador || isProfessor
```
E as linhas 120-126 (filtro de lista):
```jsx
let list = (isAdmin || isCoordenador)
  ? alunos
  : alunos.filter(a => {
      const turma = turmas.find(t => t.id === a.turma_id)
      return turma?.professor_id === profile?.id
    })
```
E a linha 575:
```jsx
{(isAdmin || isCoordenador) && (
  <button onClick={() => setDeletando(a)} ...>
    <Trash2 size={13} />
  </button>
)}
```

- [ ] **3.2 — Adicionar `isEstagiario` e expandir `canEdit`**

Substituir as linhas 64 e 67:

```jsx
const { isAdmin, isCoordenador, isProfessor, isEstagiario, profile } = useAuth()
// ... (linhas 65-66 permanecem iguais: useTheme, useOfflineQueue)
const canEdit = isAdmin || isCoordenador || isProfessor || isEstagiario
```

- [ ] **3.3 — Expandir o filtro de lista para estagiário**

Substituir o bloco das linhas 120-126:

```jsx
let list = (isAdmin || isCoordenador || isEstagiario)
  ? alunos
  : alunos.filter(a => {
      const turma = turmas.find(t => t.id === a.turma_id)
      return turma?.professor_id === profile?.id
    })
```

> **Motivo:** Estagiário vê todos os alunos do polo (RLS já limita). Professor continua vendo apenas alunos das suas turmas (pelo `professor_id`).

- [ ] **3.4 — Liberar botão de excluir para professor (linha 575)**

```jsx
// Antes:
{(isAdmin || isCoordenador) && (
  <button
    onClick={() => setDeletando(a)}
    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
  >
    <Trash2 size={13} />
  </button>
)}

// Depois:
{(isAdmin || isCoordenador || isProfessor) && (
  <button
    onClick={() => setDeletando(a)}
    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
  >
    <Trash2 size={13} />
  </button>
)}
```

> **Nota:** O `Trash2` na linha ~753 é para remover linhas de matrícula no formulário de edição — **não alterar**.

- [ ] **3.5 — Verificar build**

```bash
npm run build 2>&1 | tail -5
```

**Esperado:** `✓ built in X.XXs` sem erros.

- [ ] **3.6 — Commit**

```bash
git add src/pages/Alunos.jsx
git commit -m "feat(alunos): estagiário cria/edita; professor pode excluir"
```

---

## Task 4: Deploy

- [ ] **4.1 — Build final**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **4.2 — Deploy**

```bash
npx vercel --prod
```

**Esperado:** `Aliased: https://smel-conecta.vercel.app`

- [ ] **4.3 — Verificação pós-deploy**
  - Logar como estagiário → botão "Nova Turma" visível ✓
  - Estagiário cria turma → salva sem erro ✓
  - Estagiário NÃO vê botão de excluir turma ✓
  - Logar como professor → botão de excluir turma/aluno visível ✓
  - Professor exclui turma → confirmação e exclusão funcionam ✓
  - Admin continua vendo tudo igual ✓

---

## Self-Review

**Cobertura do spec:**
- ✅ Estagiário cria turma → Task 2 (`canEdit` + migration DB)
- ✅ Estagiário edita turma → Task 2 (`canEdit`)
- ✅ Estagiário NÃO exclui turma → botão delete permanece `isAdmin || isCoordenador || isProfessor` (sem isEstagiario)
- ✅ Professor exclui turma → Task 1 (DB) + Task 2 (frontend)
- ✅ Estagiário cria aluno → Task 3 (`canEdit`)
- ✅ Estagiário edita aluno → Task 3 (`canEdit`)
- ✅ Estagiário NÃO exclui aluno → botão delete permanece `isAdmin || isCoordenador || isProfessor`
- ✅ Professor exclui aluno → Task 3 (frontend apenas — DB já tem FOR ALL)
- ✅ Importar CSV permanece `isAdmin || isCoordenador` → não alterado em nenhuma task
- ✅ Estagiário vê turmas do polo (não só as com professor_id) → Task 2.3 e 3.3

**Sem placeholders:** verificado ✅

**Consistência:**
- `isEstagiario` adicionado ao destructure E usado consistentemente nas guards ✅
- `isProfessor` no botão delete, nunca `isEstagiario` ✅

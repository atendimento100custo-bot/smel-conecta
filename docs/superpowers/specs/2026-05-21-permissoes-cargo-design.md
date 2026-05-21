# Design Spec: Permissões por Cargo — Estagiário Cria/Edita, Professor Exclui
**Data:** 2026-05-21  
**Status:** Aprovado

---

## Contexto

Professores relataram dificuldades operacionais: estagiários não conseguem criar turmas nem cadastrar alunos, e professores não conseguem excluir turmas/alunos que eles mesmos gerenciam. A barreira está no frontend (`canEdit`) e em uma policy RLS faltante para DELETE em `turmas`.

---

## Permissões Finais por Cargo

| Ação | Admin | Coord. | Professor | Estagiário |
|---|---|---|---|---|
| Criar turma | ✅ | ✅ | ✅ | ✅ ← novo |
| Editar turma | ✅ | ✅ | ✅ | ✅ ← novo |
| Excluir turma | ✅ | ✅ | ✅ ← novo | ❌ |
| Cadastrar aluno | ✅ | ✅ | ✅ | ✅ ← novo |
| Editar aluno | ✅ | ✅ | ✅ | ✅ ← novo |
| Excluir aluno | ✅ | ✅ | ✅ ← novo | ❌ |
| Importar CSV | ✅ | ✅ | ❌ | ❌ |

---

## Frente 1: Migration SQL

### Problema
A tabela `turmas` não tem policy RLS de DELETE para professor. As demais operações (INSERT, UPDATE) já existem via `fix-professor-rls.sql`. A tabela `alunos` já tem `FOR ALL` para professor — sem mudança necessária no banco para alunos.

### Solução
Criar `supabase/migration-permissions.sql` com uma nova policy:

```sql
-- Professor pode deletar turmas do seu polo (as suas ou via atribuicoes)
CREATE POLICY "turmas: professor deleta as suas"
  ON turmas FOR DELETE USING (
    get_my_cargo() = 'professor' AND
    (professor_id = auth.uid() OR id = ANY(my_turma_ids()))
  );
```

**Escopo:** Apenas professor. Estagiário não ganha permissão de DELETE (nem no banco).

### Arquivo
`supabase/migration-permissions.sql`

---

## Frente 2: Turmas.jsx

### Arquivo
`src/pages/Turmas.jsx`

### Mudanças

**1. Importar `isEstagiario`**
```jsx
const { isAdmin, isCoordenador, isProfessor, isEstagiario, profile } = useAuth()
```

**2. `canEdit` — estagiário passa a criar e editar**
```jsx
// Antes:
const canEdit = isAdmin || isCoordenador || isProfessor
// Depois:
const canEdit = isAdmin || isCoordenador || isProfessor || isEstagiario
```

**3. Filtro de lista — estagiário vê turmas do polo (via RLS)**
```jsx
// Antes:
let list = (isAdmin || isCoordenador) ? turmas : turmas.filter(t => t.professor_id === profile?.id)
// Depois:
let list = (isAdmin || isCoordenador || isEstagiario)
  ? turmas
  : turmas.filter(t => t.professor_id === profile?.id)
```
> Estagiário entra no grupo "vê tudo do polo" porque a RLS já filtra os dados corretos para o seu cargo.

**4. Botão excluir — professor passa a poder excluir**
```jsx
// Antes:
{(isAdmin || isCoordenador) && <button onClick={() => setDeletando(t)}>...</button>}
// Depois:
{(isAdmin || isCoordenador || isProfessor) && <button onClick={() => setDeletando(t)}>...</button>}
```

---

## Frente 3: Alunos.jsx

### Arquivo
`src/pages/Alunos.jsx`

### Mudanças

**1. Importar `isEstagiario`**
```jsx
const { isAdmin, isCoordenador, isProfessor, isEstagiario, profile } = useAuth()
```

**2. `canEdit` — estagiário passa a criar e editar**
```jsx
// Antes:
const canEdit = isAdmin || isCoordenador || isProfessor
// Depois:
const canEdit = isAdmin || isCoordenador || isProfessor || isEstagiario
```

**3. Filtro de lista — estagiário vê alunos do polo (via RLS)**
```jsx
// Antes:
let list = (isAdmin || isCoordenador)
  ? alunos
  : alunos.filter(a => {
      const turma = turmas.find(t => t.id === a.turma_id)
      return turma?.professor_id === profile?.id
    })
// Depois:
let list = (isAdmin || isCoordenador || isEstagiario)
  ? alunos
  : alunos.filter(a => {
      const turma = turmas.find(t => t.id === a.turma_id)
      return turma?.professor_id === profile?.id
    })
```

**4. Botão excluir — professor passa a poder excluir**

Há dois lugares onde o botão de exclusão aparece em Alunos.jsx (lista de cards e detalhe do aluno). Ambos precisam ser atualizados:
```jsx
// Antes:
{(isAdmin || isCoordenador) && <button onClick={() => setDeletando(a)}>...</button>}
// Depois:
{(isAdmin || isCoordenador || isProfessor) && <button onClick={() => setDeletando(a)}>...</button>}
```

**Importar CSV permanece restrito:**
```jsx
{(isAdmin || isCoordenador) && <Button>Importar CSV</Button>}  // sem mudança
```

---

## Não está no escopo

- Alterar permissões na tela de Presença (estagiário já registra presença via `my_turma_ids()`)
- Alterar permissões de PoloDetalhe / Equipes
- Criar papel de "supervisor" ou qualquer nova hierarquia
- Log de auditoria específico por exclusão de turma/aluno por professor

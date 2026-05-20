# Design Spec: Polos (Navegação Inteligente) + Presença (UX e Segurança)
**Data:** 2026-05-20  
**Status:** Aprovado  

---

## Contexto

Duas frentes de melhoria no SMEL Conecta, motivadas por feedback de coordenadoras e professores em campo:

1. A tela de Polos mostra todos os polos da rede sem distinção — o usuário não sabe quais são os seus
2. A tela de Presença carece de: placar visível, falta justificada (atestado médico etc.), janela de edição maior (3 dias), feedback claro pós-salvamento e view legível de chamadas já finalizadas

---

## Frente 1: Polos — Navegação Inteligente

### Objetivo
O usuário vê imediatamente quais polos são seus e quais são da rede, sem perder acesso à rede completa.

### Comportamento por cargo

| Cargo | Comportamento |
|---|---|
| Admin | Vê todos os polos em uma grade única (sem divisão) — comportamento atual |
| Coordenador / Professor / Estagiário | Vê "Meus Polos" + "Outros Polos da Rede" |

### Layout (Opção A aprovada)
- **Seção "Meus Polos"** (topo): cards com borda colorida primária, sempre expandidos. Derivados das `atribuicoes` do usuário logado.
- **Seção "Outros Polos da Rede"** (abaixo): cards acinzentados/opacos. Seção colapsável — clica no header para expandir/recolher. Padrão: expandida.
- Separador visual claro entre as seções (label + contagem).
- Filtros de tipo (Ginásio, Arena, etc.) continuam funcionando dentro de cada seção.
- Se o usuário não tiver nenhuma atribuição (ex: conta recém-criada), exibe aviso amigável em "Meus Polos" e mostra todos na seção "Outros".

### Dados necessários
- `atribuicoes` filtrado por `usuario_id = auth.uid()` e `polo_id IS NOT NULL`
- `DISTINCT polo_id` para montar o set de "meus polos"
- Reutiliza o `useSupabaseData('polos')` já existente; apenas filtra no cliente

### Arquivo modificado
`src/pages/Polos.jsx`

---

## Frente 2: Presença — UX e Segurança

### 2.1 Mudança de banco de dados — campo `status`

#### Problema
`presencas.presente` é um `boolean` (true/false), que não suporta o terceiro estado "falta justificada".

#### Solução
Substituir `presente boolean` por `status text` com três valores possíveis:

| Valor | Significado | Conta para frequência? |
|---|---|---|
| `'presente'` | Aluno estava presente | ✅ Sim |
| `'falta'` | Falta sem justificativa | ❌ Não |
| `'justificado'` | Falta justificada (atestado, etc.) | ✅ Sim (não penaliza) |

#### Fórmula de frequência
```
Frequência = (presentes + justificados) ÷ total de registros da turma
```

#### Migration SQL
```sql
-- 1. Adiciona nova coluna
ALTER TABLE presencas ADD COLUMN status text;

-- 2. Migra dados existentes
UPDATE presencas SET status = CASE
  WHEN presente = true  THEN 'presente'
  WHEN presente = false THEN 'falta'
  ELSE 'falta'
END;

-- 3. Torna obrigatória
ALTER TABLE presencas ALTER COLUMN status SET NOT NULL;

-- 4. Remove coluna antiga
ALTER TABLE presencas DROP COLUMN presente;

-- 5. Adiciona coluna de motivo para justificativas
ALTER TABLE presencas ADD COLUMN motivo text;
```

#### Campo adicional: `motivo text`
Opcional. Preenchido quando `status = 'justificado'`. Registra o motivo da justificativa (ex: "Atestado médico 19/05").

---

### 2.2 Placar ao Vivo (Opção A aprovada)

**Posição:** Bloco fixo acima da lista de alunos, abaixo do header da turma.

**Layout:** 4 caixas em grid:

| Caixa | Cor | Dado |
|---|---|---|
| ✅ Presentes | Verde | Count de `status = 'presente'` |
| ❌ Faltas | Vermelho | Count de `status = 'falta'` |
| 📋 Justificadas | Âmbar | Count de `status = 'justificado'` |
| ⏳ Pendentes | Cinza | Alunos ativos sem marcação |

**Reatividade:** Atualiza a cada clique no toggle de um aluno, antes de salvar.

---

### 2.3 Toggle de 3 Estados (Opção A aprovada)

Cada aluno ativo na lista exibe **3 botões em linha**: `Presente · Falta · Justificada`

- **Ativo/selecionado:** fundo colorido (verde / vermelho / âmbar)
- **Inativo:** fundo cinza claro
- **Clique em Justificada:** expande um campo de texto inline abaixo do nome do aluno para registrar o `motivo` (opcional mas encorajado)
- O campo de motivo fecha ao selecionar outro estado ou salvar
- Alunos inativos/transferidos não exibem os botões (comportamento atual mantido)

---

### 2.4 Janela de Edição — 3 Dias

Substitui a lógica atual (±15min da aula, somente hoje).

#### Nova regra

| Situação | Editável? |
|---|---|
| Chamada de hoje | ✅ Sempre (sem restrição de horário) |
| Chamada de ontem (dia -1) | ✅ Sim |
| Chamada de anteontem (dia -2) | ✅ Sim |
| Chamada há 3+ dias | 🔒 Somente leitura (professor/estagiário) |
| Qualquer data | ✅ Admin edita sempre |

#### Indicator de contexto
Exibido acima da lista quando a chamada está editável:
- `"✏️ Editável por mais 2 dias (chamada de 19/05)"`
- `"✏️ Editável até hoje"`
- `"🔒 Somente leitura — janela de edição encerrada"`

---

### 2.5 Toast Pós-Salvamento

Substitui a mensagem atual `"✓ X presença(s) salva(s)!"` por um toast mais rico:

**Formato:**
> `"✅ Chamada salva! 18 presentes · 72% de frequência na turma"`

- Frequência calculada no momento do save: `(presentes + justificados) / total de ativos`
- Toast desaparece após 4 segundos (atual: 3s)
- Em caso de erro parcial, mantém mensagem de erro específica

---

### 2.6 View Somente-Leitura do Dia (Consulta Histórica)

Quando a chamada de uma data já foi registrada e a janela de edição está fechada, o usuário vê uma **view de resultado** em vez dos botões de marcação.

**Layout por aluno:**
- ✅ Nome — "Presente" (verde)
- ❌ Nome — "Falta" (vermelho)
- 📋 Nome — "Justificada · [motivo]" (âmbar, motivo se houver)
- ⬜ Nome — "Sem registro" (cinza)

**Gatilho:** `isEditavel() === false` AND `presencaState` tem dados carregados (chamada já foi feita).

**Escopo:** limitado ao dia selecionado. O histórico de 7 dias abaixo continua igual.

---

### Arquivos modificados

| Arquivo | Mudanças |
|---|---|
| `src/pages/Polos.jsx` | Fetch de atribuicoes, split Meus/Outros, collapsible section |
| `src/pages/Presenca.jsx` | Placar, toggle 3 estados, campo motivo, nova isEditavel(), toast, read-only view |
| `supabase/migration-presenca-status.sql` | ALTER TABLE + migração de dados |

---

## Não está no escopo

- Notificações push para o professor quando a janela está prestes a fechar
- Relatório de frequência por aluno (feature separada)
- Histórico de edições por campo (audit de cada mudança de status)
- Aprovação de justificativas por coordenador (processo offline por ora)

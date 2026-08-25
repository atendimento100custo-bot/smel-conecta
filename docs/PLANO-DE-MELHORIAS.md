# SMEL Conecta — Plano Estratégico de Melhorias e Correções

> Documento de análise técnica. **Nenhuma mudança foi executada** — este é o plano para execução posterior.
> Gerado em 2026-07-07 por auditoria completa do repositório.

---

## 1. Resumo Executivo

O SMEL Conecta é um SPA React (Vite + Tailwind + Supabase) para gestão de polos esportivos municipais: alunos, turmas, presenças, atestados, viagens e relatórios em PDF. O produto está **funcional e em produção** (Vercel + Supabase), com boa cobertura funcional e um design consistente.

Porém, a auditoria encontrou **uma vulnerabilidade crítica de segurança que precisa ser tratada antes de qualquer outra coisa**: a *service role key* do Supabase está embutida no bundle JavaScript do frontend (`VITE_SUPABASE_SERVICE_KEY`). Qualquer pessoa que abra o site pode extrair essa chave do código-fonte e obter **acesso administrativo total ao banco de dados e ao sistema de autenticação** — criar/apagar usuários, ler/alterar/apagar qualquer dado, ignorando todas as políticas RLS. Enquanto isso não for corrigido, toda a segurança do sistema é ilusória.

Nos demais eixos: o app não tem testes, não tem CI, não tem error boundary (dois incidentes de "tela escura" em produção já ocorreram por erros de render), tem um componente de 2.918 linhas (`PoloDetalhe.jsx`) concentrando risco, baixa performance de carregamento (bundle único de 2,9 MB; páginas baixando até 50 mil linhas de presença para o browser) e uma fila offline que **aceita dados mas nunca os sincroniza** (perda silenciosa de cadastros).

O roadmap proposto tem 4 fases: **(1) Segurança crítica → (2) Estabilidade e bugs → (3) Refatoração e performance → (4) Qualidade e processo.** A Fase 1 é urgente e independente; as demais podem ser intercaladas com desenvolvimento de features.

---

## 2. Mapeamento Geral

### 2.1 Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| UI | React | 18.3 |
| Build | Vite | 5.4 |
| Estilo | Tailwind CSS | 3.4 |
| Roteamento | react-router-dom | 6.26 |
| Backend (BaaS) | Supabase (Postgres + Auth + RLS) | supabase-js 2.103 |
| Gráficos | Recharts | 2.12 |
| Mapas | Leaflet / react-leaflet | 1.9 / 4.2 |
| PDF | @react-pdf/renderer | 4.4 |
| Datas | date-fns | 4.1 |
| Ícones | lucide-react | 0.453 |
| Testes (instalado, **não usado**) | Vitest + Testing Library | 4.1 |
| Deploy | Vercel (CLI manual, `npx vercel --prod`) | — |

### 2.2 Estrutura

```
src/
  App.jsx               — rotas com ProtectedRoute por cargo (minRole)
  contexts/             — AuthContext (auth + papel), ThemeContext, SidebarContext
  hooks/                — useSupabaseData (fetch genérico), useOfflineQueue, usePoloCoords
  components/           — Layout, Sidebar, Topbar + ui/ (Button, Modal, Toast, etc.)
  pages/                — 19 páginas (uma por rota)
  pdf/                  — 3 templates de relatório PDF
  lib/                  — supabase.js (clients), auditLog.js, voltaRedondaCoords.js
  data/store.js         — CÓDIGO MORTO (era pré-Supabase, não é importado)
supabase/               — schema.sql, rls.sql, seed + 10 arquivos "fix-*.sql" avulsos
```

### 2.3 Arquitetura e padrões

- **Sem camada de serviço**: as páginas chamam `supabase.from(...)` diretamente. Toda regra de negócio vive nos componentes.
- **Autorização em duas camadas**: UI (`ProtectedRoute minRole` + `canEditPolo`) e banco (RLS). Porém o app **contorna a própria RLS** usando o client `supabaseAdmin` (service role) no browser.
- **Fetch**: hook genérico `useSupabaseData` (uma chamada por tabela por página, sem cache compartilhado) + fetches manuais com `limit()` alto para tabelas grandes.
- **Estado**: 100% local (`useState`) — sem react-query/zustand. Páginas grandes acumulam 30–40 estados.
- **Tamanho dos módulos**: `PoloDetalhe.jsx` 2.918 linhas; `Alunos.jsx` 938; `Presenca.jsx` 749; `Equipes.jsx` 740.

---

## 3. Achados por Categoria

### 3.1 🔴 Segurança

| ID | Achado | Evidência | Impacto |
|---|---|---|---|
| **S1** | **Service role key exposta no bundle do cliente.** Toda env `VITE_*` é embutida no JS público. O client `supabaseAdmin` é usado no browser em Equipes, GerenciarAcesso e PoloDetalhe (`auth.admin.createUser/updateUserById/deleteUser`, upsert em `profiles`). | `src/lib/supabase.js:5,15`; `src/pages/Equipes.jsx:161-263`; `src/pages/GerenciarAcesso.jsx:60-108`; `src/pages/PoloDetalhe.jsx:702-834` | **CRÍTICO.** Qualquer visitante extrai a chave e ganha acesso root ao banco + auth: ler/alterar/apagar todos os dados, criar admins, ignorar RLS. |
| **S2** | **Senha padrão hardcoded** `'smel2026'` no código público, com botão de reset que redefine a senha de qualquer usuário para ela. | `src/pages/GerenciarAcesso.jsx:38,82` | ALTO. Combinada com S1, permite tomada de qualquer conta. Mesmo após corrigir S1, senha previsível de reset é vetor de invasão. |
| **S3** | **RPC `engajamento_polo` com `SECURITY DEFINER` + `GRANT EXECUTE TO anon`.** Usuário **não autenticado** pode consultar frequência/última presença de alunos de qualquer polo (basta o UUID). | `supabase/engajamento_polo_rpc.sql:18,50` | MÉDIO. Vazamento de dados pessoais de menores/idosos (LGPD). |
| **S4** | **RLS contornada em vez de corrigida, e — verificado direto no banco em 25/08 — praticamente sem efeito prático hoje.** Comentário no código: *"Usa supabaseAdmin para garantir que cargo seja salvo mesmo com RLS"*. Consultando `pg_policies` ao vivo: `polos`, `turmas`, `profiles` e `atribuicoes` têm política de leitura `auth.uid() IS NOT NULL` (qualquer logado lê tudo, de qualquer polo/cargo); `chamadas` tem uma política `FOR ALL USING (true)` — **sem condição nenhuma**, qualquer usuário logado lê/edita/apaga chamada de qualquer turma; `alunos` tem DUAS políticas de SELECT simultâneas — uma escopada por polo (`alunos: leitura por cargo e polo`) e uma antiga aberta (`alunos: autenticados leem todos`, de `fix-rls-and-email.sql`) que nunca foi removida. Como o Postgres combina políticas do mesmo comando com OR, a aberta anula a escopada — **qualquer usuário autenticado lê o cadastro de todos os alunos do sistema inteiro**. A única tabela com escopo por polo/turma realmente funcionando é `presencas`. A app "esconde" dados por polo só na interface (React), não no banco — um usuário com acesso ao console do navegador contorna isso sem precisar de senha de admin. | `supabase/fix-rls-and-email.sql:44-47` (política aberta nunca removida); `supabase/fix-rls-atribuicoes.sql:67-68` (política escopada que fica sem efeito); tabela `chamadas` (política `autenticados_chamadas` com `qual: true`) | ALTO. Reforça a urgência de tratar isso junto com S1 (service key exposta) — as duas juntas significam que hoje não existe isolamento real entre polos no nível de dados. |
| **S5** | **SQL do banco sem controle de migração.** 10 arquivos `fix-*.sql` avulsos aplicados manualmente via SQL Editor, sem ordem nem registro do que já rodou em produção. | `supabase/*.sql` | MÉDIO. Impossível reconstruir o banco ou auditar o estado real das policies. |

### 3.2 🐛 Bugs (confirmados ou latentes)

| ID | Achado | Evidência | Impacto |
|---|---|---|---|
| **B1** | **Fila offline nunca sincroniza.** `addToQueue` grava cadastros de aluno no localStorage quando offline, mas **não existe nenhum código que leia a fila e envie ao Supabase ao voltar online**. `clearQueue` existe e nunca é chamado. | `src/hooks/useOfflineQueue.js` (sem flush); chamadas em `Alunos.jsx:369`, `PoloDetalhe.jsx:1399` | **ALTO. Perda silenciosa de dados**: o professor acha que cadastrou o aluno; o registro morre no localStorage. |
| **B2** | **Truncamento silencioso em 10 mil linhas.** `useSupabaseData` faz `.range(0, 9999)` para toda tabela. Quando `alunos`, `atestados` ou `presencas` passarem de 10k, os dados somem sem aviso (o comentário em PoloDetalhe confirma que `presencas` já bateu nesse teto). | `src/hooks/useSupabaseData.js:12` | ALTO. Relatórios e telas passam a exibir dados incompletos sem nenhum indicador. |
| **B3** | **Sem Error Boundary.** Qualquer exceção de render derruba a árvore React inteira → tela escura sem mensagem. Já aconteceu **duas vezes** em produção (ordem de hooks em `Polos.jsx`; TDZ em `PoloDetalhe.jsx`). | ausência de `ErrorBoundary` em `src/` | ALTO. Usuário fica sem feedback; diagnóstico exige DevTools em produção. |
| **B4** | **Escritas sem tratamento de erro.** Vários `await supabase...insert/upsert/delete` não verificam `error` (ex.: upsert de profiles, vínculos de turma). Falha de rede/RLS = operação "concluída" na UI sem ter salvado. | padrão recorrente em `Equipes.jsx`, `PoloDetalhe.jsx` | MÉDIO. Inconsistência de dados percebida só depois. |
| **B5** | **Datas com gambiarra de fuso.** Concatenação `+ 'T12:00:00'` para evitar shift de timezone em vez de tratamento uniforme (date-fns `parseISO`/UTC). | `PoloDetalhe.jsx` (cálculo `diasAfastado`) e padrão semelhante em outras telas | BAIXO. Funciona, mas frágil e espalhado. |
| **B6** | **Polling de 1s no localStorage.** `useOfflineQueue` roda `setInterval` de 1 segundo para ler a fila — em toda página que usa o hook, para sempre. | `src/hooks/useOfflineQueue.js:22-25` | BAIXO. Desperdício de CPU; deveria ser evento/estado. |

### 3.3 🐢 Performance

| ID | Achado | Evidência | Impacto |
|---|---|---|---|
| **P1** | **Bundle único de 2,93 MB (878 KB gzip).** Recharts, Leaflet e react-pdf (usados em poucas telas) carregam na tela de login. Sem `React.lazy`/`manualChunks`. O próprio build avisa. | log do build Vite; `vite.config.js` (vazio) | ALTO. Primeiro carregamento lento (pior em 4G nos polos); qualquer mudança invalida o cache do bundle inteiro. |
| **P2** | **Downloads massivos para o browser.** Dashboard e PoloDetalhe baixam até **50.000 linhas** de presenças cada; registros de aula até 20.000; cada página re-baixa tabelas inteiras via `useSupabaseData`. | `Dashboard.jsx:91`, `PoloDetalhe.jsx:624,641` | ALTO. Custo de rede/memória cresce linearmente com o uso do sistema. A solução correta já existe no projeto: **RPC de agregação no servidor** (`engajamento_polo`) — falta estender o padrão. |
| **P3** | **Sem cache compartilhado de dados.** Navegar Dashboard → Polos → PoloDetalhe re-baixa `polos`, `turmas`, `alunos` três vezes. | `useSupabaseData` (um fetch por mount) | MÉDIO. Percepção de lentidão na navegação. |

### 3.4 🧱 Arquitetura e Débito Técnico

| ID | Achado | Evidência | Impacto |
|---|---|---|---|
| **A1** | **`PoloDetalhe.jsx` com 2.918 linhas** — 6 abas + sub-abas, ~10 modais, ~40 estados no mesmo componente. Os dois últimos bugs de produção nasceram aqui (ordem de declaração em arquivo gigante). | `src/pages/PoloDetalhe.jsx` | ALTO. Custo de manutenção e risco de regressão concentrados. |
| **A2** | **Lógica duplicada**: validação de aluno (`validateAlunoForm` em PoloDetalhe vs `validateAlunoFormAlunos` em Alunos), `normNomeAluno` (2 cópias), cálculo de engajamento (RPC + fallback client-side com a mesma fórmula), fluxo de criação de usuário (Equipes vs PoloDetalhe). | `Alunos.jsx:246-274`; `PoloDetalhe.jsx:750-753` | MÉDIO. Correções precisam ser feitas em N lugares; já divergem. |
| **A3** | **Código morto**: `src/data/store.js` (110 linhas, era pré-Supabase, nunca importado); `useAuth.js` de 1 linha re-exportando o que AuthContext já exporta. | `src/data/store.js`; `src/hooks/useAuth.js` | BAIXO. Ruído. |
| **A4** | **Sem camada de acesso a dados.** Queries Supabase espalhadas pelas páginas; mudança de schema exige caça por grep. | todas as páginas | MÉDIO. Prepara terreno para inconsistência (já visível em B4). |

### 3.5 📋 Qualidade e Processo

| ID | Achado | Evidência | Impacto |
|---|---|---|---|
| **Q1** | **Zero testes.** Vitest e Testing Library instalados, mas nenhum arquivo `.test.*` e nem script `"test"` no package.json. | `package.json`; busca em `src/` | ALTO. Toda regressão é descoberta por usuário em produção. |
| **Q2** | **Sem CI.** Push direto na master + deploy manual via CLI. Nenhum check automático (build, lint, teste) antes de produção. Sem ESLint/Prettier configurados. | ausência de `.github/`; `package.json` | ALTO. Os dois incidentes de tela escura passaram porque só o build (que não executa o código) foi verificado. |
| **Q3** | **Sem monitoramento de erros** (Sentry ou similar). Erros em produção são invisíveis até um usuário reclamar. | — | MÉDIO. |
| **Q4** | **Sem README/documentação de setup.** Um dev novo não sabe como rodar, quais env vars existem, nem como aplicar o SQL. | ausência de `README.md` | MÉDIO. |

---

## 4. Tabela de Priorização

| ID | Item | Severidade | Esforço | Depende de |
|---|---|---|---|---|
| S1 | Service key no cliente → mover admin p/ Edge Functions + rotacionar chave | 🔴 Crítico | Alto | — |
| S2 | Senha padrão hardcoded | 🔴 Crítico | Baixo | S1 (mesmo fluxo) |
| S4 | Corrigir RLS para os fluxos legítimos (sem service key) | 🟠 Alto | Médio | S1 |
| B1 | Fila offline sem sync (perda de dados) | 🟠 Alto | Médio | — |
| B3 | Error Boundary global | 🟠 Alto | Baixo | — |
| B2 | Truncamento silencioso 10k | 🟠 Alto | Baixo | — |
| Q2 | CI mínimo (build+lint+teste no PR) | 🟠 Alto | Baixo | Q1 parcial |
| P1 | Code splitting (bundle 2,9 MB) | 🟠 Alto | Médio | — |
| S3 | Revogar `anon` da RPC | 🟡 Médio | Baixo | — |
| B4 | Tratamento de erro nas escritas | 🟡 Médio | Médio | A4 ajuda |
| P2 | Agregações no servidor (estender padrão RPC) | 🟡 Médio | Médio | S5 |
| S5 | Migrações versionadas (supabase CLI) | 🟡 Médio | Médio | — |
| A1 | Quebrar PoloDetalhe.jsx | 🟡 Médio | Alto | B3, Q1 |
| A2 | Extrair lógica duplicada p/ lib compartilhada | 🟡 Médio | Médio | — |
| P3 | Cache de dados (react-query ou similar) | 🟡 Médio | Médio | A4 |
| Q1 | Testes das regras críticas | 🟡 Médio | Médio | A2 ajuda |
| Q3 | Sentry/monitoring | 🟡 Médio | Baixo | — |
| B5 | Padronizar datas/fuso | 🟢 Baixo | Baixo | A2 |
| B6 | Remover polling 1s da fila | 🟢 Baixo | Baixo | B1 |
| A3 | Remover código morto | 🟢 Baixo | Baixo | — |
| Q4 | README + docs de setup | 🟢 Baixo | Baixo | — |

---

## 5. Roadmap Faseado

### 🚨 Fase 1 — Segurança crítica (fazer primeiro, em sequência)

> Objetivo: nenhuma credencial privilegiada no cliente; RLS volta a ser a única fronteira de autorização.

- [ ] **1.1 — Criar Edge Functions Supabase para operações admin** (S1)
  - O quê: criar funções server-side (`admin-create-user`, `admin-update-user`, `admin-delete-user`, `admin-reset-password`) que recebem o JWT do usuário logado, verificam `cargo === 'admin'` (ou coordenador, conforme regra) no servidor, e só então usam a service key (que vive como secret da função, nunca no cliente).
  - Por quê: é a única forma de manter os fluxos de gestão de usuários sem expor a chave root.
  - Resultado: o frontend chama `supabase.functions.invoke('admin-create-user', ...)` autenticado; a service key sai 100% do código do browser.
- [ ] **1.2 — Substituir todos os usos de `supabaseAdmin` no frontend** (S1)
  - Arquivos: `Equipes.jsx`, `GerenciarAcesso.jsx`, `PoloDetalhe.jsx` (seções de funcionários). Remover `supabaseAdmin` de `src/lib/supabase.js`.
- [ ] **1.3 — ROTACIONAR a service role key no painel Supabase** (S1)
  - Por quê: a chave atual já foi publicada em todos os bundles deployados (e fica em cache/CDN). Trocar a chave invalida as cópias vazadas. Remover `VITE_SUPABASE_SERVICE_KEY` das env vars do Vercel.
  - ⚠️ Fazer **depois** de 1.1/1.2 estarem em produção, senão os fluxos admin quebram.
- [ ] **1.4 — Eliminar senha padrão fixa** (S2)
  - O quê: no reset, gerar senha aleatória forte no servidor (Edge Function) e exibi-la uma única vez ao admin; opcionalmente exigir troca no primeiro login.
- [ ] **1.5 — Restringir a RPC `engajamento_polo`** (S3)
  - O quê: `REVOKE EXECUTE ... FROM anon;` e, dentro da função, validar acesso do usuário ao polo (ou trocar `SECURITY DEFINER` por `SECURITY INVOKER` com RLS adequada).
- [ ] **1.6 — Consertar as políticas RLS que motivaram o bypass, e fechar o escopo por polo de verdade** (S4)
  - O quê: (a) mapear cada operação que hoje "precisa" de service key (salvar cargo em profiles, upsert de atribuições) e escrever a policy correta (`WITH CHECK` incluído); (b) `DROP POLICY "alunos: autenticados leem todos"` (deixa só a versão escopada por polo ativa); (c) trocar a política `autenticados_chamadas` (`qual: true`) de `chamadas` por uma escopada como a de `presencas`; (d) decidir se `polos`/`turmas`/`profiles`/`atribuicoes` devem continuar de leitura aberta (aceitável só se for decisão consciente — hoje é resquício, não decisão) ou também ganhar escopo por polo. Testar com usuário de cada cargo antes de aplicar em produção.
  - Por quê: verificado ao vivo em 25/08 — hoje só `presencas` tem escopo por polo funcionando no banco; todo o resto é filtro só na interface (ver achado S4 detalhado acima).

### 🩹 Fase 2 — Estabilidade e correção de bugs

> Objetivo: nenhuma perda silenciosa de dados; falhas visíveis e recuperáveis.

- [ ] **2.1 — Error Boundary global + por rota** (B3)
  - O quê: componente `ErrorBoundary` envolvendo `<Routes>` (e opcionalmente cada página), com tela amigável "Algo deu errado" + botão recarregar.
  - Resultado: fim da "tela escura"; erro exibido em vez de árvore desmontada.
- [ ] **2.2 — Consertar ou remover a fila offline** (B1, B6)
  - Decisão a tomar: (a) implementar o flush — ao voltar online, ler a fila, enviar ao Supabase com tratamento de conflito, limpar; ou (b) remover o recurso e bloquear o submit offline com mensagem clara. **Não deixar como está** (aceita e perde).
  - Incluir: substituir o `setInterval` de 1s por evento.
- [ ] **2.3 — Eliminar truncamento silencioso** (B2)
  - O quê: em `useSupabaseData`, usar `{ count: 'exact' }` e comparar `count` vs linhas retornadas; se truncou, logar/avisar e paginar. Para tabelas grandes (presenças), migrar leituras para RPCs agregadas (ver 3.3).
- [ ] **2.4 — Tratamento de erro padrão nas escritas** (B4)
  - O quê: helper único (ex.: `execute(query)` que lança/retorna erro + toast padronizado). Varrer inserts/upserts/deletes sem checagem de `error` e cobrir todos.
- [ ] **2.5 — Migrações versionadas** (S5)
  - O quê: adotar `supabase migrations` (CLI já referenciada em `supabase/.temp`); consolidar `schema.sql` + `rls.sql` + os 10 `fix-*.sql` no estado atual real do banco como migração inicial; novas mudanças só via migração commitada.

### 🔧 Fase 3 — Refatoração e performance

> Objetivo: reduzir o custo de manutenção e o tempo de carregamento.

- [ ] **3.1 — Code splitting por rota** (P1)
  - O quê: `React.lazy()` para todas as páginas + `manualChunks` para recharts/leaflet/react-pdf. Meta: chunk inicial < 300 KB gzip.
- [ ] **3.2 — Quebrar `PoloDetalhe.jsx`** (A1)
  - O quê: extrair cada aba (Visão Geral, Operacional, Alunos, Equipe, Infra, Viagens) para componente próprio em `src/pages/polo/`; extrair modais (NovaTurma, NovoAluno, EditarFuncionário...) para `src/components/modals/`; estados de cada aba descem para o componente da aba.
  - Regra prática: nenhum arquivo > 500 linhas.
  - Ordem: fazer **depois** do Error Boundary (2.1) e idealmente com os primeiros testes (4.1) como rede de proteção.
- [ ] **3.3 — Estender agregação no servidor** (P2)
  - O quê: seguindo o padrão `engajamento_polo`, criar RPCs para os números do Dashboard (presença por dia/polo) e do histórico do polo, eliminando os `limit(50000)`/`limit(20000)` no cliente.
- [ ] **3.4 — Camada de dados + cache** (A4, P3)
  - O quê: introduzir TanStack Query (react-query): queries nomeadas por tabela/RPC, cache entre páginas, invalidação após escrita. Substituir `useSupabaseData` gradualmente.
- [ ] **3.5 — Extrair lógica compartilhada** (A2, B5)
  - O quê: `src/lib/alunos.js` (validação + normalização únicas), `src/lib/datas.js` (parse/format com fuso tratado num lugar só), unificar fluxo de criação de usuário.
- [ ] **3.6 — Remover código morto** (A3)
  - O quê: apagar `src/data/store.js` e `src/hooks/useAuth.js` (ajustar imports).

### 🏗️ Fase 4 — Qualidade e processo contínuo

> Objetivo: impedir que as classes de bug já vistas voltem.

- [ ] **4.1 — Testes das regras críticas** (Q1)
  - O quê: adicionar script `"test": "vitest"`; começar por funções puras (validação de aluno, cálculo de engajamento/frequência, elegibilidade de viagem por turma, `hasMinRole`) — alto valor, baixo custo. Depois, smoke tests de render por página (pega TDZ/ordem de hooks em CI, exatamente os dois incidentes passados).
- [ ] **4.2 — CI no GitHub Actions** (Q2)
  - O quê: workflow que roda `npm ci && npm run build && npm test` (+ lint) em cada push/PR. Ligar deploy do Vercel ao Git (preview por PR, produção só na master verde) em vez de CLI manual.
- [ ] **4.3 — ESLint + Prettier** (Q2)
  - O quê: `eslint-plugin-react-hooks` teria acusado os dois bugs de produção em tempo de edição. Configurar e rodar no CI.
- [ ] **4.4 — Monitoramento de erros** (Q3)
  - O quê: Sentry (ou similar) no frontend, integrado ao Error Boundary — erro em produção vira alerta com stack trace, não reclamação de usuário.
- [ ] **4.5 — README e documentação de operação** (Q4)
  - O quê: setup local, env vars necessárias, como aplicar migração, como deployar, arquitetura em 1 página, papéis/permissões.

---

## 6. Ordem de Execução Recomendada (resumo)

```
Semana 1        Fase 1 completa (1.1 → 1.6)  ← bloqueia tudo, risco ativo
Semana 2        2.1, 2.3, 2.4 (rápidos) + decisão e execução de 2.2
Semana 2-3      2.5 (migrações) + 4.3 (ESLint) + 4.2 (CI mínimo com build+lint)
Semana 3-4      3.1 (code splitting) + 4.1 (primeiros testes) + 4.4 (Sentry)
Semanas 4-6     3.2 (quebrar PoloDetalhe) intercalado com 3.5 e 3.3
Contínuo        3.4 (react-query gradual), 4.5 (docs), 3.6 (limpeza)
```

**Dependências-chave:**
- 1.3 (rotacionar chave) só **depois** de 1.1/1.2 em produção.
- 3.2 (quebrar PoloDetalhe) idealmente **depois** de 2.1 (boundary) e com 4.1 (testes) como rede.
- 4.2 (CI) ganha valor real **depois** de 4.1/4.3 existirem.
- 3.3 (novas RPCs) **depois** de 2.5 (migrações), para nascerem versionadas.

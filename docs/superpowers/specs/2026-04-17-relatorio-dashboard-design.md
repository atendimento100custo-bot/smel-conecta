# Spec: Dashboard de Relatórios SMEL
**Data:** 2026-04-17  
**Status:** Aprovado

## Objetivo
Substituir a página de Relatórios atual (dois botões de PDF básicos) por um dashboard visual completo, automatizado a partir dos dados do banco, com exportação PDF rica e campo de Demandas integrado — substituindo o Google Forms de relatório mensal.

## Mudanças no Banco
1. `ALTER TABLE alunos ADD COLUMN genero text` — valores: `'M'`, `'F'`, `'Outro'`
2. Nova tabela `relatorios_mensais(id, polo_id, mes, ano, demandas, arquivos_urls, criado_por, criado_em)` com UNIQUE(polo_id, mes, ano)

## Mapeamento de Programas
- **Viva Melhor** → turmas com `faixa = 'Melhor Idade'`
- **Viva Mais+** → turmas com `faixa = 'Adulto'`
- **Viva o Esporte** → turmas com `faixa = 'Infantil'`
- **Viva para Todos** → turmas com `faixa_etaria` contendo `PCD` ou `Inclusão`

## Layout do Dashboard (Relatorios.jsx)
1. **Filtros** — Polo, Mês/Ano
2. **KPI Cards** — Total Ativos, Novos no Período, Freq. Média, Turmas Ativas, Melhor Idade
3. **Cards de Programa** — 4 cards: totais M/F/novos por programa
4. **Gráficos (Recharts)** — Frequência últimos 6 meses + Alunos por modalidade
5. **Demandas** — textarea + upload de até 5 arquivos
6. **Ações** — Exportar PDF + Salvar Demandas

## PDF (RelatorioCompleto.jsx)
- Logo SMEL (texto estilizado)
- KPIs em destaque
- Tabela por programa (M/F/novos/total)
- Gráfico de barras SVG de frequência por mês
- Tabela de modalidades
- Campo Demandas

## Arquivos Modificados
- `scripts/migration_relatorios.mjs` — novo
- `src/pages/Relatorios.jsx` — reescrita completa
- `src/pdf/RelatorioCompleto.jsx` — novo
- `src/pages/Alunos.jsx` — add campo genero
- `src/pages/AlunoDetalhe.jsx` — add campo genero
- `src/pages/PoloDetalhe.jsx` — add genero ao form novo aluno

-- supabase/fix-timeout-alunos-indices.sql
-- Aplicado em produção em 27/08/2026 (via SQL Editor, com o dono logado).
--
-- PROBLEMA: desde a regra de segurança mais detalhada de alunos aplicada em
-- 25/08 (fix-rls-alunos-chamadas-abertas.sql), a consulta de alunos passou a
-- combinar 4 condições (polo, turma, estágio, matrícula dupla) avaliadas
-- linha a linha. Sem índice em alunos.turma_id e turmas.polo_id, isso virou
-- um Seq Scan completo em ~1900 linhas pra cada requisição não-admin —
-- estourando o statement_timeout do PostgREST (erro 57014) e fazendo a lista
-- de alunos aparecer vazia pra professor/estagiário/coordenador, em qualquer
-- polo, sem nenhum erro visível (o app engolia o erro em silêncio).
--
-- Confirmado com EXPLAIN ANALYZE (impersonando um professor real, dentro de
-- uma transação com ROLLBACK): antes ~timeout; depois dos índices, a mesma
-- consulta completa em ~2s.

CREATE INDEX IF NOT EXISTS idx_alunos_turma_id      ON alunos (turma_id);
CREATE INDEX IF NOT EXISTS idx_turmas_polo_id       ON turmas (polo_id);
CREATE INDEX IF NOT EXISTS idx_aluno_turmas_turma_id ON aluno_turmas (turma_id);

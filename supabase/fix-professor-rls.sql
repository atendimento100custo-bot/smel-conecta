-- =============================================================================
-- MIGRATION: fix-professor-rls.sql
-- Problema: professores não conseguem criar turmas nem adicionar alunos
-- Causa raiz:
--   1. turmas: sem política INSERT para professor
--   2. turmas: política UPDATE usa professor_id (modelo antigo) em vez de atribuicoes
--   3. atribuicoes: só admin/coordenador podem inserir (professor fica bloqueado
--      ao tentar criar uma turma e vincular professores a ela)
-- =============================================================================
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

-- ─── 1. Turmas: adiciona INSERT para professor/estagiário no seu polo ─────────
CREATE POLICY "turmas: professor insere no seu polo"
  ON turmas FOR INSERT WITH CHECK (
    get_my_cargo() IN ('professor', 'estagiario') AND
    polo_id = ANY(my_polo_ids())
  );

-- ─── 2. Turmas: corrige UPDATE para usar atribuicoes (não professor_id) ───────
DROP POLICY IF EXISTS "turmas: professor edita as suas" ON turmas;
CREATE POLICY "turmas: professor atualiza as suas"
  ON turmas FOR UPDATE USING (
    get_my_cargo() IN ('professor', 'estagiario') AND
    (professor_id = auth.uid() OR id = ANY(my_turma_ids()))
  );

-- ─── 3. Atribuicoes: permite professor inserir vínculos no seu polo ───────────
-- Necessário para que o professor possa vincular professores/estagiários
-- às turmas que ele criou.
CREATE POLICY "atribuicoes: professor insere no seu polo"
  ON atribuicoes FOR INSERT WITH CHECK (
    get_my_cargo() IN ('professor', 'estagiario') AND
    polo_id = ANY(my_polo_ids())
  );

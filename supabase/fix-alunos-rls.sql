-- =============================================================================
-- MIGRATION: fix-alunos-rls.sql
-- Problema: professor não consegue cadastrar alunos
-- Causa 1: policy verificava turma_id = ANY(my_turma_ids()) — bloqueava turmas
--          onde professor não tinha atribuição direta mas era do mesmo polo
-- Causa 2: turma_id IS NULL sempre falha ANY() — bloqueia aluno sem turma
-- =============================================================================
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

-- Professor/estagiário: pode gerenciar alunos em qualquer turma do seu polo
DROP POLICY IF EXISTS "alunos: professor edita alunos das suas turmas" ON alunos;
CREATE POLICY "alunos: professor edita alunos do seu polo"
  ON alunos FOR ALL USING (
    get_my_cargo() IN ('professor', 'estagiario') AND
    (turma_id IS NULL OR
     turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

-- Coordenador: também suporta turma_id IS NULL (aluno sem turma)
DROP POLICY IF EXISTS "alunos: admin e coordenador editam" ON alunos;
CREATE POLICY "alunos: admin e coordenador editam"
  ON alunos FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      (turma_id IS NULL OR
       turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
  );

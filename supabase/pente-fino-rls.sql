-- =============================================================================
-- MIGRATION: pente-fino-rls.sql
-- Garante o fluxo completo: criar aluno → matricular → chamada → log
-- Para todos os cargos: admin, coordenador, professor, estagiário
--
-- O que foi identificado e corrigido:
--   1. alunos: policy de professor usava my_turma_ids() (restrita)
--              turma_id IS NULL não era tratado em nenhuma policy
--   2. aluno_turmas: estagiário não tinha permissão de INSERT/DELETE
--   3. historico_acoes: sem RLS configurado (bloqueava logAcao)
--   4. presencas: consolidada para cobrir atribuicoes via my_turma_ids()
-- =============================================================================
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

-- ─── 1. ALUNOS ──────────────────────────────────────────────────────────────
-- Professor/estagiário: gerencia alunos de qualquer turma do seu polo
-- Suporta turma_id IS NULL (aluno recém-criado, ainda sem turma atribuída)

DROP POLICY IF EXISTS "alunos: professor edita alunos das suas turmas" ON alunos;
DROP POLICY IF EXISTS "alunos: professor edita alunos do seu polo" ON alunos;
CREATE POLICY "alunos: professor edita alunos do seu polo"
  ON alunos FOR ALL USING (
    get_my_cargo() IN ('professor', 'estagiario') AND
    (turma_id IS NULL OR
     turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

-- Coordenador/admin: também suporta turma_id IS NULL
DROP POLICY IF EXISTS "alunos: admin e coordenador editam" ON alunos;
CREATE POLICY "alunos: admin e coordenador editam"
  ON alunos FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      (turma_id IS NULL OR
       turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
  );

-- ─── 2. ALUNO_TURMAS ────────────────────────────────────────────────────────
-- Professor e estagiário: podem matricular e remover alunos das suas turmas

DROP POLICY IF EXISTS "aluno_turmas: admin e coordenador editam" ON aluno_turmas;
DROP POLICY IF EXISTS "aluno_turmas: funcionarios editam no seu polo" ON aluno_turmas;
CREATE POLICY "aluno_turmas: funcionarios editam no seu polo"
  ON aluno_turmas FOR ALL USING (
    is_admin() OR
    get_my_cargo() = 'coordenador' OR
    (get_my_cargo() IN ('professor', 'estagiario') AND
     turma_id = ANY(my_turma_ids()))
  );

-- ─── 3. HISTORICO_ACOES ─────────────────────────────────────────────────────
-- Sem RLS configurado → com RLS ativo bloqueava INSERT do logAcao()
-- Todos os funcionários precisam poder gravar logs

ALTER TABLE historico_acoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historico_acoes: admin le todos" ON historico_acoes;
DROP POLICY IF EXISTS "historico_acoes: autenticados inserem" ON historico_acoes;
CREATE POLICY "historico_acoes: admin le todos"
  ON historico_acoes FOR SELECT
  USING (is_admin() OR usuario_id = auth.uid());
CREATE POLICY "historico_acoes: autenticados inserem"
  ON historico_acoes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 4. PRESENCAS ───────────────────────────────────────────────────────────
-- Consolida: my_turma_ids() já inclui professor_id + atribuicoes (estagiários)
-- Remove o check de polo_ids incorreto que existia na policy original

DROP POLICY IF EXISTS "presencas: no escopo" ON presencas;
CREATE POLICY "presencas: no escopo"
  ON presencas FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))) OR
    turma_id = ANY(my_turma_ids()) OR
    turma_id = ANY(my_estagio_turma_ids())
  );

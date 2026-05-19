-- =============================================================================
-- MIGRATION: fix-rls-and-email.sql
-- Problema 1: profiles não tem coluna email → campo sempre vazio no edit
-- Problema 2: my_polo_ids() usa vinculos_usuario_polo (tabela antiga);
--             app usa atribuicoes → RLS bloqueia coordenadores
-- Problema 3: presencas policy tem bug: turma_id = ANY(my_polo_ids())
--             compara UUID de turma com UUID de polo → nunca bate
-- =============================================================================
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

-- ─── 1. Adiciona email à tabela profiles ─────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- ─── 2. Atualiza my_polo_ids() para usar atribuicoes ─────────────────────────
CREATE OR REPLACE FUNCTION my_polo_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(DISTINCT polo_id)
  FROM atribuicoes
  WHERE usuario_id = auth.uid() AND polo_id IS NOT NULL
$$;

-- ─── 3. Atualiza my_turma_ids() para incluir atribuicoes ─────────────────────
CREATE OR REPLACE FUNCTION my_turma_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(DISTINCT t.id) FROM (
    SELECT id FROM turmas WHERE professor_id = auth.uid()
    UNION
    SELECT turma_id FROM atribuicoes
    WHERE usuario_id = auth.uid() AND turma_id IS NOT NULL
  ) t
$$;

-- ─── 4. Profiles: todos os autenticados leem (antes era só próprio + admin) ──
-- Sem isso coordenador/professor não consegue ver a lista da equipe
DROP POLICY IF EXISTS "profiles: leitura própria e admin" ON profiles;
CREATE POLICY "profiles: autenticados leem todos"
  ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── 5. Alunos: autenticados leem todos ──────────────────────────────────────
-- Policy anterior usava turma_id direto; alunos novos têm turma_id = null
-- (vinculados via aluno_turmas), então a policy bloqueava o acesso.
-- É um app interno — todos os usuários são funcionários da SMEL.
DROP POLICY IF EXISTS "alunos: admin e coordenador leem todos do polo" ON alunos;
DROP POLICY IF EXISTS "alunos: professor e estagiario leem das suas turmas" ON alunos;
CREATE POLICY "alunos: autenticados leem todos"
  ON alunos FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── 6. Presencas: corrige bug polo_ids e atualiza para atribuicoes ──────────
DROP POLICY IF EXISTS "presencas: todos os papéis leem e editam no escopo" ON presencas;
CREATE POLICY "presencas: no escopo"
  ON presencas FOR ALL USING (
    is_admin() OR
    turma_id = ANY(my_turma_ids()) OR
    turma_id = ANY(my_estagio_turma_ids()) OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

-- ─── 7. Atestados: corrige para usar atribuicoes via my_polo_ids() ────────────
DROP POLICY IF EXISTS "atestados: admin e coordenador leem todos do polo" ON atestados;
CREATE POLICY "atestados: no escopo"
  ON atestados FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      aluno_id IN (
        SELECT id FROM alunos WHERE turma_id IN
          (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
      )) OR
    (get_my_cargo() IN ('professor', 'estagiario') AND
      aluno_id IN (SELECT id FROM alunos WHERE turma_id = ANY(my_turma_ids())))
  );

-- ─── 8. Registros_aula: atualiza para usar atribuicoes ───────────────────────
DROP POLICY IF EXISTS "registros_aula: no escopo" ON registros_aula;
CREATE POLICY "registros_aula: no escopo"
  ON registros_aula FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))) OR
    (get_my_cargo() IN ('professor', 'estagiario') AND
      turma_id = ANY(my_turma_ids()))
  );

-- ─── 9. Viagens: garante acesso via my_polo_ids() corrigido ──────────────────
DROP POLICY IF EXISTS "viagens: no escopo" ON viagens;
CREATE POLICY "viagens: no escopo"
  ON viagens FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND polo_id = ANY(my_polo_ids())) OR
    turma_id = ANY(my_turma_ids())
  );

-- ─── 10. RLS para atribuicoes (tabela nova, pode não ter RLS ainda) ──────────
ALTER TABLE atribuicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "atribuicoes: autenticados leem" ON atribuicoes;
DROP POLICY IF EXISTS "atribuicoes: admin e coordenador gerenciam" ON atribuicoes;
CREATE POLICY "atribuicoes: autenticados leem"
  ON atribuicoes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "atribuicoes: admin e coordenador gerenciam"
  ON atribuicoes FOR ALL USING (
    is_admin() OR get_my_cargo() = 'coordenador'
  );

-- ─── 11. RLS para aluno_turmas (tabela nova, pode não ter RLS ainda) ─────────
ALTER TABLE aluno_turmas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aluno_turmas: autenticados leem" ON aluno_turmas;
DROP POLICY IF EXISTS "aluno_turmas: admin e coordenador editam" ON aluno_turmas;
CREATE POLICY "aluno_turmas: autenticados leem"
  ON aluno_turmas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "aluno_turmas: admin e coordenador editam"
  ON aluno_turmas FOR ALL USING (
    is_admin() OR get_my_cargo() IN ('coordenador', 'professor')
  );

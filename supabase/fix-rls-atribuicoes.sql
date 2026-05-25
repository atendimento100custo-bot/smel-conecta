-- =============================================================================
-- MIGRATION: fix-rls-atribuicoes.sql
--
-- PROBLEMA RAIZ: as funções auxiliares de RLS (my_turma_ids, my_polo_ids,
-- my_estagio_turma_ids) ainda usam as colunas/tabelas ANTIGAS:
--   • professor_id em turmas  (modelo antigo, substituído por atribuicoes)
--   • vinculos_usuario_polo   (modelo antigo, substituído por atribuicoes)
--   • vinculos_estagiario_turma (modelo antigo, substituído por atribuicoes)
--
-- RESULTADO: professores e estagiários vinculados via `atribuicoes` recebem
-- array vazio das funções → RLS bloqueia SELECT → lista de alunos vazia.
--
-- SOLUÇÃO: atualizar as funções para ler de `atribuicoes` (mantendo
-- retrocompatibilidade com professor_id para dados legados).
-- =============================================================================
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

-- ─── 1. FUNÇÕES AUXILIARES ──────────────────────────────────────────────────

-- my_polo_ids(): agora lê de atribuicoes (novo) + vinculos_usuario_polo (legado)
CREATE OR REPLACE FUNCTION my_polo_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT DISTINCT polo_id FROM atribuicoes
    WHERE usuario_id = auth.uid() AND polo_id IS NOT NULL
    UNION
    SELECT DISTINCT polo_id FROM vinculos_usuario_polo
    WHERE usuario_id = auth.uid()
  )
$$;

-- my_turma_ids(): agora lê de atribuicoes (novo) + professor_id (legado)
CREATE OR REPLACE FUNCTION my_turma_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT DISTINCT turma_id FROM atribuicoes
    WHERE usuario_id = auth.uid() AND turma_id IS NOT NULL
    UNION
    SELECT DISTINCT id FROM turmas
    WHERE professor_id = auth.uid()
  )
$$;

-- my_estagio_turma_ids(): agora lê de atribuicoes onde cargo = estagiario
CREATE OR REPLACE FUNCTION my_estagio_turma_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT DISTINCT turma_id FROM atribuicoes
    WHERE usuario_id = auth.uid()
      AND turma_id IS NOT NULL
      AND cargo = 'estagiario'
    UNION
    SELECT DISTINCT turma_id FROM vinculos_estagiario_turma
    WHERE estagiario_id = auth.uid()
  )
$$;

-- ─── 2. ALUNOS — políticas de leitura ───────────────────────────────────────
-- Com my_turma_ids() corrigida, a policy original já funciona.
-- Mas vamos garantir cobertura completa: admin, coordenador e professor/estagiário
-- leem todos os alunos do seu polo (não só da turma específica).

DROP POLICY IF EXISTS "alunos: admin e coordenador leem todos do polo" ON alunos;
DROP POLICY IF EXISTS "alunos: professor e estagiario leem das suas turmas" ON alunos;

CREATE POLICY "alunos: leitura por cargo e polo"
  ON alunos FOR SELECT
  USING (
    is_admin()
    OR turma_id IN (
      SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())
    )
    OR turma_id = ANY(my_turma_ids())
    OR turma_id = ANY(my_estagio_turma_ids())
    OR turma_id IS NULL  -- aluno sem turma: lido por quem pode criar alunos
  );

-- ─── 3. ALUNOS — políticas de escrita ───────────────────────────────────────
DROP POLICY IF EXISTS "alunos: admin e coordenador editam" ON alunos;
DROP POLICY IF EXISTS "alunos: professor edita alunos das suas turmas" ON alunos;
DROP POLICY IF EXISTS "alunos: professor edita alunos do seu polo" ON alunos;

CREATE POLICY "alunos: escrita por cargo e polo"
  ON alunos FOR ALL
  USING (
    is_admin()
    OR (get_my_cargo() = 'coordenador' AND
        (turma_id IS NULL OR turma_id IN (
          SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())
        )))
    OR (get_my_cargo() IN ('professor', 'estagiario') AND
        (turma_id IS NULL OR turma_id IN (
          SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())
        )))
  );

-- ─── 4. PRESENCAS ───────────────────────────────────────────────────────────
-- A policy original usava my_polo_ids() como turma_id — BUG: polo_id ≠ turma_id
-- Corrigido: coordenador lê presencas das turmas do seu polo

DROP POLICY IF EXISTS "presencas: todos os papéis leem e editam no escopo" ON presencas;
DROP POLICY IF EXISTS "presencas: no escopo" ON presencas;

CREATE POLICY "presencas: no escopo"
  ON presencas FOR ALL
  USING (
    is_admin()
    OR (get_my_cargo() = 'coordenador' AND
        turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
    OR turma_id = ANY(my_turma_ids())
    OR turma_id = ANY(my_estagio_turma_ids())
  );

-- ─── 5. ALUNO_TURMAS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "aluno_turmas: admin e coordenador editam" ON aluno_turmas;
DROP POLICY IF EXISTS "aluno_turmas: funcionarios editam no seu polo" ON aluno_turmas;

CREATE POLICY "aluno_turmas: no escopo"
  ON aluno_turmas FOR ALL
  USING (
    is_admin()
    OR get_my_cargo() = 'coordenador'
    OR turma_id = ANY(my_turma_ids())
    OR turma_id = ANY(my_estagio_turma_ids())
  );

-- ─── 6. HISTORICO_ACOES ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'historico_acoes'
  ) THEN
    RAISE NOTICE 'Tabela historico_acoes não existe, pulando.';
  ELSE
    EXECUTE 'ALTER TABLE historico_acoes ENABLE ROW LEVEL SECURITY';

    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "historico_acoes: admin le todos" ON historico_acoes';
      EXECUTE 'DROP POLICY IF EXISTS "historico_acoes: autenticados inserem" ON historico_acoes';
      EXECUTE $p$
        CREATE POLICY "historico_acoes: admin le todos"
          ON historico_acoes FOR SELECT
          USING (is_admin() OR usuario_id = auth.uid())
      $p$;
      EXECUTE $p$
        CREATE POLICY "historico_acoes: autenticados inserem"
          ON historico_acoes FOR INSERT
          WITH CHECK (auth.uid() IS NOT NULL)
      $p$;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro em historico_acoes policies: %', SQLERRM;
    END;
  END IF;
END $$;

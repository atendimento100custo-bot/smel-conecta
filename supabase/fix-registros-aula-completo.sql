-- =============================================================================
-- MIGRATION: fix-registros-aula-completo.sql
--
-- Corrige 3 problemas na tabela registros_aula:
--
-- 1. Falta UNIQUE(turma_id, data) → causava erro "there is no unique or
--    exclusion constraint matching the ON CONFLICT specification" ao salvar
--
-- 2. Falta coluna `fotos text[]` → fotos da aula não eram salvas
--
-- 3. Policy de RLS usava professor_id = auth.uid() → estagiários não
--    conseguiam salvar nenhum registro ("sem permissão")
--
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

-- 1. Adiciona a constraint UNIQUE que permite o UPSERT funcionar
ALTER TABLE registros_aula
  ADD CONSTRAINT registros_aula_turma_id_data_key UNIQUE (turma_id, data);

-- 2. Adiciona coluna fotos (array de URLs)
ALTER TABLE registros_aula
  ADD COLUMN IF NOT EXISTS fotos text[];

-- 3. Corrige a policy de RLS para incluir estagiários

DROP POLICY IF EXISTS "registros_aula: no escopo" ON registros_aula;

CREATE POLICY "registros_aula: no escopo"
  ON registros_aula FOR ALL
  USING (
    is_admin()
    OR (get_my_cargo() = 'coordenador' AND
        turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
    OR turma_id = ANY(my_turma_ids())
    OR turma_id = ANY(my_estagio_turma_ids())
  );

-- 4. Corrige policy de atestados para estagiários também

DROP POLICY IF EXISTS "atestados: admin e coordenador leem todos do polo" ON atestados;
DROP POLICY IF EXISTS "atestados: no escopo" ON atestados;

CREATE POLICY "atestados: no escopo"
  ON atestados FOR ALL
  USING (
    is_admin()
    OR (get_my_cargo() = 'coordenador' AND
        aluno_id IN (
          SELECT id FROM alunos WHERE turma_id IN
            (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
        ))
    OR aluno_id IN (SELECT id FROM alunos WHERE turma_id = ANY(my_turma_ids()))
    OR aluno_id IN (SELECT id FROM alunos WHERE turma_id = ANY(my_estagio_turma_ids()))
  );

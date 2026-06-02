-- =============================================================================
-- MIGRATION: fix-registros-aula-rls.sql
--
-- PROBLEMA: a policy de registros_aula usa `professor_id = auth.uid()` para
-- controlar acesso, o que causa dois bugs:
--   1. Estagiários não conseguem salvar nenhum registro de aula (cargo != 'professor')
--   2. Se dois professores/estagiários compartilham uma turma, o segundo falha
--      no upsert porque o registro existente tem professor_id do primeiro usuário
--
-- SOLUÇÃO: usar my_turma_ids() como critério — se o usuário está atribuído à
-- turma (via atribuicoes), pode ler e gravar o registro dessa turma.
-- =============================================================================
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

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

-- Corrige também atestados: estagiários não tinham acesso para ler atestados
-- dos alunos das suas turmas

DROP POLICY IF EXISTS "atestados: admin e coordenador leem todos do polo" ON atestados;

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

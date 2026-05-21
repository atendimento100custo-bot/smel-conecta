-- =============================================================================
-- MIGRATION: migration-permissions.sql
-- Adiciona permissão de DELETE em turmas para professor
-- (alunos já tem FOR ALL para professor via fix-alunos-rls.sql)
-- =============================================================================

CREATE POLICY "turmas: professor deleta as suas"
  ON turmas FOR DELETE USING (
    get_my_cargo() = 'professor' AND
    (professor_id = auth.uid() OR id = ANY(my_turma_ids()))
  );

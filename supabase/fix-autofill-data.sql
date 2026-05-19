-- =============================================================================
-- MIGRATION: fix-autofill-data.sql
-- Corrige dados cadastrados com autofill do browser:
-- 1. profiles onde nome contém '@' (email no lugar do nome)
-- 2. alunos onde nome contém '@' (email no lugar do nome)
-- =============================================================================
-- EXECUTE NO SUPABASE DASHBOARD → SQL Editor
-- =============================================================================

-- ─── 1. Diagnóstico: ver profiles com email no campo nome ────────────────────
SELECT id, nome, email, cargo
FROM profiles
WHERE nome LIKE '%@%';

-- ─── 2. Corrigir Nathalia: trocar nome pelo email (invertidos) ───────────────
-- Antes de executar, confirmar que o resultado acima mostra:
--   nome = 'nataliascarlat2@gmail.com'  (email no lugar do nome)
--   email = NULL ou nome verdadeiro
--
-- UPDATE: troca nome <-> email para o registro afetado
UPDATE profiles
SET
  email = nome,          -- move o valor do nome (que é email) para o campo email
  nome  = 'Nathalia'     -- PREENCHA o nome real aqui antes de executar!
WHERE nome LIKE '%@%'
  AND nome LIKE '%natalia%';

-- ─── 3. Diagnóstico: ver alunos com email no campo nome ─────────────────────
SELECT id, nome, data_nasc, turma_id, created_at
FROM alunos
WHERE nome LIKE '%@%'
ORDER BY created_at DESC;

-- ─── 4. (Opcional) Corrigir aluno com email no campo nome ────────────────────
-- Rode o SELECT acima primeiro para identificar o(s) registro(s).
-- Depois atualize manualmente com o nome correto:
--
-- UPDATE alunos
-- SET nome = 'Nome Real do Aluno'
-- WHERE id = '<uuid-do-aluno>';

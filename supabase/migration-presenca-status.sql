-- =============================================================================
-- MIGRATION: migration-presenca-status.sql
-- Substitui presente boolean por status text (presente|falta|justificado)
-- Adiciona motivo text para justificativas
-- =============================================================================

-- 1. Adiciona nova coluna (nullable por enquanto para migrar sem erro)
ALTER TABLE presencas ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE presencas ADD COLUMN IF NOT EXISTS motivo text;

-- 2. Migra dados existentes
UPDATE presencas
SET status = CASE
  WHEN presente = true  THEN 'presente'
  WHEN presente = false THEN 'falta'
  ELSE 'falta'
END
WHERE status IS NULL;

-- 3. Torna status obrigatório
ALTER TABLE presencas ALTER COLUMN status SET NOT NULL;

-- 4. Remove coluna antiga
ALTER TABLE presencas DROP COLUMN IF EXISTS presente;

-- 5. Adiciona constraint de valores válidos
ALTER TABLE presencas
  ADD CONSTRAINT presencas_status_check
  CHECK (status IN ('presente', 'falta', 'justificado'));

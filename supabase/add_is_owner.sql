-- supabase/add_is_owner.sql
-- Aplicado em produção em 25/08/2026.
--
-- Distingue "dono do sistema" (uma conta específica) de "admin" (cargo
-- que pode ser dado a várias pessoas pra gerenciar o dia a dia). Telas de
-- manutenção/auditoria (Histórico, Permissões, Infraestrutura) passam a
-- checar is_owner no frontend, não mais cargo = 'admin' genérico.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Marca a conta do Pedro (única com is_owner = true hoje).
UPDATE profiles SET is_owner = true WHERE id = 'f06e86a7-83f6-4eba-9338-0ee37c1651d0';

-- supabase/permissoes_tela.sql
-- Matriz de permissão por tela × cargo, editável pelo admin em /permissoes-acesso.
-- Admin nunca é controlado por esta tabela (sempre tem acesso total, garantido no
-- código do frontend) — aqui só entram as telas "operacionais" (não-admin).

CREATE TABLE permissoes_tela (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tela       text NOT NULL,
  cargo      cargo_enum NOT NULL,
  habilitado boolean NOT NULL DEFAULT true,
  UNIQUE(tela, cargo)
);

ALTER TABLE permissoes_tela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissoes_tela: autenticados leem"
  ON permissoes_tela FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "permissoes_tela: somente admin edita"
  ON permissoes_tela FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Seed com os valores padrão que já valiam antes desta tela existir
-- (os mesmos minRole hardcoded em App.jsx/Sidebar.jsx).
INSERT INTO permissoes_tela (tela, cargo, habilitado) VALUES
  ('dashboard',   'estagiario',  true),
  ('dashboard',   'professor',   true),
  ('dashboard',   'coordenador', true),
  ('polos',       'estagiario',  true),
  ('polos',       'professor',   true),
  ('polos',       'coordenador', true),
  ('presenca',    'estagiario',  true),
  ('presenca',    'professor',   true),
  ('presenca',    'coordenador', true),
  ('modalidades', 'estagiario',  false),
  ('modalidades', 'professor',   false),
  ('modalidades', 'coordenador', true),
  ('alunos',      'estagiario',  false),
  ('alunos',      'professor',   true),
  ('alunos',      'coordenador', true),
  ('equipes',     'estagiario',  false),
  ('equipes',     'professor',   false),
  ('equipes',     'coordenador', true),
  ('relatorios',  'estagiario',  false),
  ('relatorios',  'professor',   true),
  ('relatorios',  'coordenador', true)
ON CONFLICT (tela, cargo) DO NOTHING;

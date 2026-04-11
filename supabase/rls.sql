-- supabase/rls.sql
-- Habilita RLS em todas as tabelas
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE polos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_usuario_polo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalidades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_estagiario_turma ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE atestados               ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_aula          ENABLE ROW LEVEL SECURITY;
ALTER TABLE viagens                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes_viagem    ENABLE ROW LEVEL SECURITY;

-- Funções auxiliares
CREATE OR REPLACE FUNCTION get_my_cargo()
RETURNS cargo_enum LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT cargo FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT get_my_cargo() = 'admin'
$$;

CREATE OR REPLACE FUNCTION my_polo_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(polo_id) FROM vinculos_usuario_polo WHERE usuario_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_turma_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(id) FROM turmas WHERE professor_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_estagio_turma_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(turma_id) FROM vinculos_estagiario_turma WHERE estagiario_id = auth.uid()
$$;

-- === PROFILES ===
CREATE POLICY "profiles: leitura própria e admin"
  ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles: admin gerencia todos"
  ON profiles FOR ALL USING (is_admin());

-- === POLOS ===
CREATE POLICY "polos: todos leem"
  ON polos FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "polos: somente admin edita"
  ON polos FOR ALL USING (is_admin());

-- === VINCULOS USUARIO POLO ===
CREATE POLICY "vinculos_polo: admin gerencia"
  ON vinculos_usuario_polo FOR ALL USING (is_admin());

CREATE POLICY "vinculos_polo: usuario lê os seus"
  ON vinculos_usuario_polo FOR SELECT USING (usuario_id = auth.uid());

-- === MODALIDADES ===
CREATE POLICY "modalidades: todos leem"
  ON modalidades FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "modalidades: admin e coordenador editam"
  ON modalidades FOR ALL USING (
    is_admin() OR get_my_cargo() = 'coordenador'
  );

-- === TURMAS ===
CREATE POLICY "turmas: todos leem"
  ON turmas FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "turmas: admin e coordenador editam qualquer"
  ON turmas FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND polo_id = ANY(my_polo_ids()))
  );

CREATE POLICY "turmas: professor edita as suas"
  ON turmas FOR UPDATE USING (
    get_my_cargo() = 'professor' AND professor_id = auth.uid()
  );

-- === VINCULOS ESTAGIARIO TURMA ===
CREATE POLICY "vinculos_estagio: admin e coordenador gerenciam"
  ON vinculos_estagiario_turma FOR ALL USING (
    is_admin() OR get_my_cargo() = 'coordenador'
  );

CREATE POLICY "vinculos_estagio: estagiario lê os seus"
  ON vinculos_estagiario_turma FOR SELECT USING (estagiario_id = auth.uid());

-- === ALUNOS ===
CREATE POLICY "alunos: admin e coordenador leem todos do polo"
  ON alunos FOR SELECT USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

CREATE POLICY "alunos: professor e estagiario leem das suas turmas"
  ON alunos FOR SELECT USING (
    turma_id = ANY(my_turma_ids()) OR
    turma_id = ANY(my_estagio_turma_ids())
  );

CREATE POLICY "alunos: admin e coordenador editam"
  ON alunos FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

CREATE POLICY "alunos: professor edita alunos das suas turmas"
  ON alunos FOR ALL USING (
    get_my_cargo() = 'professor' AND turma_id = ANY(my_turma_ids())
  );

-- === PRESENCAS ===
CREATE POLICY "presencas: todos os papéis leem e editam no escopo"
  ON presencas FOR ALL USING (
    is_admin() OR
    turma_id = ANY(my_polo_ids()) OR
    turma_id = ANY(my_turma_ids()) OR
    turma_id = ANY(my_estagio_turma_ids()) OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))
  );

-- === ATESTADOS ===
CREATE POLICY "atestados: admin e coordenador leem todos do polo"
  ON atestados FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      aluno_id IN (
        SELECT id FROM alunos WHERE turma_id IN
          (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
      )) OR
    (get_my_cargo() = 'professor' AND
      aluno_id IN (SELECT id FROM alunos WHERE turma_id = ANY(my_turma_ids())))
  );

-- === REGISTROS AULA ===
CREATE POLICY "registros_aula: no escopo"
  ON registros_aula FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND
      turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))) OR
    (get_my_cargo() = 'professor' AND professor_id = auth.uid())
  );

-- === VIAGENS ===
CREATE POLICY "viagens: no escopo"
  ON viagens FOR ALL USING (
    is_admin() OR
    (get_my_cargo() = 'coordenador' AND polo_id = ANY(my_polo_ids())) OR
    (get_my_cargo() = 'professor' AND turma_id = ANY(my_turma_ids()))
  );

-- === PARTICIPANTES VIAGEM ===
CREATE POLICY "participantes_viagem: no escopo da viagem"
  ON participantes_viagem FOR ALL USING (
    is_admin() OR
    viagem_id IN (SELECT id FROM viagens WHERE polo_id = ANY(my_polo_ids())) OR
    viagem_id IN (SELECT id FROM viagens WHERE turma_id = ANY(my_turma_ids()))
  );

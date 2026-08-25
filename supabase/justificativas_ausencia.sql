-- supabase/justificativas_ausencia.sql
-- Falta justificada antecipada: aluno/responsável avisa ANTES, com motivo e período.
-- A chamada passa a considerar automaticamente esse período como "Justificado".
-- Vale para TODAS as turmas do aluno (matrícula principal + matrículas extras),
-- o que também resolve o caso de aluno com dupla matrícula que só vai numa turma no dia.

CREATE TABLE justificativas_ausencia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id     uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  data_inicio  date NOT NULL,
  data_fim     date NOT NULL,
  motivo       text NOT NULL,
  criado_por   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT justificativas_periodo_valido CHECK (data_fim >= data_inicio)
);

CREATE INDEX idx_justificativas_aluno    ON justificativas_ausencia(aluno_id);
CREATE INDEX idx_justificativas_periodo  ON justificativas_ausencia(data_inicio, data_fim);

ALTER TABLE justificativas_ausencia ENABLE ROW LEVEL SECURITY;

-- Escopo: admin e coordenador têm acesso total; professor e estagiário
-- podem cadastrar/ler para alunos matriculados (principal ou extra) em
-- turmas dos polos aos quais estão vinculados (mesmo padrão de "alunos").
CREATE POLICY "justificativas: no escopo"
  ON justificativas_ausencia FOR ALL
  USING (
    is_admin()
    OR get_my_cargo() = 'coordenador'
    OR (
      get_my_cargo() IN ('professor', 'estagiario')
      AND EXISTS (
        SELECT 1 FROM alunos a
        WHERE a.id = justificativas_ausencia.aluno_id
          AND (
            a.turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
            OR EXISTS (
              SELECT 1 FROM aluno_turmas at2
              JOIN turmas t2 ON t2.id = at2.turma_id
              WHERE at2.aluno_id = a.id AND t2.polo_id = ANY(my_polo_ids())
            )
          )
      )
    )
  )
  WITH CHECK (
    is_admin()
    OR get_my_cargo() = 'coordenador'
    OR (
      get_my_cargo() IN ('professor', 'estagiario')
      AND EXISTS (
        SELECT 1 FROM alunos a
        WHERE a.id = justificativas_ausencia.aluno_id
          AND (
            a.turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
            OR EXISTS (
              SELECT 1 FROM aluno_turmas at2
              JOIN turmas t2 ON t2.id = at2.turma_id
              WHERE at2.aluno_id = a.id AND t2.polo_id = ANY(my_polo_ids())
            )
          )
      )
    )
  );

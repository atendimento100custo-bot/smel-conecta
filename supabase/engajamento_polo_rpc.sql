-- Função RPC: engajamento_polo
-- Agrega histórico COMPLETO de presenças de um polo no banco.
-- O browser recebe apenas 1 linha por aluno (não os registros brutos).
--
-- Como aplicar: cole este bloco no SQL Editor do Supabase e execute.

CREATE OR REPLACE FUNCTION engajamento_polo(p_polo_id uuid)
RETURNS TABLE (
  aluno_id        uuid,
  total_aulas     bigint,
  aulas_presente  bigint,
  freq_pct        integer,
  ultima_presenca date,
  dias_afastado   integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.aluno_id,
    COUNT(*)::bigint
      AS total_aulas,
    COUNT(*) FILTER (WHERE p.status IN ('presente', 'justificado'))::bigint
      AS aulas_presente,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE p.status IN ('presente', 'justificado'))
        * 100.0 / COUNT(*)
      )::integer
      ELSE NULL
    END
      AS freq_pct,
    MAX(p.data) FILTER (WHERE p.status = 'presente')
      AS ultima_presenca,
    CASE
      WHEN MAX(p.data) FILTER (WHERE p.status = 'presente') IS NOT NULL
      THEN (CURRENT_DATE - MAX(p.data) FILTER (WHERE p.status = 'presente'))::integer
      ELSE NULL
    END
      AS dias_afastado
  FROM presencas p
  JOIN turmas t ON t.id = p.turma_id
  WHERE t.polo_id = p_polo_id
  GROUP BY p.aluno_id
$$;

-- Permissão para anon e authenticated (protegida por SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION engajamento_polo(uuid) TO anon, authenticated;

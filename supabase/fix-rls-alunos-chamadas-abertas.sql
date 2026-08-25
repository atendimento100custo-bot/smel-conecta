-- supabase/fix-rls-alunos-chamadas-abertas.sql
-- Aplicado em produção em 25/08/2026.
--
-- Achado: verificando pg_policies ao vivo, a tabela `alunos` tinha DUAS
-- políticas de SELECT simultâneas — uma escopada por polo/turma
-- ("alunos: leitura por cargo e polo") e uma antiga, aberta, nunca removida
-- ("alunos: autenticados leem todos", de fix-rls-and-email.sql). Como o
-- Postgres combina políticas do mesmo comando com OR, a aberta anulava a
-- escopada: qualquer usuário logado lia o cadastro de TODOS os alunos do
-- sistema, de qualquer polo. A tabela `chamadas` tinha uma política
-- `FOR ALL USING (true)` — sem condição nenhuma.
--
-- Antes de corrigir, foi confirmado ao vivo que my_polo_ids()/my_turma_ids()/
-- my_estagio_turma_ids() JÁ tinham sido atualizadas (fora deste repositório)
-- para usar a tabela `atribuicoes` como fonte de verdade — o mesmo padrão
-- que `presencas: no escopo` já usa em produção com sucesso. As correções
-- abaixo replicam esse padrão já comprovado, e ainda cobrem o caso de
-- matrícula dupla (aluno_turmas) que o site já trata desde a correção da
-- chamada (aluno_turmas fix, mesma sessão).

-- 1) ALUNOS (SELECT): mantém a lógica existente, adiciona cobertura de
--    matrícula dupla via aluno_turmas.
DROP POLICY IF EXISTS "alunos: leitura por cargo e polo" ON alunos;
CREATE POLICY "alunos: leitura por cargo e polo"
  ON alunos FOR SELECT USING (
    is_admin()
    OR turma_id IS NULL
    OR turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
    OR turma_id = ANY(my_turma_ids())
    OR turma_id = ANY(my_estagio_turma_ids())
    OR EXISTS (
      SELECT 1 FROM aluno_turmas at
      WHERE at.aluno_id = alunos.id
        AND (
          at.turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))
          OR at.turma_id = ANY(my_turma_ids())
          OR at.turma_id = ANY(my_estagio_turma_ids())
        )
    )
  );

-- Remove a política aberta que anulava a de cima.
DROP POLICY IF EXISTS "alunos: autenticados leem todos" ON alunos;

-- 2) ALUNOS (escrita): mesma extensão de matrícula dupla, preservando a
--    lógica de escopo já existente (coordenador/professor/estagiário no polo).
DROP POLICY IF EXISTS "alunos: escrita por cargo e polo" ON alunos;
CREATE POLICY "alunos: escrita por cargo e polo"
  ON alunos FOR ALL USING (
    is_admin()
    OR ((get_my_cargo() = 'coordenador') AND ((turma_id IS NULL) OR (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))))
    OR ((get_my_cargo() = ANY(ARRAY['professor','estagiario']::cargo_enum[])) AND ((turma_id IS NULL) OR (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))))
    OR EXISTS (
      SELECT 1 FROM aluno_turmas at
      JOIN turmas t ON t.id = at.turma_id
      WHERE at.aluno_id = alunos.id AND t.polo_id = ANY(my_polo_ids())
    )
  )
  WITH CHECK (
    is_admin()
    OR ((get_my_cargo() = 'coordenador') AND ((turma_id IS NULL) OR (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))))
    OR ((get_my_cargo() = ANY(ARRAY['professor','estagiario']::cargo_enum[])) AND ((turma_id IS NULL) OR (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids())))))
    OR EXISTS (
      SELECT 1 FROM aluno_turmas at
      JOIN turmas t ON t.id = at.turma_id
      WHERE at.aluno_id = alunos.id AND t.polo_id = ANY(my_polo_ids())
    )
  );

-- 3) CHAMADAS: estava totalmente aberta. Escopa exatamente como `presencas`
--    (padrão já em produção e comprovado, usando as mesmas funções).
DROP POLICY IF EXISTS "autenticados_chamadas" ON chamadas;
CREATE POLICY "chamadas: no escopo"
  ON chamadas FOR ALL USING (
    is_admin()
    OR ((get_my_cargo() = 'coordenador') AND (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
    OR (turma_id = ANY(my_turma_ids()))
    OR (turma_id = ANY(my_estagio_turma_ids()))
  )
  WITH CHECK (
    is_admin()
    OR ((get_my_cargo() = 'coordenador') AND (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
    OR (turma_id = ANY(my_turma_ids()))
    OR (turma_id = ANY(my_estagio_turma_ids()))
  );

-- Verificação pós-aplicação (rodada em produção): impersonando um professor
-- real via SET LOCAL role authenticated + request.jwt.claims, dentro de uma
-- transação com ROLLBACK (sem efeitos colaterais) — confirmado que o acesso
-- reflete o escopo por atribuições, sem lockout nem vazamento.

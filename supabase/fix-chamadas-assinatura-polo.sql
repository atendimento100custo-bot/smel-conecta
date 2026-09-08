-- supabase/fix-chamadas-assinatura-polo.sql
--
-- BUG ENCONTRADO (08/09/2026): Priscila e Matilde não conseguiam "Iniciar Aula"
-- na turma de Pilates 13:30 da Arena Voldac (o botão verde não fazia nada —
-- a tela simplesmente continuava mostrando "Iniciar Aula" em vez de abrir a
-- lista de alunos), mesmo o admin conseguindo iniciar a mesma turma sem
-- problema.
--
-- CAUSA (confirmada lendo a política de RLS de `chamadas`, aplicada em
-- fix-rls-alunos-chamadas-abertas.sql em 25/08/2026): ela é assimétrica em
-- relação às políticas de `alunos` e `presencas` — só o coordenador ganha
-- acesso à turma inteira do polo através de um vínculo de nível POLO
-- (atribuicoes.turma_id IS NULL, atribuicoes.polo_id definido — o "presença
-- no polo"). Professor e estagiário só passam pela política se tiverem um
-- vínculo direto de nível TURMA (my_turma_ids()/my_estagio_turma_ids()).
--
-- Só que um vínculo de nível polo para professor/estagiário EXISTE
-- exatamente pra cobrir "presença no polo" (é assim que o resto do sistema
-- trata esse tipo de vínculo — alunos e presencas já dão acesso ao polo
-- inteiro pra qualquer cargo com vínculo de polo). A política de `chamadas`
-- ficou desalinhada: alguém com vínculo de polo consegue VER os alunos e as
-- presenças de qualquer turma do polo, mas não consegue criar a linha em
-- `chamadas` que libera a lista pra fazer a chamada — o insert é bloqueado
-- pelo RLS (silenciosamente: o código não mostra erro nesse caso, só não
-- avança de tela).
--
-- Esse bug sozinho já explica o caso da Priscila Xavier Barbosa Fontoura:
-- ela só tem um vínculo de POLO na Arena Voldac (mais um vínculo de turma de
-- quinta-feira 13:30 — turma diferente da de terça). Sem vínculo direto na
-- turma de terça, `chamadas` bloqueava ela nessa turma especificamente.
--
-- (O caso da Matilde, que tem vínculo DIRETO na turma de terça, ainda
-- precisa ser conferido ao vivo — client 2.1 de RLS impersonation ficou
-- pendente por falta de acesso à conta certa do Supabase no navegador no
-- momento desse commit. Esse fix aqui é aplicado de qualquer forma porque é
-- um bug real e confirmado por leitura direta da política, independente do
-- caso dela.)
--
-- FIX: alinhar `chamadas` com o mesmo padrão já usado em `alunos` (escrita)
-- e implicitamente em `presencas` — professor/estagiário com vínculo de polo
-- também têm acesso a `chamadas` de qualquer turma desse polo.

DROP POLICY IF EXISTS "chamadas: no escopo" ON chamadas;
CREATE POLICY "chamadas: no escopo"
  ON chamadas FOR ALL USING (
    is_admin()
    OR ((get_my_cargo() = 'coordenador') AND (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
    OR ((get_my_cargo() = ANY(ARRAY['professor','estagiario']::cargo_enum[])) AND (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
    OR (turma_id = ANY(my_turma_ids()))
    OR (turma_id = ANY(my_estagio_turma_ids()))
  )
  WITH CHECK (
    is_admin()
    OR ((get_my_cargo() = 'coordenador') AND (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
    OR ((get_my_cargo() = ANY(ARRAY['professor','estagiario']::cargo_enum[])) AND (turma_id IN (SELECT id FROM turmas WHERE polo_id = ANY(my_polo_ids()))))
    OR (turma_id = ANY(my_turma_ids()))
    OR (turma_id = ANY(my_estagio_turma_ids()))
  );

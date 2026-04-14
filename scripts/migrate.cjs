/**
 * SMEL Conecta — Database Migration
 * Adds telefone_emergencia column and aluno_turmas table
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pgkyvgmlfmgptxyhovqk.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBna3l2Z21sZm1ncHR4eWhvdnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzNzk4MiwiZXhwIjoyMDkxNTEzOTgyfQ.IORqMIovCDV0LvheICTQH-46dAaphVZz7AD0ldpXLKg'
const PROJECT_REF  = 'pgkyvgmlfmgptxyhovqk'

async function runSQL(label, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (!res.ok) {
    console.error(`❌ ${label}:`, json)
  } else {
    console.log(`✓  ${label}`)
  }
  return res.ok
}

async function main() {
  console.log('\n🚀 SMEL Conecta — Rodando migrações...\n')

  await runSQL(
    'Coluna telefone_emergencia em alunos',
    `ALTER TABLE alunos ADD COLUMN IF NOT EXISTS telefone_emergencia text`
  )

  await runSQL(
    'Tabela aluno_turmas',
    `CREATE TABLE IF NOT EXISTS aluno_turmas (
      id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      aluno_id  uuid REFERENCES alunos(id) ON DELETE CASCADE,
      turma_id  uuid REFERENCES turmas(id) ON DELETE CASCADE,
      criado_em timestamptz DEFAULT now(),
      UNIQUE(aluno_id, turma_id)
    )`
  )

  await runSQL(
    'RLS em aluno_turmas',
    `ALTER TABLE aluno_turmas ENABLE ROW LEVEL SECURITY`
  )

  await runSQL(
    'Policy allow all em aluno_turmas',
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_policies WHERE tablename = 'aluno_turmas' AND policyname = 'allow all'
       ) THEN
         CREATE POLICY "allow all" ON aluno_turmas FOR ALL USING (true) WITH CHECK (true);
       END IF;
     END $$`
  )

  await runSQL(
    'Populando aluno_turmas a partir de alunos.turma_id existentes',
    `INSERT INTO aluno_turmas (aluno_id, turma_id)
     SELECT id, turma_id FROM alunos
     WHERE turma_id IS NOT NULL
     ON CONFLICT (aluno_id, turma_id) DO NOTHING`
  )

  console.log('\n✅ Migrações concluídas!\n')
}

main().catch(console.error)

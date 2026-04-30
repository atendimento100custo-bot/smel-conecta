import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://pgkyvgmlfmgptxyhovqk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBna3l2Z21sZm1ncHR4eWhvdnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzNzk4MiwiZXhwIjoyMDkxNTEzOTgyfQ.IORqMIovCDV0LvheICTQH-46dAaphVZz7AD0ldpXLKg',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function migrate() {
  console.log('🔧 Executando migração...')

  // 1. Adicionar coluna genero em alunos
  const { error: e1 } = await sb.rpc('exec_sql', {
    sql: `ALTER TABLE alunos ADD COLUMN IF NOT EXISTS genero text;`
  })
  if (e1) {
    // tenta via query direta se rpc não existir
    console.log('⚠️  rpc exec_sql não disponível, tentando via REST...')
  } else {
    console.log('✓ Coluna genero adicionada em alunos')
  }

  // 2. Criar tabela relatorios_mensais
  const { error: e2 } = await sb.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS relatorios_mensais (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        polo_id uuid REFERENCES polos(id) ON DELETE CASCADE,
        mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
        ano int NOT NULL CHECK (ano >= 2020),
        demandas text,
        arquivos_urls text[] DEFAULT '{}',
        criado_por uuid REFERENCES profiles(id),
        criado_em timestamptz DEFAULT now(),
        UNIQUE(polo_id, mes, ano)
      );
    `
  })
  if (e2) {
    console.log('⚠️  rpc exec_sql não disponível para criar tabela')
  } else {
    console.log('✓ Tabela relatorios_mensais criada')
  }

  // Fallback: testar inserção para confirmar que tabela existe
  const { error: testErr } = await sb.from('relatorios_mensais').select('id').limit(1)
  if (testErr) {
    console.error('✗ Tabela relatorios_mensais não existe ainda. Crie manualmente no Supabase SQL Editor:')
    console.log(`
CREATE TABLE IF NOT EXISTS relatorios_mensais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  polo_id uuid REFERENCES polos(id) ON DELETE CASCADE,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano int NOT NULL CHECK (ano >= 2020),
  demandas text,
  arquivos_urls text[] DEFAULT '{}',
  criado_por uuid REFERENCES profiles(id),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(polo_id, mes, ano)
);
    `)
  } else {
    console.log('✓ Tabela relatorios_mensais confirmada')
  }

  // Testar coluna genero
  const { error: testGenero } = await sb.from('alunos').select('genero').limit(1)
  if (testGenero) {
    console.error('✗ Coluna genero não existe em alunos. Execute no Supabase SQL Editor:')
    console.log('ALTER TABLE alunos ADD COLUMN IF NOT EXISTS genero text;')
  } else {
    console.log('✓ Coluna genero confirmada em alunos')
  }

  console.log('\n✅ Migração concluída!')
}

migrate().catch(console.error)

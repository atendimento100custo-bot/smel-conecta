import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pgkyvgmlfmgptxyhovqk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBna3l2Z21sZm1ncHR4eWhvdnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzNzk4MiwiZXhwIjoyMDkxNTEzOTgyfQ.IORqMIovCDV0LvheICTQH-46dAaphVZz7AD0ldpXLKg'
)

async function limpar() {
  console.log('Deletando presencas...')
  await supabase.from('presencas').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Deletando atestados...')
  await supabase.from('atestados').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Deletando registros_aula...')
  await supabase.from('registros_aula').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Deletando alunos...')
  await supabase.from('alunos').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Deletando atribuicoes com turma_id...')
  await supabase.from('atribuicoes').delete().not('turma_id', 'is', null)

  console.log('Deletando turmas...')
  await supabase.from('turmas').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('✅ Concluído!')
}

limpar().catch(console.error)

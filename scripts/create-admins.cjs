/**
 * SMEL Conecta — Criar logins de administradores
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pgkyvgmlfmgptxyhovqk.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBna3l2Z21sZm1ncHR4eWhvdnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzNzk4MiwiZXhwIjoyMDkxNTEzOTgyfQ.IORqMIovCDV0LvheICTQH-46dAaphVZz7AD0ldpXLKg'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const ADMINS = [
  { nome: 'Daniel Alves',   email: 'professordaniel_93@hotmail.com', senha: 'Smel@2025!Da' },
  { nome: 'Rafael Alvarenga', email: 'aalvarenga.rafael@gmail.com',  senha: 'Smel@2025!Ra' },
  { nome: 'Raul Victorino', email: 'raulvictorino1967@gmail.com',    senha: 'Smel@2025!Rv' },
  { nome: 'Rose Vilela',    email: 'rosemvilela@yahoo.com.br',       senha: 'Smel@2025!Ro' },
  { nome: 'Vivian Bastos',  email: 'vivibastosmonteiro@outlook.com', senha: 'Smel@2025!Vb' },
  { nome: 'Viviane Souza',  email: 'viviane.pss01@gmail.com',        senha: 'Smel@2025!Vs' },
  { nome: 'Silvio',         email: 'silvio.vilela@foa.org.br',       senha: 'Smel@2025!Si' },
]

async function main() {
  console.log('\n🚀 Criando logins de administradores...\n')

  for (const admin of ADMINS) {
    // 1. Criar usuário no auth
    const { data, error } = await sb.auth.admin.createUser({
      email: admin.email,
      password: admin.senha,
      email_confirm: true,
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        console.log(`⚠  ${admin.nome} (${admin.email}) — já existe, pulando`)
      } else {
        console.error(`❌ ${admin.nome}: ${error.message}`)
      }
      continue
    }

    const userId = data.user.id

    // 2. Inserir/atualizar profile com cargo admin
    const { error: pErr } = await sb.from('profiles').upsert({
      id: userId,
      nome: admin.nome,
      cargo: 'admin',
      ativo: true,
    }, { onConflict: 'id' })

    if (pErr) {
      console.error(`❌ Profile de ${admin.nome}: ${pErr.message}`)
    } else {
      console.log(`✓  ${admin.nome} — ${admin.email} | senha: ${admin.senha}`)
    }
  }

  console.log('\n✅ Concluído!\n')
}

main().catch(console.error)

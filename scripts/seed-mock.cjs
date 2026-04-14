/**
 * SMEL Conecta — Mock Data Seeder
 * Run: node scripts/seed-mock.js
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pgkyvgmlfmgptxyhovqk.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBna3l2Z21sZm1ncHR4eWhvdnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzNzk4MiwiZXhwIjoyMDkxNTEzOTgyfQ.IORqMIovCDV0LvheICTQH-46dAaphVZz7AD0ldpXLKg'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🌱 Iniciando seed de dados mockados...\n')

  // ── 1. Buscar polos e modalidades existentes ──────────────────────────────
  const { data: polos } = await sb.from('polos').select('id,nome').eq('status','Ativo').limit(10)
  const { data: mods  } = await sb.from('modalidades').select('id,nome,emoji')

  if (!polos?.length || !mods?.length) {
    console.error('❌ Polos ou Modalidades não encontrados. Execute o seed.sql primeiro.')
    process.exit(1)
  }

  console.log(`✓ ${polos.length} polos encontrados`)
  console.log(`✓ ${mods.length} modalidades encontradas\n`)

  // ── 2. Criar usuários da equipe ───────────────────────────────────────────
  const staff = [
    { email: 'prof.carlos@smel.vr.gov.br',    senha: 'Smel@2025', nome: 'Carlos Eduardo Souza',    cargo: 'professor'    },
    { email: 'prof.ana@smel.vr.gov.br',        senha: 'Smel@2025', nome: 'Ana Paula Ferreira',      cargo: 'professor'    },
    { email: 'prof.rodrigo@smel.vr.gov.br',    senha: 'Smel@2025', nome: 'Rodrigo Almeida Lima',   cargo: 'professor'    },
    { email: 'coord.marcia@smel.vr.gov.br',    senha: 'Smel@2025', nome: 'Márcia Regina Costa',    cargo: 'coordenador'  },
    { email: 'estag.lucas@smel.vr.gov.br',     senha: 'Smel@2025', nome: 'Lucas Pereira Santos',   cargo: 'estagiario'   },
  ]

  const professorIds = []
  for (const s of staff) {
    // Tentar criar usuário (ignora se já existir)
    const { data: existing } = await sb.auth.admin.listUsers()
    const userExists = existing?.users?.find(u => u.email === s.email)

    let uid
    if (userExists) {
      uid = userExists.id
      console.log(`  → ${s.nome} já existe`)
    } else {
      const { data: created, error } = await sb.auth.admin.createUser({
        email: s.email,
        password: s.senha,
        email_confirm: true,
        user_metadata: { nome: s.nome },
      })
      if (error) { console.error(`  ✗ Erro ao criar ${s.nome}:`, error.message); continue }
      uid = created.user.id
      console.log(`  + Criado: ${s.nome} (${s.cargo})`)
    }

    // Atualizar perfil
    await sb.from('profiles').upsert({ id: uid, nome: s.nome, cargo: s.cargo, ativo: true }, { onConflict: 'id' })
    if (s.cargo === 'professor') professorIds.push(uid)
  }
  console.log()

  // ── 3. Criar turmas ───────────────────────────────────────────────────────
  const diasOpcoes = [
    ['Segunda','Quarta','Sexta'],
    ['Terça','Quinta'],
    ['Segunda','Quarta'],
    ['Terça','Quinta','Sábado'],
    ['Segunda','Sexta'],
    ['Quarta','Sábado'],
  ]
  const horarios  = ['07:00','08:00','09:00','10:00','15:00','16:00','17:00','18:00']
  const faixas    = ['Infantil','Adulto','Adulto','Adulto','Melhor Idade','Melhor Idade']

  const turmasParaInserir = []
  // 2 turmas por polo (até 6 polos)
  for (let i = 0; i < Math.min(polos.length, 6); i++) {
    const polo = polos[i]
    for (let j = 0; j < 2; j++) {
      const mod = mods[(i * 2 + j) % mods.length]
      turmasParaInserir.push({
        polo_id:       polo.id,
        modalidade_id: mod.id,
        professor_id:  professorIds[j % professorIds.length] ?? null,
        faixa:         faixas[(i + j) % faixas.length],
        dias:          diasOpcoes[(i + j) % diasOpcoes.length],
        horario:       horarios[(i * 2 + j) % horarios.length],
        capacidade:    randomInt(15, 30),
        status:        'Ativa',
      })
    }
  }

  // Limpar turmas antigas de mock (mantém as com alunos se houver FK)
  const { data: turmasInseridas, error: errT } = await sb.from('turmas').insert(turmasParaInserir).select('id,polo_id,modalidade_id,faixa,capacidade')
  if (errT) { console.error('Erro ao inserir turmas:', errT.message) } else {
    console.log(`✓ ${turmasInseridas.length} turmas criadas`)
  }

  // ── 4. Criar alunos ───────────────────────────────────────────────────────
  const nomesM = ['João Victor','Pedro Henrique','Lucas Gabriel','Mateus Costa','Rafael Souza','Bruno Oliveira','Diego Santos','André Lima','Felipe Rocha','Gustavo Alves']
  const nomesF = ['Maria Clara','Ana Beatriz','Larissa Ferreira','Juliana Mendes','Camila Costa','Fernanda Lima','Patrícia Souza','Renata Carvalho','Aline Santos','Vitória Pereira']
  const nomesIdosos = ['Dona Maria','Seu José','Dona Aparecida','Seu Francisco','Dona Helena','Seu Antônio','Dona Rosa','Seu Manoel','Dona Conceição','Seu Benedito']
  const bairros = ['Aterrado','Retiro','Vila Rica','Jardim Amália','Volta Grande','Siderlândia','Belmonte','Conforto','Eucaliptal','Vila Brasília']

  const alunosParaInserir = []
  const hoje = new Date()

  for (const turma of (turmasInseridas ?? [])) {
    const qtd = randomInt(8, Math.min(turma.capacidade, 18))
    const isMI = turma.faixa === 'Melhor Idade'
    const nomes = isMI ? nomesIdosos : [...nomesM, ...nomesF]

    for (let i = 0; i < qtd; i++) {
      const nome = nomes[i % nomes.length] + ' ' + ['Silva','Santos','Oliveira','Costa','Pereira','Lima','Carvalho','Souza','Rodrigues','Almeida'][randomInt(0,9)]
      const idadeMin = isMI ? 60 : (turma.faixa === 'Infantil' ? 6 : 18)
      const idadeMax = isMI ? 80 : (turma.faixa === 'Infantil' ? 17 : 59)
      const idade    = randomInt(idadeMin, idadeMax)
      const anoNasc  = hoje.getFullYear() - idade
      const dataNasc = `${anoNasc}-${String(randomInt(1,12)).padStart(2,'0')}-${String(randomInt(1,28)).padStart(2,'0')}`
      const diasMatri = randomInt(1, 365)
      const status   = Math.random() > 0.1 ? 'Ativo' : (Math.random() > 0.5 ? 'Inativo' : 'Transferido')

      alunosParaInserir.push({
        nome,
        data_nasc:      dataNasc,
        cpf:            `${randomInt(100,999)}.${randomInt(100,999)}.${randomInt(100,999)}-${randomInt(10,99)}`,
        telefone:       `(24) 9${randomInt(8000,9999)}-${randomInt(1000,9999)}`,
        endereco:       `Rua ${['das Flores','dos Pinheiros','do Comércio','da Paz','Sete de Setembro'][randomInt(0,4)]}, ${randomInt(10,999)} — ${pick(bairros)}`,
        turma_id:       turma.id,
        status,
        data_matricula: daysAgo(diasMatri),
      })
    }
  }

  const { data: alunosInseridos, error: errA } = await sb.from('alunos').insert(alunosParaInserir).select('id,turma_id,status')
  if (errA) { console.error('Erro ao inserir alunos:', errA.message) } else {
    console.log(`✓ ${alunosInseridos.length} alunos criados`)
  }

  // ── 5. Criar presenças (últimos 30 dias) ──────────────────────────────────
  const DIAS_JS = { 'Segunda':1,'Terça':2,'Quarta':3,'Quinta':4,'Sexta':5,'Sábado':6,'Domingo':0 }
  const presencasParaInserir = []

  const alunosPorTurma = {}
  for (const a of (alunosInseridos ?? [])) {
    if (a.status === 'Ativo') {
      if (!alunosPorTurma[a.turma_id]) alunosPorTurma[a.turma_id] = []
      alunosPorTurma[a.turma_id].push(a.id)
    }
  }

  // Rebuilding turmas map with dias
  for (const t of (turmasInseridas ?? [])) {
    const alunosTurma = alunosPorTurma[t.id] ?? []
    if (!alunosTurma.length || !t.dias) continue

    for (let d = 0; d <= 30; d++) {
      const data = new Date(); data.setDate(data.getDate() - d)
      const diaSemana = data.getDay()
      const dataStr   = data.toISOString().split('T')[0]

      const temAula = (t.dias || []).some(dia => DIAS_JS[dia] === diaSemana)
      if (!temAula) continue

      for (const alunoId of alunosTurma) {
        presencasParaInserir.push({
          turma_id:  t.id,
          aluno_id:  alunoId,
          data:      dataStr,
          presente:  Math.random() > 0.25, // 75% presença
        })
      }
    }
  }

  if (presencasParaInserir.length > 0) {
    // Inserir em lotes de 500
    const BATCH = 500
    let total = 0
    for (let i = 0; i < presencasParaInserir.length; i += BATCH) {
      const lote = presencasParaInserir.slice(i, i + BATCH)
      const { error: errP } = await sb.from('presencas').insert(lote)
      if (errP) { console.error('Erro ao inserir presenças:', errP.message); break }
      total += lote.length
    }
    console.log(`✓ ${total} presenças criadas (30 dias)`)
  }

  // ── 6. Criar atestados ────────────────────────────────────────────────────
  // Alunos Melhor Idade precisam de atestado
  const alunosMI = (alunosInseridos ?? []).filter(a => {
    const t = turmasInseridas?.find(t => t.id === a.turma_id)
    return t?.faixa === 'Melhor Idade' && a.status === 'Ativo'
  })

  const atestadosParaInserir = []
  for (const a of alunosMI) {
    const tipo = Math.random()
    let validade
    if (tipo < 0.5)       validade = daysFromNow(randomInt(60, 300))   // válido
    else if (tipo < 0.75) validade = daysFromNow(randomInt(1, 25))     // vencendo
    else                  validade = daysAgo(randomInt(1, 90))          // vencido

    atestadosParaInserir.push({
      aluno_id:      a.id,
      data_emissao:  daysAgo(randomInt(30, 180)),
      data_validade: validade,
      observacao:    pick(['Apto para atividade física moderada','Apto sem restrições','Recomendado exercícios de baixo impacto',null]),
    })
  }

  // Alguns alunos adultos também
  const alunosAdultos = (alunosInseridos ?? []).slice(0, 10).filter(a => {
    const t = turmasInseridas?.find(t => t.id === a.turma_id)
    return t?.faixa !== 'Melhor Idade'
  })
  for (const a of alunosAdultos.slice(0,5)) {
    atestadosParaInserir.push({
      aluno_id:      a.id,
      data_emissao:  daysAgo(randomInt(30, 120)),
      data_validade: daysFromNow(randomInt(-10, 200)),
      observacao:    null,
    })
  }

  if (atestadosParaInserir.length > 0) {
    const { error: errAt } = await sb.from('atestados').insert(atestadosParaInserir)
    if (errAt) console.error('Erro ao inserir atestados:', errAt.message)
    else console.log(`✓ ${atestadosParaInserir.length} atestados criados`)
  }

  // ── 7. Criar viagens ──────────────────────────────────────────────────────
  const turmasMI = (turmasInseridas ?? []).filter(t => t.faixa === 'Melhor Idade')
  const destinos = [
    'Petrópolis — Museu Imperial',
    'Paraty — Centro Histórico',
    'Rio de Janeiro — Jardim Botânico',
    'Angra dos Reis — Ilha Grande',
    'Vassouras — Fazenda Histórica',
    'Resende — Visconde de Mauá',
  ]

  const viagensParaInserir = []
  for (let i = 0; i < turmasMI.length; i++) {
    const t = turmasMI[i]
    const polo = polos.find(p => p.id === t.polo_id)
    viagensParaInserir.push({
      destino:     destinos[i % destinos.length],
      data:        daysFromNow(randomInt(7, 60)),
      polo_id:     t.polo_id,
      turma_id:    t.id,
      vagas:       randomInt(20, 45),
      observacoes: `Saída às 07h do ${polo?.nome ?? 'polo'}. Retorno previsto às 18h.`,
    })
    if (i % 2 === 0) {
      // Viagem passada
      viagensParaInserir.push({
        destino:     destinos[(i + 3) % destinos.length],
        data:        daysAgo(randomInt(15, 60)),
        polo_id:     t.polo_id,
        turma_id:    t.id,
        vagas:       randomInt(20, 40),
        observacoes: 'Viagem realizada.',
      })
    }
  }

  if (viagensParaInserir.length > 0) {
    const { error: errV } = await sb.from('viagens').insert(viagensParaInserir)
    if (errV) console.error('Erro ao inserir viagens:', errV.message)
    else console.log(`✓ ${viagensParaInserir.length} viagens criadas`)
  }

  // ── 8. Criar alguns registros de aula ─────────────────────────────────────
  const registrosParaInserir = []
  const conteudos = [
    'Alongamento inicial + exercícios de aquecimento. Trabalho de coordenação motora.',
    'Técnica básica e fundamentos. Alunos demonstraram boa evolução.',
    'Treino aeróbico de baixo impacto. Exercícios respiratórios complementares.',
    'Trabalho em duplas. Foco em equilíbrio e postura.',
    'Revisão dos movimentos anteriores. Introdução a nova sequência.',
    'Aula prática com dinâmica em grupo. Alta participação.',
  ]

  for (const t of (turmasInseridas ?? []).slice(0, 4)) {
    for (let d = 0; d <= 7; d++) {
      const data = new Date(); data.setDate(data.getDate() - d)
      const diaSemana = data.getDay()
      const dataStr   = data.toISOString().split('T')[0]
      const temAula   = (t.dias || []).some(dia => DIAS_JS[dia] === diaSemana)
      if (!temAula) continue

      registrosParaInserir.push({
        turma_id:         t.id,
        data:             dataStr,
        conteudo:         pick(conteudos),
        ocorrencias:      Math.random() > 0.7 ? 'Aluno relatou desconforto leve. Descansou por 10 minutos.' : null,
        alunos_presentes: randomInt(6, 14),
      })
    }
  }

  if (registrosParaInserir.length > 0) {
    const { error: errR } = await sb.from('registros_aula').insert(registrosParaInserir)
    if (errR) console.error('Erro ao inserir registros:', errR.message)
    else console.log(`✓ ${registrosParaInserir.length} registros de aula criados`)
  }

  console.log('\n✅ Seed concluído com sucesso!')
  console.log('\nLogins de teste:')
  console.log('  Admin:       atendimento.100custo@gmail.com / Smel@2025')
  console.log('  Professor:   prof.carlos@smel.vr.gov.br / Smel@2025')
  console.log('  Coordenador: coord.marcia@smel.vr.gov.br / Smel@2025')
  console.log('  Estagiário:  estag.lucas@smel.vr.gov.br / Smel@2025')
}

run().catch(console.error)

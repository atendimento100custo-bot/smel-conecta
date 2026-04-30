import { createClient } from '@supabase/supabase-js'

const URL  = 'https://pgkyvgmlfmgptxyhovqk.supabase.co'
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBna3l2Z21sZm1ncHR4eWhvdnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzNzk4MiwiZXhwIjoyMDkxNTEzOTgyfQ.IORqMIovCDV0LvheICTQH-46dAaphVZz7AD0ldpXLKg'
const sb   = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// ─── IDs existentes ───────────────────────────────────────────────────────────
const P = {
  tresPocosId:     'd7c547e7-6583-4505-b82f-1f0b28795f69',
  siderlandiaId:   '6e263cf2-600f-4ea3-8d25-26c511968992',
  saoGeraldoId:    '2e7e4330-c7d5-4fb9-8fa4-c2e45d8827eb',
  santaCruzId:     'd708c0d4-4ac9-492a-84b0-e88af6108edb',
  parqueAquaticoId:'db85e5f3-6bcd-4ac2-aba4-e55fe546f876',
  arenaId:         'bb097afa-cf6a-4831-8929-5e4e9a1b08af',
  gin249Id:        'bce28fa8-37f2-4ca7-bb1e-7c5274c82698',
  vilaRicaId:      '8f5e5c5d-6670-474b-9c38-67363a5e6039',
}

const M_EXIST = {
  atletismo:   '06098ac2-34d2-464f-8ade-16507a36096d',
  natacao:     'de1c6773-3a2a-49f5-8691-08e9a3e02925',
  futsal:      '2f919b3a-38d3-4f43-b43c-5247f6175ec6',
  dancaSalao:  'ba44873c-c5d1-41ff-911f-82cd1515b47e',
  ballet:      '89e60fb3-6f16-46b8-9d81-4c78fbe2fac3',
  funcional:   '9d163ad9-c052-4821-9874-a2ea72b568b3',
  vivaMelhor:  '4e1e7a4e-a8bc-42a6-9d8f-8c20bf51a671',
}

// ─── Fase 1: criar modalidades novas ──────────────────────────────────────────
async function criarModalidades() {
  console.log('\n📚 Criando modalidades...')
  const novas = [
    { nome: 'Viva Mais',                emoji: '🌿' },
    { nome: 'Ginástica Artística',      emoji: '🤸' },
    { nome: 'GRD',                      emoji: '🎀' },
    { nome: 'Hidroginástica',           emoji: '💧' },
    { nome: 'Vôlei',                    emoji: '🏐' },
    { nome: 'Pilates',                  emoji: '🧘' },
    { nome: 'Dança',                    emoji: '💃' },
    { nome: 'Basquete',                 emoji: '🏀' },
    { nome: 'Cárdio Beat',              emoji: '🎵' },
    { nome: 'Defesa Pessoal',           emoji: '🥊' },
    { nome: 'Mobilidade e Alongamento', emoji: '🧩' },
    { nome: 'Viva a Vida',              emoji: '🌟' },
    { nome: 'Recreação Infantil',       emoji: '🎮' },
  ]
  const { data } = await sb.from('modalidades').insert(novas.map(m => ({ ...m, status: 'Ativo' }))).select('id,nome')
  const M = { ...M_EXIST }
  for (const m of data ?? []) {
    const key = m.nome.toLowerCase().replace(/\s+/g, '_').replace(/[áàã]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i').replace(/[óô]/g,'o').replace(/[ú]/g,'u').replace(/[ç]/g,'c')
    M[key] = m.id
    console.log(`  ✓ ${m.nome}`)
  }
  return M
}

// ─── Fase 2: criar professores (sem email real) ───────────────────────────────
const SENHA_TEMP = 'Smel@2025'

async function criarProf(nome, cargo = 'professor') {
  const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'.').replace(/[^a-z.]/g,'')
  const email = `${slug}@smel.placeholder.vr`
  // verifica se já existe
  const { data: lista } = await sb.auth.admin.listUsers()
  const existe = lista?.users?.find(u => u.email === email)
  if (existe) return existe.id
  const { data, error } = await sb.auth.admin.createUser({
    email, password: SENHA_TEMP,
    email_confirm: true,
    user_metadata: { nome, cargo }
  })
  if (error) { console.error(`  ✗ ${nome}: ${error.message}`); return null }
  // atualiza profile
  await sb.from('profiles').upsert({ id: data.user.id, nome, cargo })
  return data.user.id
}

async function criarProfessores() {
  console.log('\n👥 Criando professores...')
  const defs = [
    // Três Poços
    ['Andreia',               'professor'],
    ['Natália',               'professor'],
    ['Beto',                  'professor'],
    // Siderlândia
    ['Gláucia',               'professor'],
    ['Guilherme Veríssimo',   'professor'],
    ['Lidiene',               'professor'],
    ['Leiriane',              'professor'],
    // São Geraldo
    ['Fernanda',              'professor'],
    ['Bianca',                'professor'],
    ['Mirelle',               'professor'],  // tb em 249 e Vila Rica
    ['Kelly',                 'professor'],  // tb em 249 e Vila Rica
    // Santa Cruz
    ['Fernando Brito',        'coordenador'],
    ['Emanuelle',             'professor'],
    ['Thales',                'professor'],
    ['Ana Luiza',             'professor'],
    ['Juan',                  'estagiario'],
    ['Rogério',               'estagiario'],
    ['Camila Lemos',          'estagiario'],
    // Parque Aquático
    ['Izabel',                'professor'],
    ['Melissa',               'professor'],
    ['Suyane',                'professor'],
    ['Wiviane',               'professor'],
    ['Erick',                 'professor'],
    // Ballet / Arena
    ['Julia',                 'professor'],
    ['Yasmin',                'professor'],
    // Atletismo / Arena
    ['Iuri',                  'professor'],
    ['Carlinhos',             'professor'],
    // 249
    ['Matheus',               'professor'],
    ['Igor',                  'professor'],
    ['Perla',                 'professor'],
    // Vila Rica
    ['Juliano',               'professor'],
    ['João Bonifácio',        'professor'],
    ['Carina',                'professor'],
    ['Caio Jorge',            'professor'],
    ['Caio Henrique',         'professor'],
    ['Jean',                  'professor'],
  ]
  const ids = {}
  for (const [nome, cargo] of defs) {
    const id = await criarProf(nome, cargo)
    if (id) { ids[nome] = id; console.log(`  ✓ ${nome}`) }
  }
  return ids
}

// ─── Fase 3: criar turmas + atribuições ──────────────────────────────────────
async function criarTurma(polo_id, modalidade_id, { dias, horario, faixa = 'Adulto', faixa_etaria = null, capacidade = 20, status = 'Ativa' }, profs_ids = [], M, nome_mod = '') {
  const { data, error } = await sb.from('turmas').insert({
    polo_id, modalidade_id, dias, horario, faixa, faixa_etaria, capacidade, status,
    professor_id: profs_ids[0] ?? null,
  }).select('id').single()
  if (error || !data) { console.error(`  ✗ Erro turma ${nome_mod} ${horario}: ${error?.message}`); return null }
  if (profs_ids.length > 0) {
    const atribs = profs_ids.map(uid => ({
      usuario_id: uid, polo_id, turma_id: data.id,
      cargo: 'professor'
    }))
    await sb.from('atribuicoes').insert(atribs)
  }
  return data.id
}

async function popular(M, PR) {
  console.log('\n🏟️  Inserindo turmas...\n')
  const SEG_QUA  = ['Segunda','Quarta']
  const TER_QUI  = ['Terça','Quinta']
  const SEG_QUA_SEX = ['Segunda','Quarta','Sexta']
  const TER_QUI_SEX = ['Terça','Quinta','Sexta']
  const TER_SEX  = ['Terça','Quinta','Sexta']
  const QUA_SEX  = ['Quarta','Sexta']
  const SEG_SEX  = ['Segunda','Sexta']

  // ───── TRÊS POÇOS ─────────────────────────────────────────────────────────
  console.log('🏋️  Três Poços...')
  const tp = P.tresPocosId
  // Seg/Qua
  await criarTurma(tp, M.viva_melhor,  { dias: SEG_QUA, horario:'07:00', faixa:'Melhor Idade' }, [PR['Andreia'],PR['Natália']].filter(Boolean), M, 'Viva Melhor')
  await criarTurma(tp, M.viva_mais,    { dias: SEG_QUA, horario:'08:00', faixa:'Melhor Idade' }, [PR['Andreia'],PR['Natália']].filter(Boolean), M, 'Viva Mais')
  await criarTurma(tp, M.ginastica_artistica, { dias: SEG_QUA, horario:'08:30', faixa:'Infantil', faixa_etaria:'9-11 anos' }, [], M)
  await criarTurma(tp, M.futsal, { dias: SEG_QUA, horario:'09:00', faixa:'Infantil', faixa_etaria:'Sub 11 e Sub 13' }, [PR['Beto']].filter(Boolean), M)
  await criarTurma(tp, M.futsal, { dias: SEG_QUA, horario:'13:30', faixa:'Infantil', faixa_etaria:'Sub 07 e Sub 09' }, [PR['Beto']].filter(Boolean), M)
  await criarTurma(tp, M.futsal, { dias: SEG_QUA, horario:'15:00', faixa:'Infantil', faixa_etaria:'Sub 11' },          [PR['Beto']].filter(Boolean), M)
  // Ter/Qui
  await criarTurma(tp, M.viva_mais, { dias: TER_QUI, horario:'07:00', faixa:'Melhor Idade' }, [], M)
  await criarTurma(tp, M.ballet,    { dias: ['Terça'], horario:'08:30', faixa:'Infantil', faixa_etaria:'5-7 anos' }, [], M)
  await criarTurma(tp, M.ginastica_artistica, { dias: ['Quinta'], horario:'08:30', faixa:'Infantil', faixa_etaria:'5-8 anos' }, [], M)
  await criarTurma(tp, M.futsal, { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'Sub 07 e Sub 09' }, [PR['Beto']].filter(Boolean), M)
  await criarTurma(tp, M.futsal, { dias: TER_QUI, horario:'13:30', faixa:'Infantil', faixa_etaria:'Sub 13' },          [PR['Beto']].filter(Boolean), M)
  await criarTurma(tp, M.futsal, { dias: TER_QUI, horario:'15:00', faixa:'Infantil', faixa_etaria:'Sub 15 e Sub 17' }, [PR['Beto']].filter(Boolean), M)
  // Sexta
  await criarTurma(tp, M.viva_mais, { dias: ['Sexta'], horario:'08:00', faixa:'Melhor Idade' }, [PR['Andreia'],PR['Natália']].filter(Boolean), M)
  console.log('  ✓ Três Poços concluído')

  // ───── SIDERLÂNDIA ────────────────────────────────────────────────────────
  console.log('🏋️  Siderlândia...')
  const sid = P.siderlandiaId
  await criarTurma(sid, M.viva_mais,   { dias: SEG_QUA, horario:'07:30', faixa:'Melhor Idade' }, [PR['Gláucia']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: SEG_QUA, horario:'09:00', faixa:'Infantil', faixa_etaria:'7-9 anos' },   [PR['Gláucia'],PR['Guilherme Veríssimo']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: SEG_QUA, horario:'10:00', faixa:'Infantil', faixa_etaria:'10-11 anos' }, [PR['Gláucia'],PR['Guilherme Veríssimo']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: SEG_QUA, horario:'14:00', faixa:'Infantil', faixa_etaria:'7-9 anos' },   [PR['Gláucia']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: SEG_QUA, horario:'15:30', faixa:'Infantil', faixa_etaria:'10-11 anos' }, [PR['Gláucia']].filter(Boolean), M)
  await criarTurma(sid, M.viva_melhor, { dias: TER_QUI, horario:'07:00', faixa:'Melhor Idade' }, [PR['Lidiene']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'12-13 anos' }, [PR['Guilherme Veríssimo']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: TER_QUI, horario:'10:00', faixa:'Infantil', faixa_etaria:'14-17 anos' }, [PR['Guilherme Veríssimo']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: TER_QUI, horario:'14:00', faixa:'Infantil', faixa_etaria:'12-13 anos' }, [PR['Leiriane']].filter(Boolean), M)
  await criarTurma(sid, M.futsal, { dias: TER_QUI, horario:'15:30', faixa:'Infantil', faixa_etaria:'14-17 anos' }, [PR['Leiriane']].filter(Boolean), M)
  console.log('  ✓ Siderlândia concluído')

  // ───── SÃO GERALDO ────────────────────────────────────────────────────────
  console.log('🏋️  São Geraldo...')
  const sg = P.saoGeraldoId
  await criarTurma(sg, M.ginastica_artistica, { dias: SEG_QUA, horario:'08:00', faixa:'Infantil', faixa_etaria:'Babys 5-7 anos T1' }, [PR['Fernanda'],PR['Bianca'],PR['Mirelle']].filter(Boolean), M)
  await criarTurma(sg, M.ginastica_artistica, { dias: SEG_QUA, horario:'08:00', faixa:'Infantil', faixa_etaria:'8-11 anos' },         [PR['Fernanda'],PR['Bianca'],PR['Mirelle']].filter(Boolean), M)
  await criarTurma(sg, M.ginastica_artistica, { dias: SEG_QUA, horario:'10:00', faixa:'Infantil', faixa_etaria:'Juvenil 12-17 anos' }, [PR['Fernanda']].filter(Boolean), M)
  await criarTurma(sg, M.ginastica_artistica, { dias: SEG_QUA, horario:'14:00', faixa:'Adulto',   faixa_etaria:'Turma A' },            [PR['Kelly']].filter(Boolean), M)
  await criarTurma(sg, M.viva_melhor, { dias: TER_QUI, horario:'07:00', faixa:'Melhor Idade' }, [PR['Fernanda'],PR['Kelly']].filter(Boolean), M)
  await criarTurma(sg, M.ginastica_artistica, { dias: TER_QUI, horario:'08:00', faixa:'Infantil', faixa_etaria:'Babys 5-7 anos T2' }, [PR['Fernanda']].filter(Boolean), M)
  await criarTurma(sg, M.ginastica_artistica, { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'8-11 anos' },         [PR['Fernanda']].filter(Boolean), M)
  await criarTurma(sg, M.ginastica_artistica, { dias: TER_QUI, horario:'14:00', faixa:'Adulto',   faixa_etaria:'Turma B' },            [PR['Kelly']].filter(Boolean), M)
  await criarTurma(sg, M.ginastica_artistica, { dias: TER_QUI, horario:'16:00', faixa:'Infantil', faixa_etaria:'Babys 5-7 anos' },     [PR['Mirelle']].filter(Boolean), M)
  // Quinta exclusivo
  await criarTurma(sg, M.pilates, { dias: ['Quinta'], horario:'10:00', faixa:'Adulto' }, [], M)
  await criarTurma(sg, M.pilates, { dias: ['Quinta'], horario:'15:00', faixa:'Adulto' }, [], M)
  await criarTurma(sg, M.danca,   { dias: ['Quinta'], horario:'14:00', faixa:'Infantil' }, [], M)
  console.log('  ✓ São Geraldo concluído')

  // ───── SANTA CRUZ ─────────────────────────────────────────────────────────
  console.log('🏋️  Santa Cruz...')
  const sc = P.santaCruzId
  const equipeM = [PR['Fernando Brito'],PR['Emanuelle'],PR['Ana Luiza'],PR['Juan'],PR['Rogério']].filter(Boolean)
  const equipeT = [PR['Thales'],PR['Camila Lemos']].filter(Boolean)
  await criarTurma(sc, M.viva_melhor, { dias: SEG_QUA, horario:'07:30', faixa:'Melhor Idade', capacidade:255 }, equipeM, M)
  await criarTurma(sc, M.danca,       { dias: SEG_QUA, horario:'08:45', faixa:'Melhor Idade', faixa_etaria:'Dança Melhor Idade' }, equipeM, M)
  await criarTurma(sc, M.funcional,   { dias: SEG_QUA, horario:'09:45', faixa:'Infantil', faixa_etaria:'Funcional Kids' }, equipeM, M)
  await criarTurma(sc, M.mobilidade_e_alongamento, { dias: SEG_QUA, horario:'13:30', faixa:'Adulto', capacidade:20 }, equipeT, M)
  await criarTurma(sc, M.funcional,   { dias: SEG_QUA, horario:'14:00', faixa:'Adulto', capacidade:20 }, equipeT, M)
  await criarTurma(sc, M.volei,       { dias: SEG_QUA, horario:'15:30', faixa:'Infantil', faixa_etaria:'Iniciação Esportiva', capacidade:4 }, [], M)
  await criarTurma(sc, M.viva_a_vida, { dias: TER_QUI, horario:'07:30', faixa:'Melhor Idade', capacidade:37 }, equipeM, M)
  await criarTurma(sc, M.futsal, { dias: TER_QUI, horario:'08:45', faixa:'Infantil', faixa_etaria:'Iniciação', capacidade:4  }, equipeM, M)
  await criarTurma(sc, M.futsal, { dias: TER_QUI, horario:'09:45', faixa:'Infantil', faixa_etaria:'Iniciação', capacidade:10 }, equipeM, M)
  await criarTurma(sc, M.futsal, { dias: TER_QUI, horario:'13:30', faixa:'Infantil', faixa_etaria:'7-11 anos', capacidade:25 }, equipeT, M)
  await criarTurma(sc, M.futsal, { dias: TER_QUI, horario:'14:30', faixa:'Infantil', faixa_etaria:'12-14 anos', capacidade:15 }, equipeT, M)
  await criarTurma(sc, M.futsal, { dias: TER_QUI, horario:'14:30', faixa:'Infantil', faixa_etaria:'15-17 anos', capacidade:15 }, [], M)
  await criarTurma(sc, M.volei,       { dias: ['Sexta'], horario:'07:00', faixa:'Adulto', faixa_etaria:'Vôlei Master' }, [PR['Fernando Brito']].filter(Boolean), M)
  console.log('  ✓ Santa Cruz concluído')

  // ───── PARQUE AQUÁTICO ────────────────────────────────────────────────────
  console.log('🏊  Parque Aquático...')
  const pa = P.parqueAquaticoId
  const TER_SEX_PA = ['Terça','Quarta','Quinta','Sexta']
  // Hidroginástica manhã — Izabel e Melissa (todos os dias Ter-Sex)
  for (const hr of ['07:00','08:00','09:00','10:00']) {
    await criarTurma(pa, M.hidroginastica, { dias: TER_SEX_PA, horario: hr, faixa:'Adulto' }, [PR['Izabel'],PR['Melissa']].filter(Boolean), M)
  }
  // Hidroginástica tarde — Suyane
  for (const hr of ['14:00','15:00','16:00','17:00']) {
    await criarTurma(pa, M.hidroginastica, { dias: TER_SEX_PA, horario: hr, faixa:'Adulto' }, [PR['Suyane']].filter(Boolean), M)
  }
  // Wiviane — Ter/Qui
  await criarTurma(pa, M.hidroginastica, { dias: TER_QUI, horario:'07:00', faixa:'Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: TER_QUI, horario:'08:00', faixa:'Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: TER_QUI, horario:'10:00', faixa:'Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'6-8 anos' }, [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: TER_QUI, horario:'11:00', faixa:'Adulto',   faixa_etaria:'Natação Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  // Wiviane — Qua/Sex
  await criarTurma(pa, M.hidroginastica, { dias: QUA_SEX, horario:'07:00', faixa:'Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: QUA_SEX, horario:'09:00', faixa:'Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: QUA_SEX, horario:'10:00', faixa:'Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: QUA_SEX, horario:'08:00', faixa:'Infantil', faixa_etaria:'6-8 anos' },  [PR['Wiviane']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: QUA_SEX, horario:'11:00', faixa:'Adulto', faixa_etaria:'Natação Adulto' }, [PR['Wiviane']].filter(Boolean), M)
  // Erick — Ter/Qui
  await criarTurma(pa, M.natacao, { dias: TER_QUI, horario:'13:00', faixa:'Adulto', faixa_etaria:'Natação Adulto' }, [PR['Erick'],PR['Suyane']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: TER_QUI, horario:'14:00', faixa:'Adulto' }, [PR['Erick']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: TER_QUI, horario:'15:00', faixa:'Adulto', faixa_etaria:'Natação Adulto' }, [PR['Erick']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: TER_QUI, horario:'16:00', faixa:'Infantil', faixa_etaria:'13-17 anos' }, [PR['Erick']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: TER_QUI, horario:'17:00', faixa:'Adulto', faixa_etaria:'Natação Adulto' }, [PR['Erick']].filter(Boolean), M)
  // Erick — Qua/Sex
  await criarTurma(pa, M.natacao, { dias: QUA_SEX, horario:'07:00', faixa:'Adulto', faixa_etaria:'Natação Adulto' }, [PR['Erick']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: QUA_SEX, horario:'08:00', faixa:'Infantil', faixa_etaria:'9-12 anos' },  [PR['Erick']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: QUA_SEX, horario:'09:00', faixa:'Adulto' }, [PR['Erick']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: QUA_SEX, horario:'10:00', faixa:'Adulto' }, [PR['Erick']].filter(Boolean), M)
  await criarTurma(pa, M.natacao, { dias: QUA_SEX, horario:'11:00', faixa:'Adulto', faixa_etaria:'Natação Adulto' }, [PR['Erick']].filter(Boolean), M)
  // Bianca — Ter/Qui
  await criarTurma(pa, M.natacao, { dias: TER_QUI, horario:'07:00', faixa:'Adulto', faixa_etaria:'Natação Adulto' }, [PR['Bianca']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: TER_QUI, horario:'08:00', faixa:'Adulto' }, [PR['Bianca']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: TER_QUI, horario:'09:00', faixa:'Adulto' }, [PR['Bianca']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: TER_QUI, horario:'10:00', faixa:'Adulto' }, [PR['Bianca']].filter(Boolean), M)
  // Bianca — Qua/Sex tarde
  await criarTurma(pa, M.natacao, { dias: QUA_SEX, horario:'14:00', faixa:'Infantil', faixa_etaria:'6-8 anos' }, [PR['Bianca']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: QUA_SEX, horario:'15:00', faixa:'Adulto' }, [PR['Bianca']].filter(Boolean), M)
  await criarTurma(pa, M.hidroginastica, { dias: QUA_SEX, horario:'16:00', faixa:'Adulto' }, [PR['Bianca']].filter(Boolean), M)
  console.log('  ✓ Parque Aquático concluído')

  // ───── BALLET + ATLETISMO na Arena ────────────────────────────────────────
  console.log('🩰  Ballet + Atletismo (Arena)...')
  const ar = P.arenaId
  // Ballet — Julia (Seg/Qua)
  const balletHorarios = [
    { hr:'08:00', fe:'Intermediário 10-14 anos' },
    { hr:'09:00', fe:'Baby Class 3-5 anos' },
    { hr:'10:00', fe:'Básico 6-9 anos' },
    { hr:'13:00', fe:'Básico 6-9 anos' },
    { hr:'14:00', fe:'Intermediário 10-14 anos' },
    { hr:'15:00', fe:'Baby Class 3-5 anos' },
  ]
  for (const { hr, fe } of balletHorarios) {
    await criarTurma(ar, M.ballet, { dias: SEG_QUA, horario: hr, faixa:'Infantil', faixa_etaria: fe }, [PR['Julia']].filter(Boolean), M)
  }
  // Yasmin — Ter/Qui (sem horários detalhados, criar atribuição ao polo)
  if (PR['Yasmin']) {
    await sb.from('atribuicoes').insert({ usuario_id: PR['Yasmin'], polo_id: ar, turma_id: null, cargo: 'professor' })
  }
  // Atletismo — Iuri (Seg/Qua)
  await criarTurma(ar, M.atletismo, { dias: SEG_QUA, horario:'07:00', faixa:'Infantil', faixa_etaria:'Sub 17 (14-17 anos)' }, [PR['Iuri']].filter(Boolean), M)
  await criarTurma(ar, M.atletismo, { dias: SEG_QUA, horario:'08:00', faixa:'Infantil', faixa_etaria:'Sub 13 (12-13 anos)' }, [PR['Iuri']].filter(Boolean), M)
  await criarTurma(ar, M.atletismo, { dias: SEG_QUA, horario:'09:00', faixa:'Infantil', faixa_etaria:'Sub 11 (8-11 anos)' },  [PR['Iuri']].filter(Boolean), M)
  // Atletismo — Iuri (Ter/Qui)
  await criarTurma(ar, M.atletismo, { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'Todas as categorias' }, [PR['Iuri']].filter(Boolean), M)
  // Atletismo — Carlinhos (Ter/Qui)
  await criarTurma(ar, M.atletismo, { dias: TER_QUI, horario:'14:00', faixa:'Adulto',   faixa_etaria:'PCD' },        [PR['Carlinhos']].filter(Boolean), M)
  await criarTurma(ar, M.atletismo, { dias: TER_QUI, horario:'15:00', faixa:'Infantil', faixa_etaria:'12-17 anos' }, [PR['Carlinhos']].filter(Boolean), M)
  await criarTurma(ar, M.atletismo, { dias: TER_QUI, horario:'16:00', faixa:'Infantil', faixa_etaria:'7-11 anos' },  [PR['Carlinhos']].filter(Boolean), M)
  console.log('  ✓ Ballet + Atletismo (Arena) concluído')

  // ───── GINÁSIO 249 ────────────────────────────────────────────────────────
  console.log('🏋️  Ginásio 249...')
  const g249 = P.gin249Id
  // Seg/Qua — Matheus
  await criarTurma(g249, M.viva_melhor,  { dias: SEG_QUA, horario:'07:00', faixa:'Melhor Idade' },                             [PR['Matheus']].filter(Boolean), M)
  await criarTurma(g249, M.pilates,      { dias: SEG_QUA, horario:'07:00', faixa:'Adulto' },                                   [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.funcional,    { dias: SEG_QUA, horario:'08:00', faixa:'Adulto', faixa_etaria:'Funcional Adulto' },   [PR['Matheus']].filter(Boolean), M)
  await criarTurma(g249, M.defesa_pessoal,{ dias: SEG_QUA, horario:'08:00', faixa:'Adulto' },                                  [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.futsal,       { dias: SEG_QUA, horario:'09:00', faixa:'Infantil', faixa_etaria:'6-10 anos' },       [PR['Matheus']].filter(Boolean), M)
  await criarTurma(g249, M.grd,          { dias: SEG_QUA, horario:'09:00', faixa:'Infantil', faixa_etaria:'Baby' },            [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.grd,          { dias: ['Quarta'], horario:'09:00', faixa:'Infantil', faixa_etaria:'7-14 anos' },    [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.futsal,       { dias: SEG_QUA, horario:'10:00', faixa:'Infantil', faixa_etaria:'6-10 anos T2' },    [PR['Matheus']].filter(Boolean), M)
  await criarTurma(g249, M.pilates,      { dias: SEG_QUA, horario:'10:00', faixa:'Adulto' },                                   [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.futsal, { dias: SEG_QUA, horario:'13:00', faixa:'Infantil', faixa_etaria:'8-12 anos' },  [PR['Matheus']].filter(Boolean), M)
  await criarTurma(g249, M.futsal, { dias: SEG_QUA, horario:'14:00', faixa:'Infantil', faixa_etaria:'8-12 anos' },  [PR['Matheus']].filter(Boolean), M)
  await criarTurma(g249, M.futsal, { dias: SEG_QUA, horario:'15:00', faixa:'Infantil', faixa_etaria:'13-16 anos' }, [PR['Matheus']].filter(Boolean), M)
  await criarTurma(g249, M.futsal, { dias: SEG_QUA, horario:'16:00', faixa:'Infantil', faixa_etaria:'13-16 anos' }, [PR['Matheus']].filter(Boolean), M)
  // Ter/Qui — Perla
  await criarTurma(g249, M.viva_melhor, { dias: TER_QUI, horario:'07:00', faixa:'Melhor Idade' },                 [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.cardio_beat, { dias: TER_QUI, horario:'08:00', faixa:'Adulto' },                       [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.grd,         { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'7-14 anos' }, [PR['Perla']].filter(Boolean), M)
  await criarTurma(g249, M.pilates,     { dias: TER_QUI, horario:'10:00', faixa:'Adulto' },                       [PR['Perla']].filter(Boolean), M)
  // Ter/Qui — Igor (Vôlei)
  await criarTurma(g249, M.volei, { dias: TER_QUI, horario:'13:00', faixa:'Infantil', faixa_etaria:'6-10 anos' },  [PR['Igor']].filter(Boolean), M)
  await criarTurma(g249, M.volei, { dias: TER_QUI, horario:'14:00', faixa:'Infantil', faixa_etaria:'6-10 anos' },  [PR['Igor']].filter(Boolean), M)
  await criarTurma(g249, M.volei, { dias: TER_QUI, horario:'15:00', faixa:'Infantil', faixa_etaria:'11-16 anos' }, [PR['Igor']].filter(Boolean), M)
  await criarTurma(g249, M.volei, { dias: TER_QUI, horario:'16:00', faixa:'Infantil', faixa_etaria:'11-16 anos' }, [PR['Igor']].filter(Boolean), M)
  // Sexta
  await criarTurma(g249, M.danca,            { dias: ['Sexta'], horario:'07:00', faixa:'Adulto' },                [PR['Carlinhos']].filter(Boolean), M)
  await criarTurma(g249, M.recreacao_infantil,{ dias: ['Sexta'], horario:'08:00', faixa:'Infantil', faixa_etaria:'6-10 anos' }, [], M)
  await criarTurma(g249, M.volei, { dias: ['Sexta'], horario:'14:00', faixa:'Infantil', faixa_etaria:'11-16 anos' }, [PR['Kelly']].filter(Boolean), M)
  await criarTurma(g249, M.volei, { dias: ['Sexta'], horario:'15:00', faixa:'Infantil', faixa_etaria:'11-16 anos' }, [PR['Kelly']].filter(Boolean), M)
  console.log('  ✓ Ginásio 249 concluído')

  // ───── VILA RICA ──────────────────────────────────────────────────────────
  console.log('🏋️  Vila Rica...')
  const vr = P.vilaRicaId
  // Seg/Qua
  await criarTurma(vr, M.futsal, { dias: SEG_QUA, horario:'09:00', faixa:'Infantil', faixa_etaria:'6-9 anos' },   [PR['Juliano']].filter(Boolean), M)
  await criarTurma(vr, M.futsal, { dias: SEG_QUA, horario:'10:00', faixa:'Infantil', faixa_etaria:'10-11 anos' }, [PR['Juliano']].filter(Boolean), M)
  await criarTurma(vr, M.futsal, { dias: SEG_QUA, horario:'13:30', faixa:'Infantil', faixa_etaria:'10-11 anos' }, [PR['João Bonifácio']].filter(Boolean), M)
  await criarTurma(vr, M.futsal, { dias: SEG_QUA, horario:'14:30', faixa:'Infantil', faixa_etaria:'6-9 anos' },   [PR['João Bonifácio']].filter(Boolean), M)
  await criarTurma(vr, M.basquete, { dias: SEG_QUA, horario:'15:30', faixa:'Infantil', faixa_etaria:'12+ anos' }, [PR['João Bonifácio']].filter(Boolean), M)
  await criarTurma(vr, M.danca_salao, { dias: ['Segunda'], horario:'13:30', faixa:'Adulto', faixa_etaria:'18+ anos T1' }, [PR['Carina']].filter(Boolean), M)
  await criarTurma(vr, M.danca_salao, { dias: ['Segunda'], horario:'15:00', faixa:'Adulto', faixa_etaria:'18+ anos T2' }, [PR['Carina']].filter(Boolean), M)
  // Ter/Qui
  await criarTurma(vr, M.viva_melhor,         { dias: TER_QUI, horario:'07:00', faixa:'Melhor Idade', faixa_etaria:'60+' },   [PR['Caio Jorge']].filter(Boolean), M)
  await criarTurma(vr, M.funcional,           { dias: TER_QUI, horario:'08:00', faixa:'Adulto', faixa_etaria:'18+' },         [PR['Mirelle']].filter(Boolean), M)
  await criarTurma(vr, M.ginastica_artistica, { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'6+' },         [PR['Mirelle']].filter(Boolean), M)
  await criarTurma(vr, M.futsal,              { dias: TER_QUI, horario:'09:00', faixa:'Infantil', faixa_etaria:'12-15 anos' }, [PR['Caio Jorge']].filter(Boolean), M)
  await criarTurma(vr, M.futsal,              { dias: TER_QUI, horario:'13:30', faixa:'Infantil', faixa_etaria:'16-17 anos' }, [PR['Caio Henrique']].filter(Boolean), M)
  await criarTurma(vr, M.ginastica_artistica, { dias: TER_QUI, horario:'13:30', faixa:'Infantil', faixa_etaria:'6+' },         [PR['Carina']].filter(Boolean), M)
  await criarTurma(vr, M.futsal,              { dias: TER_QUI, horario:'15:00', faixa:'Infantil', faixa_etaria:'12-15 anos' }, [PR['Caio Jorge']].filter(Boolean), M)
  // Sexta
  await criarTurma(vr, M.danca_salao, { dias: ['Sexta'], horario:'13:30', faixa:'Adulto', faixa_etaria:'18+ anos T1' }, [PR['Carina']].filter(Boolean), M)
  await criarTurma(vr, M.danca_salao, { dias: ['Sexta'], horario:'15:00', faixa:'Adulto', faixa_etaria:'18+ anos T2' }, [PR['Carina']].filter(Boolean), M)
  console.log('  ✓ Vila Rica concluído')
}

// ─── Fase 4: atribuições de polo (sem turma específica) ───────────────────────
async function criarAtribuicoesPolo(PR) {
  console.log('\n🔗 Vinculando professores aos polos...')
  const vinculos = [
    // Três Poços
    [PR['Andreia'],             P.tresPocosId,     'professor'],
    [PR['Natália'],             P.tresPocosId,     'professor'],
    [PR['Beto'],                P.tresPocosId,     'professor'],
    // Siderlândia
    [PR['Gláucia'],             P.siderlandiaId,   'professor'],
    [PR['Guilherme Veríssimo'], P.siderlandiaId,   'professor'],
    [PR['Lidiene'],             P.siderlandiaId,   'professor'],
    [PR['Leiriane'],            P.siderlandiaId,   'professor'],
    // São Geraldo
    [PR['Fernanda'],            P.saoGeraldoId,    'professor'],
    [PR['Bianca'],              P.saoGeraldoId,    'professor'],
    [PR['Mirelle'],             P.saoGeraldoId,    'professor'],
    [PR['Kelly'],               P.saoGeraldoId,    'professor'],
    // Santa Cruz
    [PR['Fernando Brito'],      P.santaCruzId,     'coordenador'],
    [PR['Emanuelle'],           P.santaCruzId,     'professor'],
    [PR['Thales'],              P.santaCruzId,     'professor'],
    [PR['Ana Luiza'],           P.santaCruzId,     'professor'],
    [PR['Juan'],                P.santaCruzId,     'estagiario'],
    [PR['Rogério'],             P.santaCruzId,     'estagiario'],
    [PR['Camila Lemos'],        P.santaCruzId,     'estagiario'],
    // Parque Aquático
    [PR['Izabel'],              P.parqueAquaticoId,'professor'],
    [PR['Melissa'],             P.parqueAquaticoId,'professor'],
    [PR['Suyane'],              P.parqueAquaticoId,'professor'],
    [PR['Wiviane'],             P.parqueAquaticoId,'professor'],
    [PR['Erick'],               P.parqueAquaticoId,'professor'],
    // Arena (Ballet + Atletismo)
    [PR['Julia'],               P.arenaId,         'professor'],
    [PR['Yasmin'],              P.arenaId,         'professor'],
    [PR['Iuri'],                P.arenaId,         'professor'],
    [PR['Carlinhos'],           P.arenaId,         'professor'],
    // 249
    [PR['Matheus'],             P.gin249Id,        'professor'],
    [PR['Igor'],                P.gin249Id,        'professor'],
    [PR['Perla'],               P.gin249Id,        'professor'],
    [PR['Kelly'],               P.gin249Id,        'professor'],
    [PR['Mirelle'],             P.gin249Id,        'professor'],
    [PR['Carlinhos'],           P.gin249Id,        'professor'],
    // Vila Rica
    [PR['Juliano'],             P.vilaRicaId,      'professor'],
    [PR['João Bonifácio'],      P.vilaRicaId,      'professor'],
    [PR['Carina'],              P.vilaRicaId,      'professor'],
    [PR['Caio Jorge'],          P.vilaRicaId,      'professor'],
    [PR['Caio Henrique'],       P.vilaRicaId,      'professor'],
    [PR['Mirelle'],             P.vilaRicaId,      'professor'],
    [PR['Kelly'],               P.vilaRicaId,      'professor'],
  ]
  const atribs = vinculos.filter(([uid]) => !!uid).map(([uid, polo_id, cargo]) => ({
    usuario_id: uid, polo_id, cargo, turma_id: null
  }))
  // insert in batches to avoid conflicts
  for (let i = 0; i < atribs.length; i += 20) {
    await sb.from('atribuicoes').upsert(atribs.slice(i, i+20), { onConflict: 'usuario_id,polo_id,cargo' }).select()
  }
  console.log(`  ✓ ${atribs.length} vínculos criados`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
;(async () => {
  console.log('🚀 Iniciando população de dados...')
  const M  = await criarModalidades()
  const PR = await criarProfessores()
  await popular(M, PR)
  await criarAtribuicoesPolo(PR)
  console.log('\n✅ Tudo concluído!')
})().catch(console.error)

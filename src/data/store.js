// Central data store using localStorage

const KEYS = {
  polos: 'smel_polos',
  modalidades: 'smel_modalidades',
  equipes: 'smel_equipes',
  turmas: 'smel_turmas',
  alunos: 'smel_alunos',
  presencas: 'smel_presencas',
  atestados: 'smel_atestados',
  registros: 'smel_registros',
  viagens: 'smel_viagens',
}

const SEED = {
  polos: [
    { id: '1', nome: 'Ginásio Poliesportivo Vanecina Freitas Henrique Vicente', tipo: 'Ginásio', bairro: 'Siderlândia', endereco: 'Av. Presidente Kennedy, nº 6090', status: 'Ativo' },
    { id: '2', nome: 'Arena Esportiva Profº Paulo Camargo de Melo', tipo: 'Arena', bairro: 'Aterrado', endereco: 'Praça Independência e Luz II, s/nº', status: 'Ativo' },
    { id: '3', nome: 'Mini Estádio Edgar de Carvalho', tipo: 'Mini Estádio', bairro: 'Ilha São João', endereco: 'Rua Alexandre Polastri Filho, nº 791', status: 'Ativo' },
    { id: '4', nome: 'Ginásio Poliesportivo Darcise José de Carvalho', tipo: 'Ginásio', bairro: 'Santo Agostinho', endereco: 'Rua Jaime Martins, nº 850', status: 'Ativo' },
    { id: '5', nome: 'Ginásio Poliesportivo José Alves "Zinho"', tipo: 'Ginásio', bairro: 'Santa Cruz', endereco: 'Av. dos Ex-Combatentes, s/nº', status: 'Ativo' },
    { id: '6', nome: 'Ginásio Poliesportivo Heth Lustoza Bastos', tipo: 'Ginásio', bairro: 'Vila Rica (Três Poços)', endereco: 'Rua Érika Berbet, nº 03', status: 'Ativo' },
    { id: '7', nome: 'Estádio Municipal Raulino de Oliveira', tipo: 'Estádio', bairro: 'Jardim Paraíba', endereco: 'Rua 539, s/nº', status: 'Ativo' },
    { id: '8', nome: 'Kartódromo Municipal de Volta Redonda', tipo: 'Kartódromo', bairro: 'Aero Clube', endereco: 'Av. Ministro Salgado Filho, s/nº', status: 'Ativo' },
    { id: '9', nome: 'Academia de Ginástica e Musculação da 3ª Idade Dr. Eljo Cândido de Oliveira', tipo: 'Academia', bairro: 'Jardim Paraíba', endereco: 'Rua 539, s/nº, Estádio Municipal Raulino de Oliveira', status: 'Ativo' },
    { id: '10', nome: 'Ginásio Poliesportivo Amaro Inácio', tipo: 'Ginásio', bairro: 'Retiro', endereco: 'Av. Antônio de Almeida Gama, s/nº', status: 'Ativo' },
    { id: '11', nome: 'Complexo Esportivo Jornalista Oscar Cardoso', tipo: 'Complexo', bairro: 'Aero Clube', endereco: 'Av. Ministro Salgado Filho, s/nº', status: 'Ativo' },
    { id: '12', nome: 'Parque Aquático Municipal', tipo: 'Parque Aquático', bairro: 'Ilha São João', endereco: 'Rua Alexandre Polastri Filho, nº 791', status: 'Ativo' },
    { id: '13', nome: 'Centro de Artes Marciais Mestre Boa Viagem', tipo: 'Centro', bairro: 'Jardim Paraíba', endereco: 'Rua 539, s/nº, Estádio Municipal Raulino de Oliveira', status: 'Ativo' },
    { id: '14', nome: 'Ginásio Poliesportivo Carlos Augusto Haasis Filho', tipo: 'Ginásio', bairro: 'Vila Rica (Jd. Tiradentes)', endereco: 'Rua 43 c/ Rua 35', status: 'Ativo' },
    { id: '15', nome: 'Ginásio Poliesportivo Abrahan Medina', tipo: 'Ginásio', bairro: 'Ponte Alta', endereco: 'Rua Triestes, s/nº', status: 'Ativo' },
    { id: '16', nome: 'Museu da Cidade de Volta Redonda Geci Vieira Gonçalves', tipo: 'Museu', bairro: 'Jardim Paraíba', endereco: 'Rua 539, s/nº, Estádio Municipal Raulino de Oliveira', status: 'Ativo' },
    { id: '17', nome: 'Ginásio Poliesportivo Nery Miglioly', tipo: 'Ginásio', bairro: 'Açude I', endereco: 'Rua Vereador Acácio da Rocha, nº 82', status: 'Ativo' },
    { id: '18', nome: 'Ginásio Poliesportivo Gal. Euclydes Figueiredo', tipo: 'Ginásio', bairro: 'Ilha São João', endereco: 'Rua Alexandre Polastri Filho, nº 761', status: 'Ativo' },
    { id: '19', nome: 'Ginásio Municipal de Skate Fernando Schimdт', tipo: 'Ginásio', bairro: 'Jardim Tiradentes', endereco: 'Rua 848, s/nº', status: 'Ativo' },
    { id: '20', nome: 'Ginásio Poliesportivo Francisco Gomes do Nascimento', tipo: 'Ginásio', bairro: 'São Geraldo', endereco: 'Rua Cap. BL. Bragança, nº 888', status: 'Ativo' },
  ],
  modalidades: [
    { id: '1', nome: 'Atletismo', categoria: 'Atletismo', emoji: '🏃', status: 'Ativo', faixas: ['Infantil', 'Adulto'] },
    { id: '2', nome: 'Yoga', categoria: 'Bem-estar', emoji: '🧘', status: 'Ativo', faixas: ['Adulto', 'Melhor Idade'] },
    { id: '3', nome: 'Natação', categoria: 'Aquático', emoji: '🏊', status: 'Ativo', faixas: ['Infantil', 'Adulto', 'Melhor Idade'] },
    { id: '4', nome: 'Futsal', categoria: 'Coletivo', emoji: '⚽', status: 'Ativo', faixas: ['Infantil', 'Adulto'] },
    { id: '5', nome: 'Judô', categoria: 'Luta', emoji: '🥋', status: 'Ativo', faixas: ['Infantil', 'Adulto'] },
    { id: '6', nome: 'Dança de Salão', categoria: 'Dança', emoji: '💃', status: 'Ativo', faixas: ['Adulto', 'Melhor Idade'] },
  ],
  equipes: [
    { id: '1', nome: 'Roberto Santos', cargo: 'Professor', telefone: '(24) 99999-3333', email: '' },
    { id: '2', nome: 'Ana Paula Silva', cargo: 'Professor', telefone: '(24) 99999-2222', email: 'ana@smel.vr.gov.br' },
    { id: '3', nome: 'Carlos Mendes', cargo: 'Coordenador', telefone: '(24) 99999-1111', email: 'carlos@smel.vr.gov.br' },
    { id: '4', nome: 'Juliana Costa', cargo: 'Estagiário', telefone: '(24) 99999-4444', email: '' },
  ],
  turmas: [
    { id: '1', modalidade: 'Judô', modalidadeEmoji: '🥋', poloId: null, professorId: '1', faixa: 'Infantil', dias: ['Segunda', 'Quarta'], horario: '15:00', capacidade: 20, status: 'Ativa' },
    { id: '2', modalidade: 'Futsal', modalidadeEmoji: '⚽', poloId: null, professorId: '2', faixa: 'Infantil', dias: ['Segunda', 'Quarta', 'Sexta'], horario: '14:00', capacidade: 25, status: 'Ativa' },
    { id: '3', modalidade: 'Dança de Salão', modalidadeEmoji: '💃', poloId: null, professorId: '1', faixa: 'Melhor Idade', dias: ['Terça', 'Quinta', 'Sábado'], horario: '09:00', capacidade: 30, status: 'Ativa' },
    { id: '4', modalidade: 'Yoga', modalidadeEmoji: '🧘', poloId: null, professorId: '2', faixa: 'Melhor Idade', dias: ['Terça', 'Quinta'], horario: '08:00', capacidade: 20, status: 'Ativa' },
  ],
  alunos: [
    { id: '1', nome: 'José Carlos Pereira', idade: 70, poloId: null, turmaId: '4', dataMatricula: '2022-01-10', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '2', nome: 'Tereza Cristina Lima', idade: 68, poloId: null, turmaId: '3', dataMatricula: '2021-08-15', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '3', nome: 'Rafael Costa Almeida', idade: 15, poloId: null, turmaId: '1', dataMatricula: '2022-08-20', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '4', nome: 'Maria Luísa Ferreira', idade: 14, poloId: null, turmaId: '2', dataMatricula: '2022-03-05', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '5', nome: 'Lucas Gabriel Santos', idade: 13, poloId: null, turmaId: '1', dataMatricula: '2023-01-15', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '6', nome: 'Ana Maria de Souza', idade: 65, poloId: null, turmaId: '3', dataMatricula: '2023-02-20', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '7', nome: 'Antônio Marcos Gomes', idade: 71, poloId: null, turmaId: '4', dataMatricula: '2021-05-10', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '8', nome: 'Francisco Ribeiro', idade: 73, poloId: null, turmaId: '3', dataMatricula: '2022-04-12', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '9', nome: 'Pedro Henrique Oliveira', idade: 13, poloId: null, turmaId: '2', dataMatricula: '2022-03-05', status: 'Ativo', cpf: '', telefone: '', email: '' },
    { id: '10', nome: 'Dona Maria José da Silva', idade: 68, poloId: null, turmaId: '4', dataMatricula: '2022-06-18', status: 'Ativo', cpf: '', telefone: '', email: '' },
  ],
  presencas: [],
  atestados: [],
  registros: [],
  viagens: [],
}

function getOrInit(key) {
  const raw = localStorage.getItem(key)
  if (raw) return JSON.parse(raw)
  localStorage.setItem(key, JSON.stringify(SEED[key] || []))
  return SEED[key] || []
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export const db = {
  // Generic CRUD
  getAll: (entity) => getOrInit(KEYS[entity]),
  save: (entity, data) => save(KEYS[entity], data),

  add: (entity, item) => {
    const items = getOrInit(KEYS[entity])
    const newItem = { ...item, id: Date.now().toString() }
    items.push(newItem)
    save(KEYS[entity], items)
    return newItem
  },

  update: (entity, id, updates) => {
    const items = getOrInit(KEYS[entity])
    const idx = items.findIndex(i => i.id === id)
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...updates }
      save(KEYS[entity], items)
      return items[idx]
    }
    return null
  },

  remove: (entity, id) => {
    const items = getOrInit(KEYS[entity]).filter(i => i.id !== id)
    save(KEYS[entity], items)
  },

  reset: () => {
    Object.keys(KEYS).forEach(k => localStorage.removeItem(KEYS[k]))
  },
}

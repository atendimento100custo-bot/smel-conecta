-- supabase/schema.sql

-- Enums
CREATE TYPE cargo_enum AS ENUM ('admin', 'coordenador', 'professor', 'estagiario');
CREATE TYPE status_polo AS ENUM ('Ativo', 'Inativo');
CREATE TYPE status_geral AS ENUM ('Ativo', 'Inativo');
CREATE TYPE status_turma AS ENUM ('Ativa', 'Inativa');
CREATE TYPE status_aluno AS ENUM ('Ativo', 'Inativo', 'Transferido');
CREATE TYPE faixa_enum AS ENUM ('Infantil', 'Adulto', 'Melhor Idade');

-- profiles (extensão de auth.users)
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  cargo      cargo_enum NOT NULL DEFAULT 'professor',
  telefone   text,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- polos
CREATE TABLE polos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL,
  tipo      text NOT NULL,
  bairro    text,
  endereco  text,
  status    status_polo NOT NULL DEFAULT 'Ativo'
);

-- vinculos_usuario_polo (coordenador → polos)
CREATE TABLE vinculos_usuario_polo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  polo_id    uuid NOT NULL REFERENCES polos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, polo_id)
);

-- modalidades
CREATE TABLE modalidades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  categoria  text,
  emoji      text DEFAULT '🏃',
  faixas     text[] NOT NULL DEFAULT '{}',
  status     status_geral NOT NULL DEFAULT 'Ativo'
);

-- turmas
CREATE TABLE turmas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polo_id        uuid REFERENCES polos(id) ON DELETE SET NULL,
  modalidade_id  uuid REFERENCES modalidades(id) ON DELETE SET NULL,
  professor_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  faixa          faixa_enum NOT NULL DEFAULT 'Adulto',
  dias           text[] NOT NULL DEFAULT '{}',
  horario        time,
  capacidade     int NOT NULL DEFAULT 20,
  status         status_turma NOT NULL DEFAULT 'Ativa'
);

-- vinculos_estagiario_turma
CREATE TABLE vinculos_estagiario_turma (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estagiario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  turma_id      uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estagiario_id, turma_id)
);

-- alunos
CREATE TABLE alunos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id       uuid REFERENCES turmas(id) ON DELETE SET NULL,
  nome           text NOT NULL,
  data_nasc      date,
  cpf            text,
  telefone       text,
  email          text,
  endereco       text,
  foto_url       text,
  data_matricula date NOT NULL DEFAULT CURRENT_DATE,
  status         status_aluno NOT NULL DEFAULT 'Ativo'
);

-- presencas
CREATE TABLE presencas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id        uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  aluno_id        uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  registrado_por  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  data            date NOT NULL DEFAULT CURRENT_DATE,
  presente        boolean NOT NULL DEFAULT false,
  observacao      text,
  UNIQUE(turma_id, aluno_id, data)
);

-- atestados
CREATE TABLE atestados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  data_emissao  date,
  data_validade date NOT NULL,
  arquivo_url   text,
  observacao    text
);

-- registros_aula
CREATE TABLE registros_aula (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id         uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  professor_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  data             date NOT NULL DEFAULT CURRENT_DATE,
  conteudo         text,
  ocorrencias      text,
  alunos_presentes int NOT NULL DEFAULT 0
);

-- viagens
CREATE TABLE viagens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polo_id      uuid REFERENCES polos(id) ON DELETE SET NULL,
  turma_id     uuid REFERENCES turmas(id) ON DELETE SET NULL,
  destino      text NOT NULL,
  data         date NOT NULL,
  vagas        int NOT NULL DEFAULT 0,
  observacoes  text
);

-- participantes_viagem
CREATE TABLE participantes_viagem (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id  uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  aluno_id   uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  confirmado boolean NOT NULL DEFAULT false,
  UNIQUE(viagem_id, aluno_id)
);

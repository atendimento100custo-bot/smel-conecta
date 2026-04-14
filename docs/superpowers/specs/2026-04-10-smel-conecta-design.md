# SMEL Conecta — Volta Redonda: Design Spec
**Data:** 2026-04-10  
**Status:** Aprovado para implementação

---

## Visão Geral

Sistema de gestão esportiva municipal para a SMEL (Secretaria Municipal de Esportes e Lazer) de Volta Redonda/RJ. Uso interno por funcionários da prefeitura. Controla polos esportivos, modalidades, turmas, alunos, presença, atestados médicos, registros de aula e viagens do programa Melhor Idade.

**Prazo:** 1 mês  
**Hosting:** Vercel (gratuito)  
**URL de produção:** smel-conecta.vercel.app

---

## Stack Técnica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | React 18 + Vite | Rápido, ecossistema rico |
| Roteamento | React Router v6 | SPA com rotas protegidas por papel |
| Estilo | TailwindCSS + shadcn/ui (21st.dev) | Componentes premium prontos |
| Banco de dados | Supabase (PostgreSQL) | Gratuito, Auth + RLS embutidos |
| Auth | Supabase Auth (email/senha) | Sem custo, JWT automático |
| PDF | @react-pdf/renderer | Geração no browser, sem servidor |
| Gráficos | Recharts | Leve, boa integração com React |
| Fonte | Outfit (Google Fonts) | Moderna, legível, governamental |
| Deploy | Vercel | Free tier suficiente para uso interno |

---

## Design Visual

**Direção:** Branco Limpo com navy e verde  
- Sidebar branca (220px) com navegação por seções e ícone + texto  
- Topbar com título da página e botão de ação primário  
- Fundo geral: `#f6f8fb`  
- Cor primária: `#009640` (verde SMEL)  
- Cor navy: `#0f1923`  
- Cards brancos com borda `#e8ecf3` e sombra sutil  
- Tipografia: Outfit — peso 800 para valores, 600 para labels, 400 para corpo  

---

## Arquitetura de Permissões

### 4 Níveis de Acesso

| Cargo | Escopo | Descrição |
|-------|--------|-----------|
| **Administrador** | Global | Acesso e edição completos em tudo |
| **Coordenador** | Polo(s) vinculado(s) | Gerencia tudo dentro dos seus polos |
| **Professor** | Turma(s) vinculada(s) | Gerencia turmas, alunos, presença e registros das suas turmas |
| **Estagiário** | Turma(s) vinculada(s) | Apenas registra presença nas turmas em que estagia |

### Regras por Módulo

| Módulo | Admin | Coordenador | Professor | Estagiário |
|--------|-------|-------------|-----------|------------|
| Polos | ✏️ | 👁️ | 👁️ | — |
| Modalidades | ✏️ | ✏️ polo | 👁️ | — |
| Equipe | ✏️ | ✏️ polo | 👁️ | — |
| Turmas | ✏️ | ✏️ polo | ✏️ turmas | 👁️ |
| Alunos | ✏️ | ✏️ polo | ✏️ turmas | 👁️ |
| Presença | ✏️ | ✏️ polo | ✏️ turmas | ✏️ turmas |
| Atestados | ✏️ | ✏️ polo | ✏️ turmas | — |
| Registro de Aula | ✏️ | ✏️ polo | ✏️ turmas | 👁️ |
| Viagens / Melhor Idade | ✏️ | ✏️ polo | ✏️ turmas | — |
| Relatórios PDF | ✏️ | ⬇️ polo | ⬇️ turmas | — |
| Gerenciar Acessos | ✏️ | — | — | — |
| Configurações | ✏️ | — | — | — |

### Multi-vínculo
- Coordenador pode estar vinculado a **mais de um polo** via `vinculos_usuario_polo`
- Professor pode dar aula em **mais de uma turma** — acesso derivado de `turmas.professor_id = auth.uid()` (não precisa de entrada em `vinculos_usuario_polo`)
- Estagiário vinculado a turmas específicas via `vinculos_estagiario_turma`
- Um funcionário → um login → acesso automático a todos os escopos vinculados
- O polo do professor é inferido pelas turmas em que leciona (para exibição no UI)

---

## Schema do Banco (Supabase)

### Tabela: `profiles`
Extensão do `auth.users` do Supabase.
```
id          uuid PK (= auth.users.id)
nome        text NOT NULL
cargo       enum('admin','coordenador','professor','estagiario')
telefone    text
ativo       boolean DEFAULT true
created_at  timestamp
```

### Tabela: `vinculos_usuario_polo`
Permite multi-polo por usuário.
```
id          uuid PK
usuario_id  uuid FK → profiles
polo_id     uuid FK → polos
created_at  timestamp
```

### Tabela: `vinculos_estagiario_turma`
Turmas específicas por estagiário.
```
id            uuid PK
estagiario_id uuid FK → profiles
turma_id      uuid FK → turmas
created_at    timestamp
```

### Tabela: `polos`
```
id        uuid PK
nome      text NOT NULL
tipo      text (Ginásio, Arena, Estádio, etc.)
bairro    text
endereco  text
status    enum('Ativo','Inativo') DEFAULT 'Ativo'
```

### Tabela: `modalidades`
```
id         uuid PK
nome       text NOT NULL
categoria  text
emoji      text
faixas     text[] (ex: ['Infantil','Adulto','Melhor Idade'])
status     enum('Ativo','Inativo') DEFAULT 'Ativo'
```

### Tabela: `turmas`
```
id             uuid PK
polo_id        uuid FK → polos
modalidade_id  uuid FK → modalidades
professor_id   uuid FK → profiles
faixa          enum('Infantil','Adulto','Melhor Idade')
dias           text[] (ex: ['Segunda','Quarta'])
horario        time
capacidade     int
status         enum('Ativa','Inativa') DEFAULT 'Ativa'
```

### Tabela: `alunos`
```
id             uuid PK
turma_id       uuid FK → turmas
nome           text NOT NULL
data_nasc      date
cpf            text
telefone       text
email          text
endereco       text          -- opcional
foto_url       text          -- opcional (Supabase Storage)
data_matricula date DEFAULT now()
status         enum('Ativo','Inativo','Transferido') DEFAULT 'Ativo'
```

### Tabela: `presencas`
```
id              uuid PK
turma_id        uuid FK → turmas
aluno_id        uuid FK → alunos
registrado_por  uuid FK → profiles
data            date NOT NULL
presente        boolean NOT NULL
observacao      text
```

### Tabela: `atestados`
```
id            uuid PK
aluno_id      uuid FK → alunos
data_emissao  date
data_validade date NOT NULL
arquivo_url   text (Supabase Storage)
observacao    text
```

### Tabela: `registros_aula`
```
id               uuid PK
turma_id         uuid FK → turmas
professor_id     uuid FK → profiles
data             date NOT NULL
conteudo         text
ocorrencias      text
alunos_presentes int
```

### Tabela: `viagens`
```
id           uuid PK
polo_id      uuid FK → polos
turma_id     uuid FK → turmas (nullable)
destino      text NOT NULL
data         date NOT NULL
vagas        int
observacoes  text
```

### Tabela: `participantes_viagem`
```
id         uuid PK
viagem_id  uuid FK → viagens
aluno_id   uuid FK → alunos
confirmado boolean DEFAULT false
```

---

## Páginas e Rotas

| Rota | Página | Acesso mínimo |
|------|--------|---------------|
| `/login` | Login com email/senha | Público |
| `/` | Dashboard (KPIs + gráficos) | Todos |
| `/polos` | Lista de polos com filtro por tipo | Todos |
| `/polos/:id` | Detalhe do polo | Todos |
| `/modalidades` | CRUD de modalidades | Coordenador+ |
| `/equipes` | CRUD de membros da equipe | Coordenador+ |
| `/turmas` | CRUD de turmas | Professor+ |
| `/alunos` | CRUD de alunos + import CSV | Professor+ |
| `/alunos/:id` | Perfil do aluno | Professor+ |
| `/presenca` | Registro de presença por turma/data | Estagiário+ |
| `/atestados` | Controle de atestados com alerta de vencimento | Professor+ |
| `/registro-aula` | Diário de aulas | Professor+ |
| `/melhor-idade` | Elegibilidade para viagens (freq. ≥ X%) | Professor+ |
| `/viagens` | Gestão de viagens Melhor Idade | Coordenador+ |
| `/relatorios` | Geração de PDF (presença, turmas, alunos) | Professor+ |
| `/gerenciar-acesso` | CRUD de usuários + vínculos | Admin |
| `/configuracoes` | Configurações gerais | Admin |

---

## Funcionalidades Chave

### PDF Real
- Biblioteca: `@react-pdf/renderer`
- Tipos de relatório: Frequência/Presença, Turmas, Alunos
- Filtros: por turma, polo, mês/ano
- Layout profissional com logo SMEL, data de emissão e assinatura

### Import CSV de Alunos
- Upload de CSV com nome, data_nasc, cpf, telefone
- Preview antes de importar
- Validação de CPF duplicado
- Atribuição de turma no import

### Elegibilidade Melhor Idade
- Regra: aluno 60+ com frequência ≥ 75% no mês → Elegível
- Status: Elegível (verde), Quase lá (âmbar, 60-74%), Não elegível (vermelho)
- Dashboard específico com lista e progresso por aluno

### Alertas no Dashboard
- Atestados vencendo em 30 dias
- Aulas sem registro
- Turmas com capacidade acima de 90%
- Alunos sem polo vinculado

---

## Segurança

- RLS ativo em todas as tabelas
- JWT do Supabase Auth em cada requisição
- Rotas protegidas no frontend com `<ProtectedRoute role={...} />`
- Sem exposição de chave `service_role` no cliente
- Apenas `anon key` pública no `.env`

---

## Melhorias em relação ao base44

1. **4 níveis de acesso** com RLS real (base44 só tinha Admin/Professor)
2. **Multi-polo por usuário** via tabela de vínculos
3. **Professor limitado às suas turmas** (antes via tudo)
4. **Estagiário** como papel próprio com acesso só a presença
5. **PDF gerado de verdade** com @react-pdf/renderer
6. **Foto e endereço** no cadastro do aluno
7. **Status do aluno** com opção "Transferido"
8. **Participantes de viagem** com confirmação individual
9. **UI/UX premium** com 21st.dev components

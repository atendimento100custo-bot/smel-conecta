// src/pages/PoloDetalhe.jsx
import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import Topbar from '../components/Topbar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import {
  ArrowLeft, MapPin, Users, BookOpen, Clock, Stethoscope,
  TrendingUp, UserCheck, CheckCircle2, Circle, Camera,
  Bus, Star, Save, ChevronRight, Trophy, Plus
} from 'lucide-react'
import { subDays, isSameDay, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ─── helpers ─────────────────────────────────────────────────────────────────
const DIAS_JS = { 'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }
const CARGO_COLORS = { professor: 'amber', coordenador: 'blue', estagiario: 'purple', admin: 'green' }
const CARGO_LABELS = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }
const DIAS_OPTIONS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const FAIXAS = ['Infantil', 'Adulto', 'Melhor Idade']
const EMPTY_TURMA_FORM = { modalidade_id: '', professor_id: '', dias: [], horario: '', faixa: 'Infantil', capacidade: 20, status: 'Ativa' }

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// ─── sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight
      ? 'bg-gradient-to-br from-primary-700 to-primary-500 border-transparent text-white'
      : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700'}`}>
      <div className="flex items-start justify-between mb-2">
        <p className={`text-[9px] font-bold uppercase tracking-widest ${highlight ? 'text-primary-100' : 'text-slate-400 dark:text-slate-500'}`}>{label}</p>
        {Icon && <Icon size={13} className={highlight ? 'text-primary-200' : 'text-slate-300 dark:text-slate-600'} />}
      </div>
      <p className={`text-3xl font-extrabold leading-none ${highlight ? 'text-white' : 'text-navy-900 dark:text-white'}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${highlight ? 'text-primary-100' : 'text-slate-400 dark:text-slate-500'}`}>{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-navy-900 dark:text-white mb-1 capitalize">{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.fill }} className="font-medium">{p.name}: {p.value}</p>)}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Aula Modal (presença + registro) ────────────────────────────────────────
function AulaModal({ turma, alunos, presencas, registros, open, onClose, onSaved }) {
  const { profile } = useAuth()
  const [presencaMap, setPresencaMap] = useState({})
  const [registro, setRegistro] = useState({ conteudo: '', ocorrencias: '' })
  const [fotos, setFotos] = useState([]) // URLs
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dataHoje = new Date().toISOString().split('T')[0]

  // Lock logic — 30 min grace period after class ends
  const [h, m] = (turma?.horario || '00:00').split(':').map(Number)
  const endMins = h * 60 + m + 90
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const isLocked = nowMins > endMins + 30

  const alunosTurma = useMemo(
    () => alunos.filter(a => a.turma_id === turma?.id && a.status === 'Ativo'),
    [alunos, turma]
  )

  useEffect(() => {
    if (!turma || !open) return
    // Init presença (use existing if any, else default all absent)
    const existentes = presencas.filter(p => p.turma_id === turma.id && p.data === dataHoje)
    const map = {}
    alunosTurma.forEach(a => {
      const ex = existentes.find(p => p.aluno_id === a.id)
      map[a.id] = ex ? ex.presente : false
    })
    setPresencaMap(map)

    // Init registro
    const reg = registros.find(r => r.turma_id === turma.id && r.data === dataHoje)
    setRegistro({ conteudo: reg?.conteudo ?? '', ocorrencias: reg?.ocorrencias ?? '' })
    setFotos(reg?.fotos ?? [])
    setSaved(false)
  }, [turma, open])

  async function salvarPresenca() {
    await supabase.from('presencas').delete().eq('turma_id', turma.id).eq('data', dataHoje)
    const rows = Object.entries(presencaMap).map(([aluno_id, presente]) => ({
      turma_id: turma.id, aluno_id, data: dataHoje, presente
    }))
    if (rows.length) await supabase.from('presencas').insert(rows)
  }

  async function salvarRegistro() {
    const presentesCount = Object.values(presencaMap).filter(Boolean).length
    await supabase.from('registros_aula').upsert({
      turma_id: turma.id,
      data: dataHoje,
      conteudo: registro.conteudo,
      ocorrencias: registro.ocorrencias,
      alunos_presentes: presentesCount,
      professor_id: profile?.id ?? null,
    }, { onConflict: 'turma_id,data' })
  }

  async function salvarAula() {
    setSaving(true)
    await salvarPresenca()
    await salvarRegistro()
    setSaving(false)
    setSaved(true)
    onSaved?.()
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleFotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('registros-aula').upload(filename, file)
    if (!error) {
      const { data } = supabase.storage.from('registros-aula').getPublicUrl(filename)
      setFotos(f => [...f, data.publicUrl])
    }
    setUploadingFoto(false)
    e.target.value = ''
  }

  const presentes = Object.values(presencaMap).filter(Boolean).length
  const total = alunosTurma.length

  if (!turma) return null
  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={`${turma.modalidades?.emoji ?? '📚'} ${turma.modalidades?.nome ?? 'Turma'} · ${turma.dias?.join(', ') ?? ''} · ${turma.horario?.slice(0,5) ?? ''}`}
    >
      <div className="space-y-4">
        {/* Lock banner */}
        {isLocked && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300 font-medium">🔒 Aula encerrada — registro não pode mais ser alterado.</div>
        )}
        {/* Seção: Registro da Aula */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Registro da Aula</p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Conteúdo</label>
            <textarea
              value={registro.conteudo}
              onChange={e => setRegistro(r => ({ ...r, conteudo: e.target.value }))}
              rows={3}
              placeholder="Descreva o conteúdo abordado na aula..."
              disabled={isLocked}
              readOnly={isLocked}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ocorrências</label>
            <textarea
              value={registro.ocorrencias}
              onChange={e => setRegistro(r => ({ ...r, ocorrencias: e.target.value }))}
              rows={2}
              placeholder="Observações, intercorrências..."
              disabled={isLocked}
              readOnly={isLocked}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Fotos */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Fotos da Aula</label>
            <div className="flex gap-2 flex-wrap">
              {fotos.map((url, i) => (
                <img key={i} src={url} alt={`foto-${i}`} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-navy-600" />
              ))}
              {!isLocked && (
                <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition-colors ${uploadingFoto ? 'opacity-50' : ''}`}>
                  <Camera size={16} className="text-slate-400 mb-0.5" />
                  <span className="text-[9px] text-slate-400">{uploadingFoto ? '...' : 'Foto'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} disabled={uploadingFoto} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Divisor: Lista de Presença */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-navy-600" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Lista de Presença</span>
              <span className="text-[10px] font-semibold text-primary-600">{presentes} presentes / {total} total</span>
            </div>
            <div className="flex-1 h-px bg-slate-200 dark:bg-navy-600" />
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setPresencaMap(m => Object.fromEntries(Object.keys(m).map(k => [k, true])))}
              className="text-[10px] font-semibold text-primary-600 hover:text-primary-700 px-2 py-0.5 rounded border border-primary-200 dark:border-primary-700">Todos</button>
            <button onClick={() => setPresencaMap(m => Object.fromEntries(Object.keys(m).map(k => [k, false])))}
              className="text-[10px] font-semibold text-red-500 hover:text-red-600 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">Nenhum</button>
          </div>

          {alunosTurma.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">Nenhum aluno ativo nesta turma.</div>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {alunosTurma.map(a => (
                <button
                  key={a.id}
                  onClick={() => setPresencaMap(m => ({ ...m, [a.id]: !m[a.id] }))}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    presencaMap[a.id]
                      ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700'
                      : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800'
                  }`}
                >
                  {presencaMap[a.id]
                    ? <CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" />
                    : <Circle size={16} className="text-red-400 flex-shrink-0" />}
                  <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[9px] font-bold">{a.nome?.charAt(0)}</span>
                  </div>
                  <span className="text-xs font-medium text-navy-900 dark:text-white text-left">{a.nome}</span>
                  <span className={`ml-auto text-[10px] font-semibold ${presencaMap[a.id] ? 'text-primary-600' : 'text-red-400'}`}>
                    {presencaMap[a.id] ? 'Presente' : 'Falta'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botão único */}
        {!isLocked && (
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={salvarAula} disabled={saving}>
              {saved ? <><CheckCircle2 size={13}/> Salvo!</> : saving ? 'Salvando...' : <><Save size={13}/> Salvar Aula</>}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function CriterioIcon({ ok }) {
  return ok
    ? <CheckCircle2 size={14} className="text-primary-600 mx-auto" />
    : <Circle size={14} className="text-red-400 mx-auto" />
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PoloDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { dark } = useTheme()
  const { isAdmin, isCoordenador, profile } = useAuth()
  const canEdit = isAdmin || isCoordenador

  const [tab, setTab] = useState('geral')
  const [aulaOpen, setAulaOpen] = useState(null)

  const { data: polos } = useSupabaseData('polos', '*')
  const { data: turmas, reload: reloadTurmas } = useSupabaseData('turmas', '*, modalidades(nome,emoji), profiles(id,nome,cargo), polos(nome)')
  const { data: alunos } = useSupabaseData('alunos', 'id,nome,status,turma_id,data_nasc,data_matricula')
  const { data: presencas, reload: reloadPresencas } = useSupabaseData('presencas', 'id,data,presente,turma_id,aluno_id')
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')
  const { data: viagens, reload: reloadViagens } = useSupabaseData('viagens', '*, turmas(*, modalidades(nome,emoji))')
  const { data: modalidades } = useSupabaseData('modalidades', 'id,nome,emoji')
  const { data: professores } = useSupabaseData('profiles', 'id,nome,cargo')
  const { data: registros, reload: reloadRegistros } = useSupabaseData('registros_aula', 'id,turma_id,data,conteudo,ocorrencias,alunos_presentes')

  // Nova turma form
  const [turmaModalOpen, setTurmaModalOpen] = useState(false)
  const [turmaForm, setTurmaForm] = useState(EMPTY_TURMA_FORM)
  const [savingTurma, setSavingTurma] = useState(false)

  // Viagem form
  const [viagemModalOpen, setViagemModalOpen] = useState(false)
  const [viagemTurma, setViagemTurma] = useState(null)
  const [viagemForm, setViagemForm] = useState({ destino: '', data: '', vagas: 20 })
  const [savingViagem, setSavingViagem] = useState(false)

  // Novo aluno direto do polo
  const EMPTY_ALUNO = { nome: '', data_nasc: '', cpf: '', telefone: '', telefone_emergencia: '', email: '', status: 'Ativo', turma_id: '' }
  const [novoAlunoOpen, setNovoAlunoOpen] = useState(false)
  const [novoAlunoForm, setNovoAlunoForm] = useState(EMPTY_ALUNO)
  const [savingAluno, setSavingAluno] = useState(false)

  const polo = polos.find(p => p.id === id)
  const turmasPolo = useMemo(() => turmas.filter(t => t.polo_id === id), [turmas, id])

  // Verificar se professor tem acesso a este polo
  const temAcesso = useMemo(() => {
    if (isAdmin || isCoordenador) return true
    return turmasPolo.some(t => t.professor_id === profile?.id)
  }, [isAdmin, isCoordenador, turmasPolo, profile])

  useEffect(() => {
    if (turmasPolo.length >= 0 && !temAcesso && polos.length > 0) {
      navigate('/polos')
    }
  }, [temAcesso, polos])

  const turmaIds = useMemo(() => new Set(turmasPolo.map(t => t.id)), [turmasPolo])
  const alunosPolo = useMemo(() => alunos.filter(a => turmaIds.has(a.turma_id)), [alunos, turmaIds])
  const alunoIds = useMemo(() => new Set(alunosPolo.map(a => a.id)), [alunosPolo])
  const presencasPolo = useMemo(() => presencas.filter(p => turmaIds.has(p.turma_id)), [presencas, turmaIds])
  const atestadosPolo = useMemo(() => atestados.filter(a => alunoIds.has(a.aluno_id)), [atestados, alunoIds])
  const viagensPolo = useMemo(() => viagens.filter(v => v.polo_id === id || turmaIds.has(v.turma_id)), [viagens, id, turmaIds])

  // KPIs
  const hoje = new Date()
  const hoje_str = hoje.toISOString().split('T')[0]
  const em30 = new Date(); em30.setDate(hoje.getDate() + 30)
  const ha30 = new Date(); ha30.setDate(hoje.getDate() - 30)
  const alunosAtivos = alunosPolo.filter(a => a.status === 'Ativo').length
  const turmasAtivas = turmasPolo.filter(t => t.status === 'Ativa').length
  const freqMedia = useMemo(() => {
    if (!presencasPolo.length) return 0
    return Math.round((presencasPolo.filter(p => p.presente).length / presencasPolo.length) * 100)
  }, [presencasPolo])
  const melhorIdade = useMemo(() => alunosPolo.filter(a => {
    if (a.status !== 'Ativo' || !a.data_nasc) return false
    return new Date().getFullYear() - new Date(a.data_nasc).getFullYear() >= 60
  }).length, [alunosPolo])
  const alunosNovos = alunosPolo.filter(a => a.data_matricula && new Date(a.data_matricula) >= ha30).length
  const ocupacao = useMemo(() => {
    const cap = turmasPolo.filter(t => t.status === 'Ativa').reduce((s, t) => s + (t.capacidade || 0), 0)
    return cap ? Math.round((alunosAtivos / cap) * 100) : 0
  }, [turmasPolo, alunosAtivos])
  const atestadosVencendo = atestadosPolo.filter(a => { const v = new Date(a.data_validade); return v >= hoje && v <= em30 }).length
  const atestadosVencidos = atestadosPolo.filter(a => new Date(a.data_validade) < hoje).length

  // Gráfico
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const dp = presencasPolo.filter(p => isSameDay(new Date(p.data), d))
    return { dia: format(d, 'EEE', { locale: ptBR }), Presentes: dp.filter(p => p.presente).length, Faltas: dp.filter(p => !p.presente).length }
  })

  // Modalidades agrupadas
  const porModalidade = useMemo(() => {
    const map = {}
    turmasPolo.forEach(t => {
      const nome = t.modalidades?.nome ?? 'Sem modalidade'
      const emoji = t.modalidades?.emoji ?? '🏃'
      if (!map[nome]) map[nome] = { nome, emoji, turmas: [] }
      map[nome].turmas.push(t)
    })
    return Object.values(map)
  }, [turmasPolo])

  // Equipe
  const equipe = useMemo(() => {
    const seen = new Set(); const lista = []
    turmasPolo.forEach(t => { if (t.profiles && !seen.has(t.profiles.id)) { seen.add(t.profiles.id); lista.push(t.profiles) } })
    return lista
  }, [turmasPolo])

  // Operacional — aulas de hoje
  const diaHoje = hoje.getDay()
  const aulasHoje = turmasPolo.filter(t => t.dias?.some(d => DIAS_JS[d] === diaHoje))
  const agoraMins = hoje.getHours() * 60 + hoje.getMinutes()
  const aulaAgora = aulasHoje.find(t => {
    if (!t.horario) return false
    const [h, m] = t.horario.split(':').map(Number)
    const tMins = h * 60 + m
    return agoraMins >= tMins - 30 && agoraMins <= tMins + 90
  })

  // Turmas Melhor Idade
  const turmasMelhorIdade = turmasPolo.filter(t => t.faixa === 'Melhor Idade')

  // Nova turma
  async function salvarTurma() {
    if (!turmaForm.modalidade_id || !turmaForm.horario || turmaForm.dias.length === 0) return
    setSavingTurma(true)
    await supabase.from('turmas').insert({
      polo_id: id,
      modalidade_id: turmaForm.modalidade_id,
      professor_id: turmaForm.professor_id || null,
      dias: turmaForm.dias,
      horario: turmaForm.horario,
      faixa: turmaForm.faixa,
      capacidade: Number(turmaForm.capacidade),
      status: turmaForm.status,
    })
    setSavingTurma(false)
    setTurmaModalOpen(false)
    setTurmaForm(EMPTY_TURMA_FORM)
    reloadTurmas()
  }

  // Viagem nova
  async function salvarViagem() {
    if (!viagemForm.destino || !viagemForm.data) return
    setSavingViagem(true)
    await supabase.from('viagens').insert({
      destino: viagemForm.destino,
      data: viagemForm.data,
      polo_id: id,
      turma_id: viagemTurma?.id ?? null,
      vagas: Number(viagemForm.vagas),
    })
    setSavingViagem(false)
    setViagemModalOpen(false)
    setViagemForm({ destino: '', data: '', vagas: 20 })
    reloadViagens()
  }

  async function salvarNovoAluno() {
    if (!novoAlunoForm.nome.trim()) return
    setSavingAluno(true)
    const payload = {
      nome: novoAlunoForm.nome.trim(),
      data_nasc: novoAlunoForm.data_nasc || null,
      cpf: novoAlunoForm.cpf || null,
      telefone: novoAlunoForm.telefone || null,
      telefone_emergencia: novoAlunoForm.telefone_emergencia || null,
      email: novoAlunoForm.email || null,
      turma_id: novoAlunoForm.turma_id || null,
      status: novoAlunoForm.status,
    }
    const { data } = await supabase.from('alunos').insert(payload).select('id').single()
    if (data?.id && novoAlunoForm.turma_id) {
      await supabase.from('aluno_turmas').insert({ aluno_id: data.id, turma_id: novoAlunoForm.turma_id })
    }
    setSavingAluno(false)
    setNovoAlunoOpen(false)
    setNovoAlunoForm(EMPTY_ALUNO)
  }

  const axisColor = dark ? '#475569' : '#94a3b8'
  const gridColor = dark ? '#1e2d42' : '#f1f5f9'

  if (!polo && polos.length > 0) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar title="Polo não encontrado" action={
          <button onClick={() => navigate('/polos')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft size={13}/> Voltar</button>
        }/>
        <div className="flex-1 flex items-center justify-center"><p className="text-sm text-slate-400">Polo não encontrado.</p></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={polo?.nome ?? 'Carregando...'}
        action={
          <button onClick={() => navigate('/polos')} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <ArrowLeft size={13}/> Polos
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">
        {/* Header do polo */}
        {polo && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
              <MapPin size={22} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-navy-900 dark:text-white">{polo.nome}</p>
                <Badge color={polo.status === 'Ativo' ? 'green' : 'gray'}>{polo.status}</Badge>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{polo.tipo}{polo.bairro ? ` · ${polo.bairro}` : ''}</p>
              {polo.endereco && <p className="text-[11px] text-slate-400 dark:text-slate-500">{polo.endereco}</p>}
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => { setNovoAlunoForm(EMPTY_ALUNO); setNovoAlunoOpen(true) }}>
                <Plus size={13}/> <span className="hidden sm:inline">Novo Aluno</span>
              </Button>
            )}
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl overflow-x-auto w-full md:w-fit">
          <TabBtn active={tab === 'geral'} onClick={() => setTab('geral')}>📊 Visão Geral</TabBtn>
          <TabBtn active={tab === 'operacional'} onClick={() => setTab('operacional')}>🏃 Operacional</TabBtn>
          <TabBtn active={tab === 'viagens'} onClick={() => setTab('viagens')}>🚌 Viagens</TabBtn>
        </div>

        {/* ─── VISÃO GERAL ──────────────────────────────────────────── */}
        {tab === 'geral' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Alunos Ativos" value={alunosAtivos} sub={`em ${turmasAtivas} turmas`} icon={Users} highlight />
              <KpiCard label="Turmas Ativas" value={turmasAtivas} sub="em funcionamento" icon={BookOpen} />
              <KpiCard label="Freq. Média" value={`${freqMedia}%`} sub="geral no polo" icon={TrendingUp} />
              <KpiCard label="Melhor Idade" value={melhorIdade} sub="alunos 60+" icon={UserCheck} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Novos (30 dias)" value={alunosNovos} sub="matrículas recentes" icon={Users} />
              <KpiCard label="Ocupação" value={`${ocupacao}%`} sub="capacidade total" icon={TrendingUp} />
              <KpiCard label="Atestados Vencendo" value={atestadosVencendo} sub="próximos 30 dias" icon={Stethoscope} />
              <KpiCard label="Atestados Vencidos" value={atestadosVencidos} sub="requer renovação" icon={Stethoscope} />
            </div>

            {atestadosVencendo > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
                ⚠️ {atestadosVencendo} atestado(s) vencendo nos próximos 30 dias
              </div>
            )}
            {atestadosVencidos > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-300 font-medium">
                🚨 {atestadosVencidos} atestado(s) vencido(s) — alunos precisam renovar
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Presença 7 dias */}
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Presença — últimos 7 dias</p>
                {presencasPolo.length === 0 ? (
                  <div className="h-[140px] flex flex-col items-center justify-center gap-2">
                    <div className="text-2xl">📊</div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Nenhuma presença registrada neste polo.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={ultimos7} barSize={14} barGap={3}>
                      <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: dark ? '#1e2d42' : '#f8fafc' }} />
                      <Bar dataKey="Presentes" fill="#009640" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Faltas" fill="#f87171" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-primary-600 inline-block" /> Presentes</span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Faltas</span>
                </div>
              </div>

              {/* Equipe */}
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Equipe no Polo</p>
                {equipe.length === 0 ? (
                  <div className="h-[140px] flex flex-col items-center justify-center gap-2">
                    <div className="text-2xl">👥</div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Nenhum professor vinculado às turmas deste polo.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {equipe.map(m => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[9px] font-bold">{m.nome?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <p className="text-xs font-semibold text-navy-900 dark:text-white flex-1 truncate">{m.nome}</p>
                        <Badge color={CARGO_COLORS[m.cargo] ?? 'gray'}>{CARGO_LABELS[m.cargo] ?? m.cargo}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modalidades e Turmas */}
            {porModalidade.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">Modalidades e Turmas</p>
                <div className="space-y-3">
                  {porModalidade.map(mod => (
                    <div key={mod.nome} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{mod.emoji}</span>
                        <p className="text-xs font-bold text-navy-900 dark:text-white">{mod.nome}</p>
                        <span className="text-[10px] text-slate-400 ml-auto">{mod.turmas.length} turma{mod.turmas.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {mod.turmas.map(t => {
                          const cnt = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
                          return (
                            <button key={t.id} onClick={() => navigate(`/alunos?turma_id=${t.id}`)}
                              className="text-left p-3 rounded-lg bg-slate-50 dark:bg-navy-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-transparent hover:border-primary-200 dark:hover:border-primary-700 transition-all group">
                              <div className="flex items-center justify-between mb-1">
                                <Badge color={t.status === 'Ativa' ? 'green' : 'gray'}>{t.status}</Badge>
                                <span className="text-[10px] font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver alunos →</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                <Clock size={9}/>{t.dias?.join(', ') || '—'}{t.horario ? ` · ${t.horario.slice(0,5)}` : ''}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                <Users size={9}/>{cnt} ativo{cnt !== 1 ? 's' : ''} · cap. {t.capacidade}
                              </div>
                              {t.profiles && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{t.profiles.nome}</p>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ─── OPERACIONAL ──────────────────────────────────────────── */}
        {tab === 'operacional' && (
          <div className="space-y-4">
            {canEdit && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setTurmaForm(EMPTY_TURMA_FORM); setTurmaModalOpen(true) }}>
                  <Plus size={13}/> Nova Turma
                </Button>
              </div>
            )}
            {/* Aula agora */}
            {aulaAgora && (
              <div className="bg-gradient-to-r from-primary-700 to-primary-500 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-100">Aula Acontecendo Agora</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{aulaAgora.modalidades?.emoji ?? '🏃'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{aulaAgora.modalidades?.nome ?? '—'}</p>
                    <p className="text-xs text-primary-100">{aulaAgora.faixa} · {aulaAgora.dias?.join(', ')} · {aulaAgora.horario?.slice(0,5)}</p>
                    {aulaAgora.profiles && <p className="text-xs text-primary-200">{aulaAgora.profiles.nome}</p>}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setAulaOpen(aulaAgora)}
                    className="bg-white text-primary-700 hover:bg-primary-50 border-0"
                  >
                    Registrar Aula
                  </Button>
                </div>
              </div>
            )}

            {/* Aulas de hoje */}
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">
                Aulas de Hoje — {format(hoje, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              {aulasHoje.length === 0 ? (
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma aula programada para hoje neste polo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aulasHoje.map(t => {
                    const isAgora = t.id === aulaAgora?.id
                    const alunosTurma = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
                    const presencaHoje = presencas.filter(p => p.turma_id === t.id && p.data === new Date().toISOString().split('T')[0])
                    const jaRegistrou = presencaHoje.length > 0
                    const registroHoje = registros.find(r => r.turma_id === t.id && r.data === new Date().toISOString().split('T')[0])

                    return (
                      <button
                        key={t.id}
                        onClick={() => setAulaOpen(t)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          isAgora
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                            : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-primary-200 dark:hover:border-primary-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{t.modalidades?.emoji ?? '📚'}</span>
                            <div>
                              <p className="text-xs font-bold text-navy-900 dark:text-white">{t.modalidades?.nome ?? '—'}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">{t.faixa}</p>
                            </div>
                          </div>
                          {isAgora && <span className="text-[9px] bg-primary-600 text-white px-2 py-0.5 rounded-full font-bold">AGORA</span>}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <Clock size={9}/>{t.horario?.slice(0,5) ?? '—'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <Users size={9}/>{alunosTurma} alunos
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {jaRegistrou
                            ? <span className="flex items-center gap-1 text-[10px] text-primary-600 font-semibold"><CheckCircle2 size={11}/> Presença registrada</span>
                            : <span className="text-[10px] text-slate-400">Toque para registrar</span>
                          }
                          {registroHoje && <span className="flex items-center gap-1 text-[10px] text-primary-600 font-semibold"><CheckCircle2 size={11}/> Aula registrada</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Todas as turmas do polo */}
            {turmasPolo.filter(t => !aulasHoje.find(a => a.id === t.id)).length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">Outras Turmas — não acontecem hoje</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {turmasPolo.filter(t => !aulasHoje.find(a => a.id === t.id)).map(t => (
                    <div key={t.id}
                      className="text-left p-4 rounded-xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{t.modalidades?.emoji ?? '📚'}</span>
                        <div>
                          <p className="text-xs font-bold text-navy-900 dark:text-white">{t.modalidades?.nome ?? '—'}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t.dias?.join(', ')} · {t.horario?.slice(0,5)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico de Aulas */}
            {registros.filter(r => turmaIds.has(r.turma_id)).length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">Histórico de Aulas</p>
                <div className="space-y-2">
                  {registros
                    .filter(r => turmaIds.has(r.turma_id))
                    .sort((a, b) => b.data.localeCompare(a.data))
                    .map(r => {
                      const turma = turmasPolo.find(t => t.id === r.turma_id)
                      const presencasDia = presencas.filter(p => p.turma_id === r.turma_id && p.data === r.data)
                      const presentes = presencasDia.filter(p => p.presente).length
                      const total = presencasDia.length
                      return (
                        <div key={r.id} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{turma?.modalidades?.emoji ?? '📚'}</span>
                              <div>
                                <p className="text-xs font-bold text-navy-900 dark:text-white">{turma?.modalidades?.nome ?? '—'}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(r.data)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-primary-600">{presentes}/{total} presentes</span>
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-600 rounded-full" style={{ width: `${total ? (presentes/total)*100 : 0}%` }} />
                              </div>
                            </div>
                          </div>
                          {r.conteudo && <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2">{r.conteudo}</p>}
                          {r.ocorrencias && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 line-clamp-1">⚠ {r.ocorrencias}</p>}
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── VIAGENS ──────────────────────────────────────────────── */}
        {tab === 'viagens' && (
          <div className="space-y-4">
            {turmasMelhorIdade.length === 0 ? (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-10 text-center">
                <Star size={32} className="text-slate-200 dark:text-navy-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma turma de Melhor Idade neste polo.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Cadastre turmas com faixa "Melhor Idade" para gerenciar viagens aqui.</p>
              </div>
            ) : (
              <>
                {/* Cabeçalho de elegibilidade */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
                  <Trophy size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-0.5">
                      Todas as turmas de Melhor Idade deste polo estão elegíveis para viagens. Alunos de qualquer turma Melhor Idade podem participar.
                    </p>
                  </div>
                  <div className="flex-shrink-0 bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                    {turmasMelhorIdade.reduce((sum, t) => sum + alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length, 0)} elegíveis
                  </div>
                </div>

                {turmasMelhorIdade.map(t => {
                const turmaViagens = viagensPolo.filter(v => v.turma_id === t.id || (!v.turma_id && v.polo_id === id))
                const alunosTurma = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
                return (
                  <div key={t.id} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{t.modalidades?.emoji ?? '⭐'}</span>
                        <div>
                          <p className="text-xs font-bold text-navy-900 dark:text-white">{t.modalidades?.nome ?? '—'}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t.dias?.join(', ')} · {t.horario?.slice(0,5)} · {alunosTurma} alunos</p>
                        </div>
                      </div>
                      {canEdit && (
                        <Button size="sm" onClick={() => { setViagemTurma(t); setViagemModalOpen(true) }}>
                          <Bus size={13}/> Nova Viagem
                        </Button>
                      )}
                    </div>

                    {turmaViagens.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 py-2">Nenhuma viagem cadastrada para esta turma.</p>
                    ) : (
                      <div className="space-y-2">
                        {turmaViagens.map(v => {
                          const dataViagem = new Date(v.data + 'T00:00:00')
                          const passou = dataViagem < hoje
                          return (
                            <div key={v.id} className={`flex items-center gap-3 p-3 rounded-lg ${passou ? 'bg-slate-50 dark:bg-navy-700/50' : 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800'}`}>
                              <Bus size={16} className={passou ? 'text-slate-400' : 'text-primary-600'} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-navy-900 dark:text-white truncate">{v.destino}</p>
                                <p className="text-[10px] text-slate-400">{formatDate(v.data)} · {v.vagas} vagas</p>
                              </div>
                              <Badge color={passou ? 'gray' : 'green'}>{passou ? 'Realizada' : 'Próxima'}</Badge>
                            </div>
                          )
                        })}
                      </div>
                    )}

                  </div>
                )
              })}

              {/* Elegibilidade Detalhada */}
              {(() => {
                const alunosMelhorIdadeRaw = alunosPolo.filter(a => {
                  if (!a.data_nasc) return false
                  return new Date().getFullYear() - new Date(a.data_nasc).getFullYear() >= 60
                })
                // Enriquecer com freq e ordenar por freq desc (ranking)
                const alunosMelhorIdade = alunosMelhorIdadeRaw.map(a => {
                  const pAluno = presencas.filter(p => p.aluno_id === a.id)
                  const freqAluno = pAluno.length > 0 ? Math.round(pAluno.filter(p => p.presente).length / pAluno.length * 100) : null
                  return { ...a, freqAluno, pAluno }
                }).sort((a, b) => {
                  if (a.freqAluno === null && b.freqAluno === null) return 0
                  if (a.freqAluno === null) return 1
                  if (b.freqAluno === null) return -1
                  return b.freqAluno - a.freqAluno
                })
                return (
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">
                      Elegibilidade para Viagens — {alunosMelhorIdade.length} alunos Melhor Idade
                    </p>
                    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden overflow-x-auto">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-700 min-w-[500px]">
                        <p className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">#</p>
                        <p className="col-span-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Aluno</p>
                        <p className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Turma</p>
                        <p className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Ativo</p>
                        <p className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Atest.</p>
                        <p className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Freq.</p>
                        <p className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Elegível</p>
                      </div>
                      {alunosMelhorIdade.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <p className="text-sm text-slate-400">Nenhum aluno Melhor Idade neste polo.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-navy-700 min-w-[500px]">
                          {alunosMelhorIdade.map((a, idx) => {
                            const turmaAluno = turmasPolo.find(t => t.id === a.turma_id)
                            const atestadosAluno = atestados.filter(at => at.aluno_id === a.id)
                            const temAtestadoValido = atestadosAluno.some(at => at.data_validade >= hoje_str)
                            const estaAtivo = a.status === 'Ativo'
                            const freqAluno = a.freqAluno
                            const elegivel = estaAtivo && temAtestadoValido && freqAluno !== null && freqAluno >= 70
                            const idade = a.data_nasc ? new Date().getFullYear() - new Date(a.data_nasc).getFullYear() : null
                            return (
                              <div key={a.id} onClick={() => navigate('/alunos/' + a.id)} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700/50 transition-colors ${elegivel ? '' : 'bg-red-50/30 dark:bg-red-900/5'}`}>
                                <div className="col-span-1">
                                  <span className={`text-[10px] font-bold ${
                                    idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-300 dark:text-slate-600'
                                  }`}>{idx + 1}</span>
                                </div>
                                <div className="col-span-3 flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-[9px] font-bold">{a.nome?.charAt(0)}</span>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-navy-900 dark:text-white leading-tight">{a.nome}</p>
                                    {idade && <p className="text-[9px] text-slate-400">{idade} anos</p>}
                                  </div>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                                    {turmaAluno?.modalidades?.emoji} {turmaAluno?.modalidades?.nome ?? '—'}
                                  </p>
                                  <p className="text-[9px] text-slate-400">{turmaAluno?.dias?.join(', ')} · {turmaAluno?.horario?.slice(0,5)}</p>
                                </div>
                                <div className="col-span-1 text-center"><CriterioIcon ok={estaAtivo} /></div>
                                <div className="col-span-1 text-center"><CriterioIcon ok={temAtestadoValido} /></div>
                                <div className="col-span-2 text-center">
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <div className="w-12 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{
                                        width: `${freqAluno ?? 0}%`,
                                        backgroundColor: freqAluno >= 70 ? '#009640' : freqAluno >= 50 ? '#f59e0b' : '#ef4444'
                                      }} />
                                    </div>
                                    <span className={`text-[10px] font-bold ${freqAluno >= 70 ? 'text-primary-600' : freqAluno >= 50 ? 'text-amber-500' : freqAluno > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                      {freqAluno !== null ? `${freqAluno}%` : '—'}
                                    </span>
                                  </div>
                                </div>
                                <div className="col-span-2 text-center">
                                  {elegivel
                                    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-full">✓ Elegível</span>
                                    : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">✗ Pendente</span>
                                  }
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de Aula (Presença + Registro) */}
      <AulaModal
        turma={aulaOpen}
        alunos={alunos}
        presencas={presencas}
        registros={registros}
        open={!!aulaOpen}
        onClose={() => setAulaOpen(null)}
        onSaved={() => { reloadPresencas(); reloadRegistros() }}
      />

      {/* Modal Nova Turma */}
      <Modal open={turmaModalOpen} onClose={() => setTurmaModalOpen(false)} title="Nova Turma" size="lg">
        <div className="space-y-4">
          {/* Modalidade */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Modalidade *</label>
            <select value={turmaForm.modalidade_id} onChange={e => setTurmaForm(f => ({ ...f, modalidade_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Selecione uma modalidade...</option>
              {modalidades.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.nome}</option>)}
            </select>
          </div>

          {/* Dias da semana */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Dias da Semana *</label>
            <div className="flex flex-wrap gap-2">
              {DIAS_OPTIONS.map(dia => {
                const sel = turmaForm.dias.includes(dia)
                return (
                  <button key={dia} type="button"
                    onClick={() => setTurmaForm(f => ({ ...f, dias: sel ? f.dias.filter(d => d !== dia) : [...f.dias, dia] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      sel ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-navy-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-600 hover:border-primary-400'
                    }`}>
                    {dia}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Horário + Faixa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Horário *</label>
              <input type="time" value={turmaForm.horario} onChange={e => setTurmaForm(f => ({ ...f, horario: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Faixa Etária</label>
              <select value={turmaForm.faixa} onChange={e => setTurmaForm(f => ({ ...f, faixa: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                {FAIXAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Capacidade + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Capacidade</label>
              <input type="number" min="1" value={turmaForm.capacidade} onChange={e => setTurmaForm(f => ({ ...f, capacidade: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Status</label>
              <select value={turmaForm.status} onChange={e => setTurmaForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>Ativa</option>
                <option>Inativa</option>
              </select>
            </div>
          </div>

          {/* Professor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Professor Responsável</label>
            <select value={turmaForm.professor_id} onChange={e => setTurmaForm(f => ({ ...f, professor_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Sem professor atribuído</option>
              {professores.filter(p => p.cargo === 'professor' || p.cargo === 'coordenador').map(p => (
                <option key={p.id} value={p.id}>{p.nome} ({p.cargo})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setTurmaModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarTurma}
              disabled={savingTurma || !turmaForm.modalidade_id || !turmaForm.horario || turmaForm.dias.length === 0}>
              {savingTurma ? 'Salvando...' : 'Criar Turma'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Nova Viagem */}
      <Modal open={viagemModalOpen} onClose={() => setViagemModalOpen(false)} title="Nova Viagem">
        <div className="space-y-3">
          {viagemTurma && (
            <div className="bg-slate-50 dark:bg-navy-700 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
              {viagemTurma.modalidades?.emoji} {viagemTurma.modalidades?.nome} · Melhor Idade
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Destino *</label>
            <input type="text" value={viagemForm.destino} onChange={e => setViagemForm(f => ({ ...f, destino: e.target.value }))}
              placeholder="Ex: Petrópolis — Parque das Cerejeiras"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data *</label>
              <input type="date" value={viagemForm.data} onChange={e => setViagemForm(f => ({ ...f, data: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Vagas</label>
              <input type="number" min="1" value={viagemForm.vagas} onChange={e => setViagemForm(f => ({ ...f, vagas: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setViagemModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarViagem} disabled={savingViagem || !viagemForm.destino || !viagemForm.data}>
              {savingViagem ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Novo Aluno (direto do polo) */}
      <Modal open={novoAlunoOpen} onClose={() => setNovoAlunoOpen(false)} title="Novo Aluno" size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nome <span className="text-red-400">*</span></label>
            <input type="text" value={novoAlunoForm.nome}
              onChange={e => setNovoAlunoForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Nome completo"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data de Nascimento</label>
              <input type="date" value={novoAlunoForm.data_nasc}
                onChange={e => setNovoAlunoForm(f => ({ ...f, data_nasc: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">CPF</label>
              <input type="text" value={novoAlunoForm.cpf}
                onChange={e => setNovoAlunoForm(f => ({ ...f, cpf: e.target.value }))}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Telefone</label>
              <input type="text" value={novoAlunoForm.telefone}
                onChange={e => setNovoAlunoForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tel. Emergência</label>
              <input type="text" value={novoAlunoForm.telefone_emergencia}
                onChange={e => setNovoAlunoForm(f => ({ ...f, telefone_emergencia: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">E-mail</label>
              <input type="email" value={novoAlunoForm.email}
                onChange={e => setNovoAlunoForm(f => ({ ...f, email: e.target.value }))}
                placeholder="aluno@email.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Status</label>
              <select value={novoAlunoForm.status}
                onChange={e => setNovoAlunoForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>Ativo</option>
                <option>Inativo</option>
                <option>Transferido</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Turma (neste polo)</label>
            <select value={novoAlunoForm.turma_id}
              onChange={e => setNovoAlunoForm(f => ({ ...f, turma_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Sem turma</option>
              {turmasPolo.map(t => (
                <option key={t.id} value={t.id}>
                  {[t.modalidades?.nome, t.faixa, t.dias?.join(','), t.horario?.slice(0,5)].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setNovoAlunoOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarNovoAluno} disabled={savingAluno || !novoAlunoForm.nome.trim()}>
              {savingAluno ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// src/pages/AlunoDetalhe.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, User, Stethoscope,
  Plus, Paperclip, CheckCircle2, Circle, Clock, Pencil, Trash2, CalendarClock
} from 'lucide-react'

function calcIdade(dataNasc) {
  if (!dataNasc) return null
  return new Date().getFullYear() - new Date(dataNasc).getFullYear()
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function getStatusAtestado(dataValidade) {
  const hoje = new Date()
  const val = new Date(dataValidade)
  const em30 = new Date(); em30.setDate(hoje.getDate() + 30)
  if (val < hoje) return { label: 'Vencido', color: 'red' }
  if (val <= em30) return { label: 'Vencendo', color: 'amber' }
  return { label: 'Válido', color: 'green' }
}

async function uploadArquivo(file) {
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('atestados').upload(filename, file)
  if (error) throw error
  const { data } = supabase.storage.from('atestados').getPublicUrl(filename)
  return data.publicUrl
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

const EMPTY_AT = { data_emissao: '', data_validade: '', observacao: '', arquivo_url: '' }
const EMPTY_JUST = { data_inicio: '', data_fim: '', motivo: '' }

export default function AlunoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin, isCoordenador, isProfessor } = useAuth()
  const canEdit = isAdmin || isCoordenador || isProfessor

  const [tab, setTab] = useState('perfil')
  const [aluno, setAluno] = useState(null)
  const [loading, setLoading] = useState(true)

  const [atestados, setAtestados] = useState([])
  const [presencas, setPresencas] = useState([])
  const [loadingAt, setLoadingAt] = useState(true)

  // Atestado modal
  const [atModalOpen, setAtModalOpen] = useState(false)
  const [editingAt, setEditingAt] = useState(null)
  const [atForm, setAtForm] = useState(EMPTY_AT)
  const [arquivo, setArquivo] = useState(null)
  const [savingAt, setSavingAt] = useState(false)
  const [deletandoAt, setDeletandoAt] = useState(null)
  const fileRef = useRef(null)

  // Justificativas de ausência antecipada
  const [justificativas, setJustificativas] = useState([])
  const [loadingJust, setLoadingJust] = useState(true)
  const [justModalOpen, setJustModalOpen] = useState(false)
  const [editingJust, setEditingJust] = useState(null)
  const [justForm, setJustForm] = useState(EMPTY_JUST)
  const [savingJust, setSavingJust] = useState(false)
  const [deletandoJust, setDeletandoJust] = useState(null)

  // Load aluno
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('alunos')
        .select('*, turmas(*, modalidades(nome,emoji), polos(nome), profiles(nome))')
        .eq('id', id)
        .single()
      setAluno(data)
      setLoading(false)
    }
    if (id) load()
  }, [id])

  // Load atestados + presencas
  useEffect(() => {
    async function loadAt() {
      setLoadingAt(true)
      const [{ data: at }, { data: pr }] = await Promise.all([
        supabase.from('atestados').select('*').eq('aluno_id', id).order('data_validade', { ascending: false }),
        supabase.from('presencas').select('*').eq('aluno_id', id).order('data', { ascending: false }).limit(90),
      ])
      setAtestados(at ?? [])
      setPresencas(pr ?? [])
      setLoadingAt(false)
    }
    if (id) loadAt()
  }, [id])

  async function salvarAtestado() {
    setSavingAt(true)
    let arquivo_url = atForm.arquivo_url
    if (arquivo) {
      try { arquivo_url = await uploadArquivo(arquivo) } catch {}
    }
    const payload = {
      aluno_id: id,
      data_emissao: atForm.data_emissao || null,
      data_validade: atForm.data_validade,
      observacao: atForm.observacao || null,
      arquivo_url: arquivo_url || null,
    }
    if (editingAt) {
      await supabase.from('atestados').update(payload).eq('id', editingAt.id)
    } else {
      await supabase.from('atestados').insert(payload)
    }
    setSavingAt(false)
    setAtModalOpen(false)
    // reload
    const { data: at } = await supabase.from('atestados').select('*').eq('aluno_id', id).order('data_validade', { ascending: false })
    setAtestados(at ?? [])
  }

  async function deletarAtestado() {
    await supabase.from('atestados').delete().eq('id', deletandoAt.id)
    setDeletandoAt(null)
    const { data: at } = await supabase.from('atestados').select('*').eq('aluno_id', id).order('data_validade', { ascending: false })
    setAtestados(at ?? [])
  }

  // Justificativas de ausência
  async function reloadJustificativas() {
    setLoadingJust(true)
    const { data } = await supabase.from('justificativas_ausencia').select('*').eq('aluno_id', id).order('data_inicio', { ascending: false })
    setJustificativas(data ?? [])
    setLoadingJust(false)
  }
  useEffect(() => { if (id) reloadJustificativas() }, [id])

  function openNewJust() { setJustForm(EMPTY_JUST); setEditingJust(null); setJustModalOpen(true) }
  function openEditJust(j) {
    setJustForm({ data_inicio: j.data_inicio?.slice(0, 10) ?? '', data_fim: j.data_fim?.slice(0, 10) ?? '', motivo: j.motivo ?? '' })
    setEditingJust(j); setJustModalOpen(true)
  }
  async function salvarJustificativa() {
    if (!justForm.data_inicio || !justForm.data_fim || !justForm.motivo.trim()) return
    setSavingJust(true)
    const payload = { aluno_id: id, data_inicio: justForm.data_inicio, data_fim: justForm.data_fim, motivo: justForm.motivo.trim() }
    if (editingJust) {
      await supabase.from('justificativas_ausencia').update(payload).eq('id', editingJust.id)
    } else {
      await supabase.from('justificativas_ausencia').insert(payload)
    }
    setSavingJust(false)
    setJustModalOpen(false)
    reloadJustificativas()
  }
  async function deletarJustificativa() {
    await supabase.from('justificativas_ausencia').delete().eq('id', deletandoJust.id)
    setDeletandoJust(null)
    reloadJustificativas()
  }

  function openNewAt() {
    setAtForm(EMPTY_AT); setArquivo(null); setEditingAt(null); setAtModalOpen(true)
  }
  function openEditAt(a) {
    setAtForm({
      data_emissao: a.data_emissao?.slice(0, 10) ?? '',
      data_validade: a.data_validade?.slice(0, 10) ?? '',
      observacao: a.observacao ?? '',
      arquivo_url: a.arquivo_url ?? ''
    })
    setArquivo(null); setEditingAt(a); setAtModalOpen(true)
  }

  // Frequência: group presencas by month
  const freqData = (() => {
    if (!presencas.length) return []
    const grouped = {}
    presencas.forEach(p => {
      const mes = p.data?.slice(0, 7) // YYYY-MM
      if (!mes) return
      if (!grouped[mes]) grouped[mes] = { presentes: 0, faltas: 0 }
      if (p.status === 'presente' || p.status === 'justificado') grouped[mes].presentes++
      else grouped[mes].faltas++
    })
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6).map(([mes, v]) => {
      const [y, m] = mes.split('-')
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      const total = v.presentes + v.faltas
      return { label: `${meses[parseInt(m)-1]}/${y.slice(2)}`, ...v, pct: total ? Math.round(v.presentes / total * 100) : 0 }
    })
  })()

  const freqGeral = presencas.length
    ? Math.round((presencas.filter(p => p.status === 'presente' || p.status === 'justificado').length / presencas.length) * 100)
    : 0

  const idade = calcIdade(aluno?.data_nasc)
  const isMelhorIdade = idade !== null && idade >= 60

  if (loading) return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Aluno" action={<button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-slate-500"><ArrowLeft size={13}/> Voltar</button>}/>
      <div className="flex-1 flex items-center justify-center"><p className="text-sm text-slate-400">Carregando...</p></div>
    </div>
  )

  if (!aluno) return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Aluno não encontrado" action={<button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-slate-500"><ArrowLeft size={13}/> Voltar</button>}/>
      <div className="flex-1 flex items-center justify-center"><p className="text-sm text-slate-400">Aluno não encontrado.</p></div>
    </div>
  )

  const turma = aluno.turmas
  const statusColor = aluno.status === 'Ativo' ? 'green' : aluno.status === 'Transferido' ? 'amber' : 'red'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={aluno.nome}
        action={
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <ArrowLeft size={13}/> Voltar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">
        {/* Card de perfil */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {aluno.foto_url ? (
              <img src={aluno.foto_url} alt={aluno.nome} className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-navy-600 flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-2xl font-bold">{aluno.nome?.charAt(0)?.toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-base font-bold text-navy-900 dark:text-white">{aluno.nome}</p>
                <Badge color={statusColor}>{aluno.status}</Badge>
                {isMelhorIdade && <Badge color="purple">⭐ Melhor Idade</Badge>}
              </div>
              {turma && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {turma.modalidades?.emoji} {turma.modalidades?.nome} · {turma.polos?.nome}
                </p>
              )}
              {turma?.profiles && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Prof. {turma.profiles.nome}</p>
              )}
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl overflow-x-auto w-full md:w-fit">
          <TabBtn active={tab === 'perfil'} onClick={() => setTab('perfil')}>👤 Perfil</TabBtn>
          <TabBtn active={tab === 'frequencia'} onClick={() => setTab('frequencia')}>📊 Frequência</TabBtn>
          <TabBtn active={tab === 'justificativas'} onClick={() => setTab('justificativas')}>📅 Justificativas</TabBtn>
          {isMelhorIdade && (
            <TabBtn active={tab === 'atestados'} onClick={() => setTab('atestados')}>🏥 Atestados</TabBtn>
          )}
        </div>

        {/* ─── PERFIL ────────────────────────────────────────────── */}
        {tab === 'perfil' && (
          <div className="space-y-3">
            {/* Dados pessoais */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Dados Pessoais</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Calendar, label: 'Nascimento', value: formatDate(aluno.data_nasc) + (idade ? ` · ${idade} anos` : '') },
                  { icon: User, label: 'CPF', value: aluno.cpf ?? '—' },
                  { icon: Phone, label: 'Telefone', value: aluno.telefone ?? '—' },
                  { icon: Phone, label: 'Tel. Emergência', value: aluno.telefone_emergencia ?? '—' },
                  { icon: Mail, label: 'E-mail', value: aluno.email ?? '—' },
                  { icon: Calendar, label: 'Matrícula', value: formatDate(aluno.data_matricula) },
                  { icon: User, label: 'Status', value: aluno.status },
                  { icon: User, label: 'Gênero', value: aluno.genero === 'M' ? 'Masculino' : aluno.genero === 'F' ? 'Feminino' : aluno.genero === 'Outro' ? 'Outro' : '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2">
                    <Icon size={13} className="text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
                      <p className="text-xs text-navy-900 dark:text-white">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              {aluno.endereco && (
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-navy-700">
                  <MapPin size={13} className="text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Endereço</p>
                    <p className="text-xs text-navy-900 dark:text-white">{aluno.endereco}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Turma */}
            {turma && (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Turma</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{turma.modalidades?.emoji ?? '📚'}</span>
                  <div>
                    <p className="text-xs font-bold text-navy-900 dark:text-white">{turma.modalidades?.nome ?? '—'}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{turma.polos?.nome}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      <Clock size={9}/>{turma.dias?.join(', ')} · {turma.horario?.slice(0,5)} · {turma.faixa}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── FREQUÊNCIA ──────────────────────────────────────────── */}
        {tab === 'frequencia' && (
          <div className="space-y-3">
            {/* Resumo */}
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Freq. Geral</p>
                <p className="text-3xl font-extrabold text-navy-900 dark:text-white">{freqGeral}%</p>
              </div>
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Presenças</p>
                <p className="text-3xl font-extrabold text-primary-600">{presencas.filter(p => p.status === 'presente' || p.status === 'justificado').length}</p>
              </div>
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Faltas</p>
                <p className="text-3xl font-extrabold text-red-400">{presencas.filter(p => p.status === 'falta').length}</p>
              </div>
            </div>

            {/* Por mês */}
            {freqData.length > 0 ? (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Frequência por Mês</p>
                <div className="space-y-2">
                  {freqData.map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-300 mb-1">
                        <span>{m.label}</span>
                        <span className="font-bold">{m.pct}% · {m.presentes}P / {m.faltas}F</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all"
                          style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma presença registrada para este aluno.</p>
              </div>
            )}

            {/* Histórico recente */}
            {presencas.length > 0 && (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Histórico Recente</p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {presencas.slice(0, 30).map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-1">
                      {p.status === 'presente'
                        ? <CheckCircle2 size={14} className="text-primary-600 flex-shrink-0" />
                        : p.status === 'justificado'
                          ? <CheckCircle2 size={14} className="text-amber-500 flex-shrink-0" />
                          : <Circle size={14} className="text-red-400 flex-shrink-0" />}
                      <span className="text-xs text-navy-900 dark:text-white">{formatDate(p.data?.slice(0,10))}</span>
                      <span className={`ml-auto text-[10px] font-semibold ${p.status === 'presente' ? 'text-primary-600' : p.status === 'justificado' ? 'text-amber-500' : 'text-red-400'}`}>
                        {p.status === 'presente' ? 'Presente' : p.status === 'justificado' ? 'Justificado' : 'Falta'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── JUSTIFICATIVAS DE AUSÊNCIA ──────────────────────────── */}
        {tab === 'justificativas' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Faltas Justificadas Antecipadamente</p>
              {canEdit && (
                <Button size="sm" onClick={openNewJust}>
                  <Plus size={13}/> Nova Justificativa
                </Button>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
              Cadastre aqui quando o aluno (ou responsável) avisar com antecedência que vai faltar — por exemplo, viagem, atestado, ou porque também está matriculado em outra turma e só vai numa por dia. A chamada aplica isso automaticamente em todas as turmas do aluno, durante o período informado.
            </div>

            {loadingJust ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : justificativas.length === 0 ? (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
                <CalendarClock size={28} className="text-slate-200 dark:text-navy-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma justificativa cadastrada.</p>
                {canEdit && <Button size="sm" className="mt-3" onClick={openNewJust}><Plus size={13}/> Adicionar Justificativa</Button>}
              </div>
            ) : (
              <div className="space-y-2">
                {justificativas.map(j => {
                  const hoje = new Date().toISOString().slice(0, 10)
                  const ativa = j.data_inicio <= hoje && hoje <= j.data_fim
                  return (
                    <div key={j.id} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-start gap-3">
                      <CalendarClock size={16} className="text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge color={ativa ? 'amber' : 'gray'}>{ativa ? 'Ativa hoje' : j.data_fim < hoje ? 'Encerrada' : 'Futura'}</Badge>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {formatDate(j.data_inicio?.slice(0,10))}{j.data_fim !== j.data_inicio ? ` até ${formatDate(j.data_fim?.slice(0,10))}` : ''}
                          </span>
                        </div>
                        <p className="text-xs text-navy-900 dark:text-white">{j.motivo}</p>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEditJust(j)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400 hover:text-slate-600 transition-colors">
                            <Pencil size={13}/>
                          </button>
                          <button onClick={() => setDeletandoJust(j)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── ATESTADOS ───────────────────────────────────────────── */}
        {tab === 'atestados' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                {isMelhorIdade ? 'Atestado de Autorização — Melhor Idade' : 'Atestados Médicos'}
              </p>
              {canEdit && (
                <Button size="sm" onClick={openNewAt}>
                  <Plus size={13}/> Novo Atestado
                </Button>
              )}
            </div>

            {isMelhorIdade && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl px-4 py-3 text-xs text-purple-800 dark:text-purple-300">
                ⭐ Este aluno tem {idade} anos. Para participar das atividades de Melhor Idade e viagens, é necessário atestado médico válido autorizando a prática de atividade física.
              </div>
            )}

            {loadingAt ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : atestados.length === 0 ? (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
                <Stethoscope size={28} className="text-slate-200 dark:text-navy-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum atestado cadastrado.</p>
                {canEdit && <Button size="sm" className="mt-3" onClick={openNewAt}><Plus size={13}/> Adicionar Atestado</Button>}
              </div>
            ) : (
              <div className="space-y-2">
                {atestados.map(a => {
                  const st = getStatusAtestado(a.data_validade)
                  return (
                    <div key={a.id} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-start gap-3">
                      <Stethoscope size={16} className="text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge color={st.color}>{st.label}</Badge>
                          {a.arquivo_url && (
                            <a href={a.arquivo_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] text-primary-600 hover:text-primary-700">
                              <Paperclip size={10}/> Ver arquivo
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          {a.data_emissao && <span>Emissão: {formatDate(a.data_emissao)}</span>}
                          <span>Validade: {formatDate(a.data_validade)}</span>
                        </div>
                        {a.observacao && <p className="text-[10px] text-slate-400 mt-1">{a.observacao}</p>}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEditAt(a)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400 hover:text-slate-600 transition-colors">
                            <Pencil size={13}/>
                          </button>
                          <button onClick={() => setDeletandoAt(a)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Atestado */}
      <Modal open={atModalOpen} onClose={() => setAtModalOpen(false)} title={editingAt ? 'Editar Atestado' : 'Novo Atestado'}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data de Emissão</label>
              <input type="date" value={atForm.data_emissao} onChange={e => setAtForm(f => ({ ...f, data_emissao: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Validade *</label>
              <input type="date" value={atForm.data_validade} onChange={e => setAtForm(f => ({ ...f, data_validade: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Observação</label>
            <textarea value={atForm.observacao} onChange={e => setAtForm(f => ({ ...f, observacao: e.target.value }))}
              rows={2} placeholder="Restrições, tipo de atestado..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Arquivo (PDF ou imagem)</label>
            <div className="flex items-center gap-2">
              <input type="text" value={arquivo?.name ?? atForm.arquivo_url ?? ''} readOnly placeholder="Nenhum arquivo selecionado"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-slate-50 dark:bg-navy-700/50 text-slate-500 cursor-default" />
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip size={13}/> Escolher
              </Button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setAtModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarAtestado} disabled={savingAt || !atForm.data_validade}>
              {savingAt ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletandoAt} onClose={() => setDeletandoAt(null)} onConfirm={deletarAtestado}
        title="Excluir Atestado" description="Excluir este atestado permanentemente?" />

      {/* Modal Justificativa de Ausência */}
      <Modal open={justModalOpen} onClose={() => setJustModalOpen(false)} title={editingJust ? 'Editar Justificativa' : 'Nova Justificativa'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">De *</label>
              <input type="date" value={justForm.data_inicio} onChange={e => setJustForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Até *</label>
              <input type="date" value={justForm.data_fim} onChange={e => setJustForm(f => ({ ...f, data_fim: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Motivo *</label>
            <input type="text" value={justForm.motivo} onChange={e => setJustForm(f => ({ ...f, motivo: e.target.value }))}
              placeholder="Ex: viagem em família, atestado médico…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setJustModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarJustificativa} disabled={savingJust || !justForm.data_inicio || !justForm.data_fim || !justForm.motivo.trim()}>
              {savingJust ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletandoJust} onClose={() => setDeletandoJust(null)} onConfirm={deletarJustificativa}
        title="Excluir Justificativa" description="Excluir esta justificativa? A chamada volta a não marcar automaticamente para este período." />
    </div>
  )
}

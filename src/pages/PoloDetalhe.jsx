// src/pages/PoloDetalhe.jsx
import { logAcao } from '../lib/auditLog'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useToast } from '../components/ui/Toast'
import { useParams, useNavigate } from 'react-router-dom'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { supabase, supabaseAdmin } from '../lib/supabase'
import Topbar from '../components/Topbar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import {
  ArrowLeft, MapPin, Users, BookOpen, Clock, Stethoscope,
  TrendingUp, UserCheck, CheckCircle2, Circle, Camera,
  Bus, Star, Save, ChevronRight, Trophy, Plus, UserPlus,
  Pencil, Trash2, Search, Filter, Upload, X, Eye
} from 'lucide-react'
import { NovoFuncionarioModal, EditarFuncionarioModal, salvarVinculos } from './Equipes'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ─── helpers ─────────────────────────────────────────────────────────────────
const DIAS_JS = { 'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }
const CARGO_COLORS = { professor: 'amber', coordenador: 'blue', estagiario: 'purple', admin: 'green' }
const CARGO_LABELS = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }
const DIAS_OPTIONS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const FAIXAS = ['Infantil', 'Adulto', 'Melhor Idade']
const EMPTY_TURMA_FORM = { modalidade_id: '', professores_ids: [], dias: [], horario: '', duracao_min: 60, faixa: 'Infantil', faixa_etaria: '', capacidade: 20, status: 'Ativa' }
const DURACAO_OPTIONS = [30, 45, 60, 75, 90, 105, 120]

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
function AulaModal({ turma, alunos, presencas, registros, open, onClose, onSaved, adminMode = false }) {
  const { profile } = useAuth()
  const [presencaMap, setPresencaMap] = useState({})
  const [registro, setRegistro] = useState({ conteudo: '', ocorrencias: '' })
  const [fotos, setFotos] = useState([])
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)   // { tipo: 'sucesso'|'erro', texto: string }
  const [buscaPresenca, setBuscaPresenca] = useState('')
  const { showToast: showAulaToast, toastEl: aulaToastEl } = useToast()

  // Chamada — controla se a aula foi iniciada (libera lista de presença)
  const [chamada, setChamada] = useState(null)      // null = não existe | objeto = criada
  const [carregandoChamada, setCarregandoChamada] = useState(false)
  const [iniciando, setIniciando] = useState(false)

  const dataHoje = new Date().toISOString().split('T')[0]

  // Janela de presença:
  // - Disponível a partir de 10min antes do início até qualquer hora do mesmo dia
  // - Nunca bloqueia no meio do dia (isLocked desativado)
  // - adminMode ignora a trava de "ainda não disponível"
  const [h, m] = (turma?.horario || '00:00').split(':').map(Number)
  const startMins = h * 60 + m
  const duracaoMin = turma?.duracao_min || 60
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const notYetAvailable = adminMode ? false : nowMins < startMins - 10
  const isLocked = false  // nunca bloqueia no mesmo dia — professor pode registrar até meia-noite

  const alunosTurma = useMemo(() => {
    const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return alunos
      .filter(a => {
        // Vinculado diretamente pela coluna turma_id
        if (a.turma_id === turma?.id) return true
        // Vinculado via tabela aluno_turmas (fallback para dados legados)
        if (Array.isArray(a.aluno_turmas) && a.aluno_turmas.some(at => at.turma_id === turma?.id)) return true
        return false
      })
      .filter(a => {
        if (!buscaPresenca.trim()) return true
        return norm(buscaPresenca).split(/\s+/).filter(Boolean).every(p => norm(a.nome).includes(p))
      })
      // Ativos primeiro, depois inativos/transferidos
      .sort((a, b) => {
        const aAtivo = a.status === 'Ativo' ? 0 : 1
        const bAtivo = b.status === 'Ativo' ? 0 : 1
        return aAtivo - bAtivo || (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
      })
  }, [alunos, turma, buscaPresenca])

  const nomesDuplosTurma = useMemo(() => {
    const nomes = alunosTurma.map(a => (a.nome ?? '').trim().toLowerCase())
    return new Set(nomes.filter((n, _, arr) => arr.filter(x => x === n).length > 1))
  }, [alunosTurma])

  // Carrega chamada existente ao abrir o modal
  useEffect(() => {
    if (!turma || !open) { setChamada(null); return }
    setCarregandoChamada(true)
    supabase.from('chamadas').select('*')
      .eq('turma_id', turma.id).eq('data', dataHoje).maybeSingle()
      .then(({ data }) => { setChamada(data ?? null); setCarregandoChamada(false) })
  }, [turma?.id, open])

  useEffect(() => {
    if (!turma || !open) return
    // Init presença (use existing if any, else default all absent)
    const existentes = presencas.filter(p => p.turma_id === turma.id && p.data === dataHoje)
    const map = {}
    alunosTurma.forEach(a => {
      const ex = existentes.find(p => p.aluno_id === a.id)
      map[a.id] = ex ? ex.status : false
    })
    setPresencaMap(map)

    // Init registro
    const reg = registros.find(r => r.turma_id === turma.id && r.data === dataHoje)
    setRegistro({ conteudo: reg?.conteudo ?? '', ocorrencias: reg?.ocorrencias ?? '' })
    setFotos(reg?.fotos ?? [])
    setSaved(false)
  }, [turma, open])

  // Inicia a aula — cria registro na tabela chamadas
  async function iniciarAula() {
    if (!turma || !profile) return
    setIniciando(true)
    const { data, error } = await supabase.from('chamadas')
      .insert({ turma_id: turma.id, data: dataHoje, iniciada_por: profile.id })
      .select('*').single()
    if (!error && data) {
      setChamada(data)
      logAcao({
        acao: 'iniciar_chamada',
        perfil: profile,
        turma,
        detalhes: `Chamada iniciada às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      })
    } else if (error?.code === '23505') {
      const { data: ex } = await supabase.from('chamadas').select('*')
        .eq('turma_id', turma.id).eq('data', dataHoje).single()
      if (ex) setChamada(ex)
    }
    setIniciando(false)
  }

  async function salvarPresenca() {
    // Re-fetch IDs existentes antes de salvar para evitar sobrescrita concorrente
    const { data: existentes } = await supabase
      .from('presencas')
      .select('id,aluno_id')
      .eq('turma_id', turma.id)
      .eq('data', dataHoje)
    const latestIds = {}
    ;(existentes ?? []).forEach(r => { latestIds[r.aluno_id] = r.id })

    // Converte o valor do map (string|boolean) para o status correto
    const toStatus = (val) => {
      if (val === 'presente' || val === 'justificado') return val
      return val ? 'presente' : 'falta'
    }
    const toUpdate = [], toInsert = []
    Object.entries(presencaMap).forEach(([aluno_id, val]) => {
      const status = toStatus(val)
      if (latestIds[aluno_id]) {
        toUpdate.push({ id: latestIds[aluno_id], status })
      } else {
        toInsert.push({ turma_id: turma.id, aluno_id, data: dataHoje, status })
      }
    })
    const results = await Promise.all([
      ...toUpdate.map(r => supabase.from('presencas').update({ status: r.status }).eq('id', r.id)),
      toInsert.length ? supabase.from('presencas').insert(toInsert) : Promise.resolve(),
    ])
    const firstErr = results.find(r => r?.error)?.error
    if (firstErr) throw firstErr
  }

  async function salvarRegistro() {
    const presentesCount = Object.values(presencaMap).filter(Boolean).length
    const { error } = await supabase.from('registros_aula').upsert({
      turma_id: turma.id,
      data: dataHoje,
      conteudo: registro.conteudo,
      ocorrencias: registro.ocorrencias,
      alunos_presentes: presentesCount,
      professor_id: profile?.id ?? null,
      fotos: fotos.length > 0 ? fotos : null,
    }, { onConflict: 'turma_id,data' })
    if (error) throw error
  }

  async function salvarAula() {
    if (isLocked || notYetAvailable) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await salvarPresenca()
      await salvarRegistro()

      // Calcula frequência
      const alunosAtivos   = alunosTurma.filter(a => a.status === 'Ativo')
      const totalPresentes = Object.values(presencaMap).filter(v => v === 'presente' || v === true).length
      const totalJustif    = Object.values(presencaMap).filter(v => v === 'justificado').length
      const totalAtivos    = alunosAtivos.length
      const freq = totalAtivos > 0
        ? Math.round(((totalPresentes + totalJustif) / totalAtivos) * 100) : 0
      const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      if (chamada?.id) {
        const { data: updChamada } = await supabase.from('chamadas')
          .update({ frequencia_pct: freq, total_presentes: totalPresentes, total_alunos: totalAtivos })
          .eq('id', chamada.id).select('*').single()
        if (updChamada) setChamada(updChamada)
      }

      logAcao({
        acao: 'registro_presenca',
        perfil: profile,
        turma,
        detalhes: `${totalPresentes}P ${totalJustif > 0 ? totalJustif + 'J ' : ''}/ ${totalAtivos} — ${freq}% · ${dataHoje} · ${agora}`,
      })

      setSaving(false)
      setSaved(true)
      setSaveMsg({
        tipo: 'sucesso',
        texto: `✅ Presença salva às ${agora} — ${totalPresentes} presente${totalPresentes !== 1 ? 's' : ''} · ${freq}% de frequência`,
      })
      onSaved?.()
      setTimeout(() => setSaved(false), 3000)
    } catch (erro) {
      setSaving(false)
      // Mensagem amigável — sem linguagem técnica
      let msgAmigavel = 'Não conseguimos salvar. Verifique sua internet e tente de novo.'
      if (erro?.code === '42501') {
        msgAmigavel = 'Você não tem acesso para registrar presença nessa turma. Fale com seu coordenador para verificar seu vínculo.'
      } else if (erro?.code === '23505' || erro?.message?.includes('unique')) {
        msgAmigavel = 'Já existe um registro de presença para essa aula hoje. Se precisar corrigir, use a página de Presença.'
      } else if (erro?.code?.startsWith('PGRST') || erro?.message?.includes('network') || erro?.message?.includes('fetch')) {
        msgAmigavel = 'Problema de conexão com o servidor. Verifique sua internet e tente novamente.'
      } else if (erro?.message) {
        msgAmigavel = `Não foi possível salvar. Tente de novo. Se o problema continuar, avise o Pedro. (Detalhe: ${erro.message.slice(0, 60)})`
      }
      setSaveMsg({ tipo: 'erro', texto: msgAmigavel })
      logAcao({
        acao: 'registro_presenca',
        perfil: profile,
        turma,
        detalhes: `ERRO · ${dataHoje} · ${erro?.code ?? ''} · ${erro?.message?.slice(0, 100) ?? 'desconhecido'}`,
      })
    }
  }

  async function handleFotoUpload(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadingFoto(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('registros-aula').upload(filename, file)
      if (!error) {
        const { data } = supabase.storage.from('registros-aula').getPublicUrl(filename)
        setFotos(f => [...f, data.publicUrl])
      }
    }
    setUploadingFoto(false)
    e.target.value = ''
  }

  const presentes = Object.values(presencaMap).filter(v => v === 'presente' || v === true).length
  const justificados = Object.values(presencaMap).filter(v => v === 'justificado').length
  const total = alunosTurma.length

  if (!turma) return null
  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={`${turma.modalidades?.emoji ?? '📚'} ${turma.modalidades?.nome ?? 'Turma'} · ${turma.dias?.join(', ') ?? ''} · ${turma.horario?.slice(0,5) ?? ''}`}
    >
      {aulaToastEl}
      <div className="space-y-4">
        {/* Banner modo admin/teste */}
        {adminMode && (
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-2 text-xs text-violet-700 dark:text-violet-300 font-medium flex items-center gap-2">
            <Eye size={12}/> Modo admin — trava de horário desativada para teste
          </div>
        )}
        {/* Banners de disponibilidade */}
        {notYetAvailable && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
            🕐 Lista de presença disponível a partir de {String(Math.floor((startMins - 10) / 60)).padStart(2,'0')}:{String((startMins - 10) % 60).padStart(2,'0')} (10 min antes do início).
          </div>
        )}
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
                <div key={i} className="relative group">
                  <img src={url} alt={`foto-${i}`} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-navy-600" />
                  <button
                    onClick={() => setFotos(f => f.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {!isLocked && (
                <div className="flex gap-2">
                  <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition-colors ${uploadingFoto ? 'opacity-50' : ''}`}>
                    <Camera size={16} className="text-slate-400 mb-0.5" />
                    <span className="text-[9px] text-slate-400">{uploadingFoto ? '...' : 'Câmera'}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} disabled={uploadingFoto} />
                  </label>
                  <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-primary-200 dark:border-primary-800 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition-colors ${uploadingFoto ? 'opacity-50' : ''}`}>
                    <span className="text-xl">🖼️</span>
                    <span className="text-[9px] text-slate-400">Galeria</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFotoUpload} disabled={uploadingFoto} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Divisor: Lista de Presença ── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-navy-600" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Lista de Presença</span>
              {chamada && <span className="text-[10px] font-semibold text-primary-600">{presentes + justificados} freq. ({presentes}P {justificados > 0 ? `${justificados}J ` : ''}/ {total})</span>}
            </div>
            <div className="flex-1 h-px bg-slate-200 dark:bg-navy-600" />
          </div>

          {/* ── Estado: carregando chamada ── */}
          {carregandoChamada ? (
            <div className="py-4 text-center text-xs text-slate-400">Verificando chamada…</div>

          /* ── Estado: chamada NÃO iniciada → mostrar botão Iniciar Aula ── */
          ) : !chamada && !isLocked ? (
            <div className="flex flex-col items-center gap-3 py-6 bg-slate-50 dark:bg-navy-900/30 rounded-xl border border-slate-200 dark:border-navy-700">
              <div className="text-3xl">▶️</div>
              <div className="text-center">
                <p className="text-sm font-bold text-navy-900 dark:text-white">Iniciar Aula</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                  Clique em <strong>Iniciar Aula</strong> para liberar a lista de presença.<br/>
                  Se não houver aula hoje, não inicie — os alunos não ficam com falta.
                </p>
              </div>
              <Button size="sm" onClick={iniciarAula} disabled={iniciando || notYetAvailable}>
                {iniciando ? 'Iniciando…' : '▶ Iniciar Aula'}
              </Button>
              {notYetAvailable && (
                <p className="text-[10px] text-slate-400">
                  Disponível às {String(Math.floor((startMins - 10) / 60)).padStart(2,'0')}:{String((startMins - 10) % 60).padStart(2,'0')}
                </p>
              )}
            </div>

          /* ── Estado: aula iniciada → mostrar lista editável ── */
          ) : chamada ? (
            <>
              {/* Banner: aula iniciada */}
              <div className="mb-3 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg text-xs text-primary-700 dark:text-primary-400 font-medium flex items-center gap-2">
                <CheckCircle2 size={12} />
                Aula iniciada às {new Date(chamada.iniciada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {chamada.frequencia_pct != null && ` · ${chamada.frequencia_pct}% frequência`}
              </div>

              {/* Legenda de cores */}
              <div className="mb-2 flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-primary-600"/>Presente</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-amber-500"/>Justificada</span>
                <span className="flex items-center gap-1"><Circle size={11} className="text-red-400"/>Falta</span>
                <span className="ml-auto text-[9px] text-slate-400">Toque para alternar →</span>
              </div>

              <div className="flex gap-2 mb-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Buscar aluno..."
                  value={buscaPresenca}
                  onChange={e => setBuscaPresenca(e.target.value)}
                  className="flex-1 min-w-32 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button onClick={() => setPresencaMap(m => Object.fromEntries(Object.keys(m).map(k => [k, 'presente'])))}
                  className="text-[10px] font-semibold text-primary-600 hover:text-primary-700 px-2 py-0.5 rounded border border-primary-200 dark:border-primary-700">Todos</button>
                <button onClick={() => setPresencaMap(m => Object.fromEntries(Object.keys(m).map(k => [k, false])))}
                  className="text-[10px] font-semibold text-red-500 hover:text-red-600 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">Nenhum</button>
              </div>

              {alunosTurma.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">{buscaPresenca ? 'Nenhum aluno encontrado.' : 'Nenhum aluno nesta turma.'}</div>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {alunosTurma.map(a => {
                    const ativo = a.status === 'Ativo'
                    if (!ativo) {
                      return (
                        <div key={a.id} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 opacity-60">
                          <Circle size={16} className="text-slate-300 flex-shrink-0" />
                          <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-navy-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[9px] font-bold">{a.nome?.charAt(0)}</span>
                          </div>
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 text-left flex-1 truncate">
                            {a.nome}
                            {nomesDuplosTurma.has((a.nome ?? '').trim().toLowerCase()) && (
                              <span className="ml-1 text-[9px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded">⚠️ repetido</span>
                            )}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                            a.status === 'Transferido'
                              ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400'
                              : 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-navy-700 dark:border-navy-600 dark:text-slate-400'
                          }`}>{a.status}</span>
                        </div>
                      )
                    }
                    const val = presencaMap[a.id]
                    const isPresente = val === 'presente' || val === true
                    const isJustificado = val === 'justificado'
                    // Ciclo 3 estados: falta → presente → justificado → falta
                    const nextVal = isJustificado ? false : isPresente ? 'justificado' : 'presente'
                    return (
                      <button
                        key={a.id}
                        disabled={isLocked}
                        onClick={() => setPresencaMap(m => ({ ...m, [a.id]: nextVal }))}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isJustificado
                            ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700'
                            : isPresente
                            ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700'
                            : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800'
                        }`}
                      >
                        {isJustificado
                          ? <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />
                          : isPresente
                          ? <CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" />
                          : <Circle size={16} className="text-red-400 flex-shrink-0" />}
                        <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[9px] font-bold">{a.nome?.charAt(0)}</span>
                        </div>
                        <span className="text-xs font-medium text-navy-900 dark:text-white text-left flex-1">
                          {a.nome}
                          {nomesDuplosTurma.has((a.nome ?? '').trim().toLowerCase()) && (
                            <span className="ml-1 text-[9px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded">⚠️ repetido</span>
                          )}
                        </span>
                        <span className={`text-[10px] font-semibold ${isJustificado ? 'text-amber-500' : isPresente ? 'text-primary-600' : 'text-red-400'}`}>
                          {isJustificado ? 'Justificada' : isPresente ? 'Presente' : 'Falta'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Aviso: aula encerrada mas sem presença registrada */}
        {!chamada && !carregandoChamada && nowMins > startMins + (turma?.duracao_min || 60) + 30 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Presença não registrada!</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                A aula já encerrou. Clique em <strong>Iniciar Aula</strong> acima e faça a chamada antes de sair.
                Você tem até meia-noite de hoje para registrar.
              </p>
            </div>
          </div>
        )}

        {/* Mensagem de sucesso ou erro após salvar */}
        {saveMsg && (
          <div className={`rounded-lg px-3 py-2.5 text-xs font-medium flex items-start gap-2 ${
            saveMsg.tipo === 'sucesso'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
          }`}>
            <span className="text-base flex-shrink-0">{saveMsg.tipo === 'sucesso' ? '✅' : '❌'}</span>
            <span>{saveMsg.texto}</span>
          </div>
        )}

        {/* Botão Salvar — só aparece após iniciar aula */}
        {!isLocked && chamada && (
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={salvarAula} disabled={saving}>
              {saved ? <><CheckCircle2 size={13}/> Salvo!</> : saving ? 'Salvando...' : <><Save size={13}/> Registrar Aula</>}
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
  const { isAdmin, isCoordenador, isProfessor, isEstagiario, profile } = useAuth()
  const { offline, pending, addToQueue } = useOfflineQueue()
  const { showToast, toastEl } = useToast()

  const [tab, setTab] = useState('geral')
  const [aulaOpen, setAulaOpen] = useState(null)

  const { data: polos } = useSupabaseData('polos', '*')
  const { data: turmas, reload: reloadTurmas, loading: loadingTurmas } = useSupabaseData('turmas', '*, modalidades(nome,emoji), profiles(id,nome,cargo), polos(nome)')
  const { data: alunos, reload: reloadAlunos } = useSupabaseData('alunos', 'id,nome,status,turma_id,data_nasc,data_matricula,cpf,telefone,telefone_emergencia,email,genero,foto_url,aluno_turmas(turma_id)')
  // Busca apenas os últimos 90 dias para evitar o limite de 10k linhas do hook genérico
  const [presencas, setPresencas] = useState([])
  const carregarHistoricoCompleto = useCallback(async (turmaIdsArr) => {
    if (!turmaIdsArr || turmaIdsArr.length === 0) return
    setLoadingHist(true)
    const { data } = await supabase
      .from('presencas')
      .select('id,data,status,turma_id,aluno_id')
      .in('turma_id', turmaIdsArr)
    setPresencasHist(data ?? [])
    setLoadingHist(false)
  }, [])

  const reloadPresencas = useCallback(async () => {
    const since = format(subDays(new Date(), 90), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('presencas')
      .select('id,data,status,turma_id,aluno_id')
      .gte('data', since)
      .order('data', { ascending: false })
      .limit(50000)
    setPresencas(data ?? [])
  }, [])
  useEffect(() => { reloadPresencas() }, [reloadPresencas])
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')
  const { data: viagens, reload: reloadViagens } = useSupabaseData('viagens', '*, turmas(*, modalidades(nome,emoji))')
  const { data: modalidades } = useSupabaseData('modalidades', 'id,nome,emoji')
  const { data: professores, reload: reloadProfessores } = useSupabaseData('profiles', 'id,nome,cargo,telefone,email')
  const { data: atribuicoes, loading: loadingAtribuicoes, reload: reloadAtribuicoes } = useSupabaseData('atribuicoes', 'id,usuario_id,polo_id,turma_id,cargo')
  const [registros, setRegistros] = useState([])
  const reloadRegistros = useCallback(async () => {
    const since = format(subDays(new Date(), 180), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('registros_aula')
      .select('id,turma_id,data,conteudo,ocorrencias,alunos_presentes')
      .gte('data', since)
      .order('data', { ascending: false })
      .limit(20000)
    setRegistros(data ?? [])
  }, [])
  useEffect(() => { reloadRegistros() }, [reloadRegistros])

  // Nova / editar turma form
  const [turmaModalOpen, setTurmaModalOpen] = useState(false)
  const [turmaForm, setTurmaForm] = useState(EMPTY_TURMA_FORM)
  const [editTurmaId, setEditTurmaId] = useState(null)
  const [savingTurma, setSavingTurma] = useState(false)
  const [deleteTurmaTarget, setDeleteTurmaTarget] = useState(null)
  const [deletingTurma, setDeletingTurma] = useState(false)

  // Filtros registros de aula
  const [regFiltroTurma, setRegFiltroTurma] = useState('')
  const [regFiltroMod, setRegFiltroMod] = useState('')
  const [regFiltroData, setRegFiltroData] = useState('')
  const [regExpandido, setRegExpandido] = useState(false)

  // Modal de atestados
  const [atestadosModalOpen, setAtestadosModalOpen] = useState(false)
  const [atestadosFiltro, setAtestadosFiltro] = useState('vencendo') // 'vencendo' ou 'vencido'

  // Grupos expandidos (modalidade nome) — start collapsed
  const [expandidos, setExpandidos] = useState(new Set())
  function toggleColapso(nome) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
  }

  // Editar funcionário direto do polo
  const EMPTY_FUNC_FORM = { nome: '', cargo: 'professor', telefone: '', email: '', vinculos: [] }
  const [editFuncOpen, setEditFuncOpen] = useState(false)
  const [editFuncMembro, setEditFuncMembro] = useState(null)
  const [editFuncForm, setEditFuncForm] = useState(EMPTY_FUNC_FORM)
  const [editFuncSaving, setEditFuncSaving] = useState(false)

  function openEditFunc(m) {
    const poloMap = {}
    for (const a of atribuicoes.filter(a => a.usuario_id === m.id)) {
      if (!a.polo_id) continue
      if (!poloMap[a.polo_id]) poloMap[a.polo_id] = { polo_id: a.polo_id, turma_ids: [] }
      if (a.turma_id) poloMap[a.polo_id].turma_ids.push(a.turma_id)
    }
    setEditFuncForm({
      nome: m.nome ?? '',
      cargo: m.cargo ?? 'professor',
      telefone: m.telefone ?? '',
      email: m.email ?? '',
      vinculos: Object.values(poloMap),
    })
    setEditFuncMembro(m)
    setEditFuncOpen(true)
  }

  async function handleSaveFunc() {
    if (!editFuncMembro) return
    setEditFuncSaving(true)
    // Usa supabaseAdmin para garantir que cargo seja salvo mesmo com RLS
    const client = supabaseAdmin ?? supabase
    await client.from('profiles').update({
      nome: editFuncForm.nome,
      cargo: editFuncForm.cargo,
      telefone: editFuncForm.telefone || null,
      email: editFuncForm.email || null,
    }).eq('id', editFuncMembro.id)
    if (editFuncForm.email && supabaseAdmin) {
      await supabaseAdmin.auth.admin.updateUserById(editFuncMembro.id, { email: editFuncForm.email })
    }
    await supabase.from('turmas').update({ professor_id: null }).eq('professor_id', editFuncMembro.id)
    await supabase.from('atribuicoes').delete().eq('usuario_id', editFuncMembro.id)
    await salvarVinculos(editFuncMembro.id, editFuncForm.cargo, editFuncForm.vinculos ?? [])
    setEditFuncSaving(false)
    setEditFuncOpen(false)
    reloadTurmas()
    reloadAtribuicoes()
    reloadProfessores()
  }

  function getAllowedCargos() {
    const cargo = profile?.cargo
    if (cargo === 'admin') return ['admin', 'coordenador', 'professor', 'estagiario']
    if (cargo === 'coordenador') return ['coordenador', 'professor', 'estagiario']
    if (cargo === 'professor') return ['professor', 'estagiario']
    return ['professor']
  }

  // Viagem form
  const [viagemModalOpen, setViagemModalOpen] = useState(false)
  const [viagemTurma, setViagemTurma] = useState(null)
  const [viagemForm, setViagemForm] = useState({ destino: '', data: '', vagas: 20 })
  const [savingViagem, setSavingViagem] = useState(false)
  const [editandoViagem, setEditandoViagem] = useState(null)
  const [deletandoViagem, setDeletandoViagem] = useState(null)

  // Novo aluno direto do polo
  const EMPTY_ALUNO = { nome: '', data_nasc: '', cpf: '', telefone: '', telefone_emergencia: '', email: '', status: 'Ativo', turma_id: '', genero: '', foto_url: '', atestado_validade: '', atestado_foto: '' }
  const [novoAlunoOpen, setNovoAlunoOpen] = useState(false)
  const [novoAlunoForm, setNovoAlunoForm] = useState(EMPTY_ALUNO)
  const [novoAlunoMatriculas, setNovoAlunoMatriculas] = useState([{ turma_id: '' }])
  const [novoAlunoErrors, setNovoAlunoErrors] = useState({})
  const [opTab, setOpTab] = useState('hoje')
  const [alunosTab, setAlunosTab] = useState('lista')
  const [presencasHist, setPresencasHist] = useState(null) // null = ainda não carregado
  const [loadingHist, setLoadingHist] = useState(false)
  const [dupWarning, setDupWarning] = useState(null) // { aluno, turma }
  const [savingAluno, setSavingAluno] = useState(false)
  const [novoAlunoError, setNovoAlunoError] = useState('')

  // ── Helpers de validação de aluno ──────────────────────────────
  function normNomeAluno(s) {
    return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  }
  function validateAlunoForm(form) {
    const e = {}
    const nome = (form.nome ?? '').trim()
    if (!nome) e.nome = 'Nome é obrigatório'
    else if (nome.includes('@')) e.nome = 'Parece que há um e-mail no campo Nome — verifique'
    if (!form.turma_id) e.turma_id = 'Selecione uma turma'
    if (form.email?.trim() && !/\S+@\S+\.\S+/.test(form.email.trim()))
      e.email = 'E-mail inválido — pode ser um nome inserido por engano'
    if (form.data_nasc) {
      const nasc = new Date(form.data_nasc + 'T12:00:00')
      const hoje = new Date()
      if (nasc > hoje) e.data_nasc = 'Data de nascimento não pode ser no futuro'
      else if (hoje.getFullYear() - nasc.getFullYear() > 120)
        e.data_nasc = `Verifique o ano ${nasc.getFullYear()} — parece um erro de digitação`
    }
    return e
  }
  const [uploadingFotoAluno, setUploadingFotoAluno] = useState(false)
  const [uploadingAtestadoFoto, setUploadingAtestadoFoto] = useState(false)

  // Novo funcionário direto do polo
  const EMPTY_FUNC = { nome: '', email: '', senha: '', cargo: 'professor', telefone: '', vinculos: [{ polo_id: id, turma_ids: [] }] }
  const [novoFuncOpen, setNovoFuncOpen] = useState(false)
  const [novoFuncForm, setNovoFuncForm] = useState(EMPTY_FUNC)
  const [criandoFunc, setCriandoFunc] = useState(false)
  const [funcError, setFuncError] = useState('')
  const [funcSuccess, setFuncSuccess] = useState(false)

  // Aba Alunos — busca / filtro
  const [alunosBusca, setAlunosBusca] = useState('')
  const [alunosFiltroTurma, setAlunosFiltroTurma] = useState('')
  const [alunosFiltroStatus, setAlunosFiltroStatus] = useState('Ativo')

  // Aba Alunos — editar aluno
  const [editAlunoOpen, setEditAlunoOpen] = useState(false)
  const [editAlunoId, setEditAlunoId] = useState(null)
  const [editAlunoForm, setEditAlunoForm] = useState(EMPTY_ALUNO)
  const [editAlunoMatriculas, setEditAlunoMatriculas] = useState([{ turma_id: '' }])
  const [editAlunoErrors, setEditAlunoErrors] = useState({})
  const [savingEditAluno, setSavingEditAluno] = useState(false)

  // Aba Alunos — excluir aluno
  const [deleteAlunoTarget, setDeleteAlunoTarget] = useState(null)
  const [deletingAluno, setDeletingAluno] = useState(false)

  function openNovoFunc() {
    setNovoFuncForm({ ...EMPTY_FUNC, vinculos: [{ polo_id: id, turma_ids: [] }] })
    setFuncError('')
    setFuncSuccess(false)
    setNovoFuncOpen(true)
  }

  async function handleCreateFunc() {
    if (!novoFuncForm.nome || !novoFuncForm.email || !novoFuncForm.senha) return
    setCriandoFunc(true)
    setFuncError('')

    if (!supabaseAdmin) {
      setFuncError('Configuração admin não disponível.')
      setCriandoFunc(false)
      return
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: novoFuncForm.email,
      password: novoFuncForm.senha,
      email_confirm: true,
      user_metadata: { nome: novoFuncForm.nome },
    })

    if (error || !data?.user) {
      setFuncError(
        error?.message?.includes('already been registered')
          ? 'Este e-mail já está cadastrado.'
          : (error?.message ?? 'Erro ao criar usuário')
      )
      setCriandoFunc(false)
      return
    }

    const userId = data.user.id
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      nome: novoFuncForm.nome,
      cargo: novoFuncForm.cargo,
      telefone: novoFuncForm.telefone || null,
      email: novoFuncForm.email || null,
      ativo: true,
    }, { onConflict: 'id' })

    await salvarVinculos(userId, novoFuncForm.cargo, novoFuncForm.vinculos ?? [])

    setCriandoFunc(false)
    setFuncSuccess(true)
    reloadProfessores()
    setTimeout(() => { setNovoFuncOpen(false); setFuncSuccess(false) }, 1500)
  }

  const polo = polos.find(p => p.id === id)
  // ── Visualizar como (somente admin) ─────────────────────────────────────────
  const [viewAs, setViewAs] = useState(null) // { id, nome, cargo } ou null
  const [viewAsOpen, setViewAsOpen] = useState(false)

  const viewAsTurmaIds = useMemo(() => {
    if (!viewAs) return null
    return new Set(atribuicoes.filter(a => a.usuario_id === viewAs.id && a.turma_id).map(a => a.turma_id))
  }, [viewAs, atribuicoes])

  const turmasPolo = useMemo(() => {
    const base = turmas.filter(t => t.polo_id === id)
    if (!viewAs || !viewAsTurmaIds) return base
    if (viewAs.cargo === 'coordenador') return base // coordenador vê tudo do polo
    return base.filter(t => viewAsTurmaIds.has(t.id))
  }, [turmas, id, viewAs, viewAsTurmaIds])

  // canEditPolo: admin global OU qualquer staff deste polo
  const canEditPolo = useMemo(() => {
    if (isAdmin) return true
    if (!profile || loadingAtribuicoes) return false
    return atribuicoes.some(a => a.usuario_id === profile?.id && a.polo_id === id)
  }, [isAdmin, atribuicoes, loadingAtribuicoes, profile, id])

  const canEditTurma = useMemo(() => (t) => {
    if (isAdmin) return true
    if (!profile) return false
    // coordenador of this polo can edit any turma
    const isCoord = atribuicoes.some(a => a.usuario_id === profile?.id && a.polo_id === id && a.cargo === 'coordenador')
    if (isCoord) return true
    // professor/estagiário can only edit turmas they're assigned to
    return atribuicoes.some(a => a.usuario_id === profile?.id && a.turma_id === t.id)
  }, [isAdmin, atribuicoes, profile, id])

  // canDeleteAluno: admin, coordenador global ou coordenador/professor deste polo
  const canDeleteAluno = useMemo(() => {
    if (isAdmin || isCoordenador) return true
    if (!profile || loadingAtribuicoes) return false
    return atribuicoes.some(a => a.usuario_id === profile.id && a.polo_id === id && (a.cargo === 'coordenador' || a.cargo === 'professor'))
  }, [isAdmin, isCoordenador, atribuicoes, loadingAtribuicoes, profile, id])

  // Acesso ao polo: admin, coordenador global, ou tem qualquer atribuição neste polo, ou professor de alguma turma aqui
  const temAcesso = useMemo(() => {
    if (isAdmin || isCoordenador) return true
    if (!profile || loadingAtribuicoes || loadingTurmas) return true // ainda carregando, aguardar
    if (atribuicoes.some(a => a.usuario_id === profile?.id && a.polo_id === id)) return true
    return turmasPolo.some(t => t.professor_id === profile?.id)
  }, [isAdmin, isCoordenador, atribuicoes, loadingAtribuicoes, loadingTurmas, profile, id, turmasPolo])

  useEffect(() => {
    if (!profile || loadingAtribuicoes || loadingTurmas) return // aguardar carregamento completo
    if (!temAcesso && polos.length > 0) {
      navigate('/polos')
    }
  }, [temAcesso, polos, profile, loadingAtribuicoes, loadingTurmas])

  // Auto-inativação por atestado desativada durante período de cadastro inicial.
  // Os alertas visuais de atestado vencido/vencendo continuam ativos no card de KPIs.

  const turmaIds = useMemo(() => new Set(turmasPolo.map(t => t.id)), [turmasPolo])
  const alunosPolo = useMemo(() => alunos.filter(a =>
    turmaIds.has(a.turma_id) ||
    (Array.isArray(a.aluno_turmas) && a.aluno_turmas.some(at => turmaIds.has(at.turma_id)))
  ), [alunos, turmaIds])
  const alunoIds = useMemo(() => new Set(alunosPolo.map(a => a.id)), [alunosPolo])
  const presencasPolo = useMemo(() => presencas.filter(p => turmaIds.has(p.turma_id)), [presencas, turmaIds])

  const alunosFiltrados = useMemo(() => {
    let lista = alunosPolo
    if (alunosFiltroStatus) lista = lista.filter(a => a.status === alunosFiltroStatus)
    if (alunosFiltroTurma) lista = lista.filter(a => a.turma_id === alunosFiltroTurma)
    if (alunosBusca.trim()) {
      const q = alunosBusca.toLowerCase().trim()
      lista = lista.filter(a => (a.nome ?? '').toLowerCase().includes(q) || (a.cpf ?? '').includes(q) || (a.telefone ?? '').includes(q))
    }
    return lista.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
  }, [alunosPolo, alunosFiltroStatus, alunosFiltroTurma, alunosBusca])
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
    return Math.round((presencasPolo.filter(p => p.status === 'presente' || p.status === 'justificado').length / presencasPolo.length) * 100)
  }, [presencasPolo])
  const melhorIdade = useMemo(() => alunosPolo.filter(a => {
    if (a.status !== 'Ativo' || !a.data_nasc) return false
    return new Date().getFullYear() - new Date(a.data_nasc).getFullYear() >= 60
  }).length, [alunosPolo])
  const alunosNovos = alunosPolo.filter(a => a.status === 'Ativo' && a.data_matricula && new Date(a.data_matricula) >= ha30).length
  const ocupacao = useMemo(() => {
    const cap = turmasPolo.filter(t => t.status === 'Ativa').reduce((s, t) => s + (t.capacidade || 0), 0)
    return cap ? Math.round((alunosAtivos / cap) * 100) : 0
  }, [turmasPolo, alunosAtivos])
  const atestadosVencendo = atestadosPolo.filter(a => {
    const aluno = alunosPolo.find(al => al.id === a.aluno_id)
    if (!aluno || aluno.status !== 'Ativo') return false
    const v = new Date(a.data_validade)
    return v >= hoje && v <= em30
  }).length

  const atestadosVencidos = atestadosPolo.filter(a => {
    const aluno = alunosPolo.find(al => al.id === a.aluno_id)
    if (!aluno || aluno.status !== 'Ativo') return false
    return new Date(a.data_validade) < hoje
  }).length

  // Alunos com atestados vencendo/vencidos (apenas Ativos)
  const alunosComAtestadosProblema = useMemo(() => {
    const filtrados = atestadosFiltro === 'vencendo'
      ? atestadosPolo.filter(a => { const v = new Date(a.data_validade); return v >= hoje && v <= em30 })
      : atestadosPolo.filter(a => new Date(a.data_validade) < hoje)
    return filtrados.map(att => {
      const aluno = alunosPolo.find(a => a.id === att.aluno_id)
      return { aluno, atestado: att }
    }).filter(x => x.aluno && x.aluno.status === 'Ativo').sort((a, b) => (a.aluno.nome || '').localeCompare(b.aluno.nome || '', 'pt-BR'))
  }, [atestadosPolo, alunosPolo, atestadosFiltro, hoje, em30])

  // Gráfico
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const dStr = format(d, 'yyyy-MM-dd')
    const dp = presencasPolo.filter(p => (p.data ?? '').slice(0, 10) === dStr)
    return { dia: format(d, 'EEE', { locale: ptBR }), Presentes: dp.filter(p => p.status === 'presente').length, Faltas: dp.filter(p => p.status === 'falta').length }
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

  // Engajamento — ranking de assiduidade dos alunos ativos do polo
  // Usa histórico completo quando carregado; fallback para 90 dias
  const engajamento = useMemo(() => {
    const fonte = presencasHist ?? presencasPolo
    return alunosPolo
      .filter(a => a.status === 'Ativo')
      .map(a => {
        const pAluno = fonte.filter(p => p.aluno_id === a.id)
        const total = pAluno.length
        const presentes = pAluno.filter(p => p.status === 'presente' || p.status === 'justificado').length
        const freq = total > 0 ? Math.round((presentes / total) * 100) : null
        const ultimaPresente = pAluno
          .filter(p => p.status === 'presente')
          .sort((x, y) => (y.data ?? '').localeCompare(x.data ?? ''))[0]?.data ?? null
        const diasAfastado = ultimaPresente
          ? Math.floor((new Date() - new Date(ultimaPresente + 'T12:00:00')) / (1000 * 60 * 60 * 24))
          : null
        return { ...a, freq, total, presentes, ultimaPresente, diasAfastado }
      })
      .sort((a, b) => {
        if (a.freq === null && b.freq === null) return 0
        if (a.freq === null) return 1
        if (b.freq === null) return -1
        return b.freq - a.freq
      })
  }, [alunosPolo, presencasPolo, presencasHist])

  // Equipe — une professores (via professor_id nas turmas) + staff via atribuicoes
  const equipe = useMemo(() => {
    const seen = new Set(); const lista = []
    // Professores que são professor_id de alguma turma do polo
    turmasPolo.forEach(t => { if (t.profiles && !seen.has(t.profiles.id)) { seen.add(t.profiles.id); lista.push(t.profiles) } })
    // Demais funcionários vinculados via atribuicoes (estagiários, coordenadores, etc.)
    atribuicoes
      .filter(a => a.polo_id === id)
      .forEach(a => {
        if (!seen.has(a.usuario_id)) {
          const prof = professores.find(p => p.id === a.usuario_id)
          if (prof) { seen.add(prof.id); lista.push(prof) }
        }
      })
    return lista.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
  }, [turmasPolo, atribuicoes, professores, id])

  // Operacional — aulas de hoje
  const diaHoje = hoje.getDay()
  const aulasHoje = turmasPolo.filter(t => t.dias?.some(d => DIAS_JS[d] === diaHoje))
  const agoraMins = hoje.getHours() * 60 + hoje.getMinutes()
  // Todas as aulas acontecendo agora (janela: 30min antes até 30min após o término)
  const aulasAgora = aulasHoje.filter(t => {
    if (!t.horario) return false
    const [h, m] = t.horario.split(':').map(Number)
    const tMins = h * 60 + m
    const dur = t.duracao_min || 60
    return agoraMins >= tMins - 30 && agoraMins <= tMins + dur + 30
  }).sort((a, b) => (a.horario ?? '').localeCompare(b.horario ?? ''))
  // Compat: mantém referência única para usos legados
  const aulaAgora = aulasAgora[0] ?? null

  // Turmas Melhor Idade
  const turmasMelhorIdade = turmasPolo.filter(t => t.faixa === 'Melhor Idade')

  // Nova turma
  async function salvarTurma() {
    if (!turmaForm.modalidade_id || !turmaForm.horario || turmaForm.dias.length === 0) return
    setSavingTurma(true)
    const { data: novaTurma } = await supabase.from('turmas').insert({
      polo_id: id,
      modalidade_id: turmaForm.modalidade_id,
      professor_id: turmaForm.professores_ids[0] || null,
      dias: turmaForm.dias,
      horario: turmaForm.horario,
      duracao_min: Number(turmaForm.duracao_min) || 60,
      faixa: turmaForm.faixa,
      faixa_etaria: turmaForm.faixa_etaria || null,
      capacidade: Number(turmaForm.capacidade),
      status: turmaForm.status,
    }).select('id').single()
    // Inserir atribuições para cada professor/estagiário selecionado
    if (novaTurma?.id && turmaForm.professores_ids.length > 0) {
      const prof = professores.filter(p => turmaForm.professores_ids.includes(p.id))
      await supabase.from('atribuicoes').insert(
        prof.map(p => ({
          usuario_id: p.id,
          polo_id: id,
          turma_id: novaTurma.id,
          cargo: p.cargo === 'estagiario' ? 'estagiario' : 'professor',
        }))
      )
    }
    setSavingTurma(false)
    setTurmaModalOpen(false)
    setEditTurmaId(null)
    setTurmaForm(EMPTY_TURMA_FORM)
    reloadTurmas()
  }

  function abrirEditTurma(e, t) {
    e.stopPropagation()
    setEditTurmaId(t.id)
    setTurmaForm({
      modalidade_id: t.modalidade_id ?? '',
      professores_ids: [],
      dias: t.dias ?? [],
      horario: t.horario ?? '',
      duracao_min: t.duracao_min ?? 60,
      faixa: t.faixa ?? 'Infantil',
      faixa_etaria: t.faixa_etaria ?? '',
      capacidade: t.capacidade ?? 20,
      status: t.status ?? 'Ativa',
    })
    setTurmaModalOpen(true)
  }

  async function salvarEditTurma() {
    if (!editTurmaId || !turmaForm.modalidade_id || !turmaForm.horario || turmaForm.dias.length === 0) return
    setSavingTurma(true)
    await supabase.from('turmas').update({
      modalidade_id: turmaForm.modalidade_id,
      professor_id: turmaForm.professores_ids[0] || null,
      dias: turmaForm.dias,
      horario: turmaForm.horario,
      duracao_min: Number(turmaForm.duracao_min) || 60,
      faixa: turmaForm.faixa,
      faixa_etaria: turmaForm.faixa_etaria || null,
      capacidade: Number(turmaForm.capacidade),
      status: turmaForm.status,
    }).eq('id', editTurmaId)
    if (turmaForm.professores_ids.length > 0) {
      await supabase.from('atribuicoes').delete().eq('turma_id', editTurmaId)
      const prof = professores.filter(p => turmaForm.professores_ids.includes(p.id))
      await supabase.from('atribuicoes').insert(
        prof.map(p => ({ usuario_id: p.id, polo_id: id, turma_id: editTurmaId, cargo: p.cargo === 'estagiario' ? 'estagiario' : 'professor' }))
      )
    }
    setSavingTurma(false)
    setTurmaModalOpen(false)
    setEditTurmaId(null)
    setTurmaForm(EMPTY_TURMA_FORM)
    reloadTurmas()
  }

  async function handleDeleteTurma() {
    if (!deleteTurmaTarget) return
    setDeletingTurma(true)
    await supabase.from('atribuicoes').delete().eq('turma_id', deleteTurmaTarget.id)
    await supabase.from('presencas').delete().eq('turma_id', deleteTurmaTarget.id)
    await supabase.from('registros_aula').delete().eq('turma_id', deleteTurmaTarget.id)
    await supabase.from('alunos').update({ turma_id: null }).eq('turma_id', deleteTurmaTarget.id)
    await supabase.from('turmas').delete().eq('id', deleteTurmaTarget.id)
    setDeleteTurmaTarget(null)
    setDeletingTurma(false)
    reloadTurmas()
  }

  // Viagem nova/editar
  async function salvarViagem() {
    if (!viagemForm.destino || !viagemForm.data) return
    setSavingViagem(true)
    if (editandoViagem) {
      await supabase.from('viagens').update({
        destino: viagemForm.destino,
        data: viagemForm.data,
        vagas: Number(viagemForm.vagas),
      }).eq('id', editandoViagem.id)
    } else {
      await supabase.from('viagens').insert({
        destino: viagemForm.destino,
        data: viagemForm.data,
        polo_id: id,
        turma_id: viagemTurma?.id ?? null,
        vagas: Number(viagemForm.vagas),
      })
    }
    setSavingViagem(false)
    setViagemModalOpen(false)
    setViagemForm({ destino: '', data: '', vagas: 20 })
    setEditandoViagem(null)
    reloadViagens()
  }

  // Deletar viagem
  async function deletarViagem() {
    if (!deletandoViagem) return
    await supabase.from('viagens').delete().eq('id', deletandoViagem.id)
    setDeletandoViagem(null)
    reloadViagens()
  }

  function openEditAluno(a) {
    setEditAlunoId(a.id)
    setEditAlunoForm({
      nome: a.nome ?? '',
      data_nasc: a.data_nasc ?? '',
      cpf: a.cpf ?? '',
      telefone: a.telefone ?? '',
      telefone_emergencia: a.telefone_emergencia ?? '',
      email: a.email ?? '',
      status: a.status ?? 'Ativo',
      turma_id: a.turma_id ?? '',
      genero: a.genero ?? '',
      foto_url: a.foto_url ?? '',
      atestado_validade: '',
      atestado_foto: '',
    })
    // Carrega turmas do aluno filtradas a este polo; fallback para turma_id legado
    const turmasPoloIds = new Set(turmasPolo.map(t => t.id))
    const matriculasNestePolo = (a.aluno_turmas ?? []).filter(at => turmasPoloIds.has(at.turma_id))
    setEditAlunoMatriculas(
      matriculasNestePolo.length > 0
        ? matriculasNestePolo.map(at => ({ turma_id: at.turma_id }))
        : [{ turma_id: a.turma_id ?? '' }]
    )
    setEditAlunoErrors({})
    setEditAlunoOpen(true)
  }

  async function salvarEditAluno() {
    const novasMatriculas = editAlunoMatriculas.filter(m => m.turma_id)
    const erros = validateAlunoForm({ ...editAlunoForm, turma_id: novasMatriculas[0]?.turma_id ?? '' })
    setEditAlunoErrors(erros)
    if (Object.keys(erros).length > 0) return
    setSavingEditAluno(true)
    const primeiraTurmaId = novasMatriculas[0]?.turma_id || null
    try {
      const { error: saveErr } = await supabase.from('alunos').update({
        nome: editAlunoForm.nome.trim(),
        data_nasc: editAlunoForm.data_nasc || null,
        cpf: editAlunoForm.cpf || null,
        telefone: editAlunoForm.telefone || null,
        telefone_emergencia: editAlunoForm.telefone_emergencia || null,
        email: editAlunoForm.email || null,
        turma_id: primeiraTurmaId,
        status: editAlunoForm.status,
        genero: editAlunoForm.genero || null,
        foto_url: editAlunoForm.foto_url || null,
      }).eq('id', editAlunoId)
      if (saveErr) throw saveErr

      // Substitui aluno_turmas apenas para turmas deste polo (preserva outros polos)
      const turmasPoloIds = turmasPolo.map(t => t.id)
      await supabase.from('aluno_turmas').delete().eq('aluno_id', editAlunoId).in('turma_id', turmasPoloIds)
      if (novasMatriculas.length > 0) {
        const rows = novasMatriculas.map(m => ({ aluno_id: editAlunoId, turma_id: m.turma_id }))
        const { error: turmaErr } = await supabase.from('aluno_turmas').insert(rows)
        if (turmaErr && turmaErr.code !== '23505') throw turmaErr
      }

      setSavingEditAluno(false)
      setEditAlunoOpen(false)
      reloadAlunos()
      showToast(`✅ Aluno "${editAlunoForm.nome.trim()}" atualizado com sucesso!`, 'success')
    } catch (erro) {
      setSavingEditAluno(false)
      const msg = erro?.code === '42501'
        ? 'Você não tem permissão para editar esse aluno. Peça ao coordenador para verificar seu acesso ao polo.'
        : erro?.code === '23505'
        ? 'Esse CPF já está cadastrado. Pesquise o nome do aluno antes de cadastrar novamente.'
        : `Erro inesperado ao salvar. Tente novamente ou avise o suporte: ${erro?.message ?? ''}`
      showToast(msg, 'error')
    }
  }

  async function deletarAluno() {
    if (!deleteAlunoTarget) return
    setDeletingAluno(true)
    await supabase.from('presencas').delete().eq('aluno_id', deleteAlunoTarget.id)
    await supabase.from('atestados').delete().eq('aluno_id', deleteAlunoTarget.id)
    await supabase.from('aluno_turmas').delete().eq('aluno_id', deleteAlunoTarget.id)
    await supabase.from('alunos').delete().eq('id', deleteAlunoTarget.id)
    setDeletingAluno(false)
    setDeleteAlunoTarget(null)
    reloadAlunos()
  }

  async function uploadFotoAluno(file) {
    if (!file) return
    setUploadingFotoAluno(true)
    const ext = file.name.split('.').pop()
    const fn = `alunos/foto/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('registros-aula').upload(fn, file)
    if (!error) {
      const { data } = supabase.storage.from('registros-aula').getPublicUrl(fn)
      setNovoAlunoForm(f => ({ ...f, foto_url: data.publicUrl }))
    }
    setUploadingFotoAluno(false)
  }

  async function uploadFotoAtestado(file) {
    if (!file) return
    setUploadingAtestadoFoto(true)
    const ext = file.name.split('.').pop()
    const fn = `atestados/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('atestados').upload(fn, file)
    if (!error) {
      const { data } = supabase.storage.from('atestados').getPublicUrl(fn)
      setNovoAlunoForm(f => ({ ...f, atestado_foto: data.publicUrl }))
    }
    setUploadingAtestadoFoto(false)
  }

  async function salvarNovoAluno(forcarSalvar = false) {
    const turmasSelecionadas = novoAlunoMatriculas.filter(m => m.turma_id)
    const erros = validateAlunoForm({ ...novoAlunoForm, turma_id: turmasSelecionadas[0]?.turma_id ?? '' })
    setNovoAlunoErrors(erros)
    if (Object.keys(erros).length > 0) return

    // Busca CPF em TODOS os alunos do sistema (não só do polo) para suporte cross-polo
    const cpfNorm = novoAlunoForm.cpf ? novoAlunoForm.cpf.replace(/\D/g, '') : ''
    const alunoExistente = cpfNorm.length >= 11
      ? alunos.find(a => a.cpf && a.cpf.replace(/\D/g, '') === cpfNorm)
      : null

    if (!forcarSalvar && alunoExistente) {
      const turmaDup = turmasPolo.find(t => t.id === alunoExistente.turma_id)
      setDupWarning({ aluno: alunoExistente, turma: turmaDup })
      return
    }

    setDupWarning(null)
    setNovoAlunoError('')
    setSavingAluno(true)
    const primeiraTurmaId = turmasSelecionadas[0]?.turma_id || null
    const temTurmaMelhorIdade = turmasSelecionadas.some(m => turmasPolo.find(t => t.id === m.turma_id)?.faixa === 'Melhor Idade')

    try {
      let alunoId

      if (alunoExistente) {
        alunoId = alunoExistente.id
      } else {
        const payload = {
          nome: novoAlunoForm.nome.trim(),
          data_nasc: novoAlunoForm.data_nasc || null,
          cpf: novoAlunoForm.cpf || null,
          telefone: novoAlunoForm.telefone || null,
          telefone_emergencia: novoAlunoForm.telefone_emergencia || null,
          email: novoAlunoForm.email || null,
          turma_id: primeiraTurmaId,
          status: novoAlunoForm.status,
          genero: novoAlunoForm.genero || null,
          foto_url: novoAlunoForm.foto_url || null,
        }
        const { data, error: insertError } = await supabase.from('alunos').insert(payload).select('id').single()
        if (insertError || !data?.id) {
          setSavingAluno(false)
          setNovoAlunoError('Não foi possível salvar o aluno. Verifique se você tem permissão para esta turma ou tente novamente.')
          return
        }
        alunoId = data.id
        if (temTurmaMelhorIdade && novoAlunoForm.atestado_validade) {
          await supabase.from('atestados').insert({
            aluno_id: alunoId,
            data_validade: novoAlunoForm.atestado_validade,
            arquivo_url: novoAlunoForm.atestado_foto || null,
          })
        }
      }

      const turmaAluno = turmasPolo.find(t => t.id === primeiraTurmaId)
      logAcao({ acao: 'cadastro_aluno', perfil: profile, polo, turma: turmaAluno, aluno: { id: alunoId, nome: alunoExistente?.nome ?? novoAlunoForm.nome.trim() } })

      if (turmasSelecionadas.length > 0) {
        const rows = turmasSelecionadas.map(m => ({ aluno_id: alunoId, turma_id: m.turma_id }))
        const { error: turmaErr } = await supabase.from('aluno_turmas')
          .upsert(rows, { onConflict: 'aluno_id,turma_id', ignoreDuplicates: true })
        if (turmaErr && turmaErr.code !== '23505') throw turmaErr
      }

      setSavingAluno(false)
      setNovoAlunoOpen(false)
      setNovoAlunoForm(EMPTY_ALUNO)
      setNovoAlunoMatriculas([{ turma_id: '' }])
      reloadAlunos()
      const nomeExibido = alunoExistente?.nome ?? novoAlunoForm.nome.trim()
      showToast(alunoExistente
        ? `✅ "${nomeExibido}" matriculado nas turmas com sucesso!`
        : `✅ Aluno "${nomeExibido}" cadastrado com sucesso!`, 'success')
    } catch (erro) {
      if (offline || !navigator.onLine) {
        const payload = { nome: novoAlunoForm.nome.trim(), data_nasc: novoAlunoForm.data_nasc || null, cpf: novoAlunoForm.cpf || null, telefone: novoAlunoForm.telefone || null, telefone_emergencia: novoAlunoForm.telefone_emergencia || null, email: novoAlunoForm.email || null, turma_id: primeiraTurmaId, status: novoAlunoForm.status, genero: novoAlunoForm.genero || null, foto_url: novoAlunoForm.foto_url || null }
        addToQueue({ type: 'aluno', data: payload, turma_id: primeiraTurmaId, turmaMelhorIdade: temTurmaMelhorIdade, atestado_validade: novoAlunoForm.atestado_validade, atestado_foto: novoAlunoForm.atestado_foto })
        setSavingAluno(false)
        setNovoAlunoOpen(false)
        setNovoAlunoForm(EMPTY_ALUNO)
        setNovoAlunoMatriculas([{ turma_id: '' }])
      } else {
        console.error('Erro ao salvar aluno:', erro)
        setSavingAluno(false)
        const msg = erro?.code === '42501'
          ? 'Você não tem permissão para cadastrar alunos nessa turma. Peça ao coordenador para verificar se você está vinculado a ela.'
          : `Erro inesperado ao salvar. Tente novamente ou avise o suporte: ${erro?.message ?? ''}`
        setNovoAlunoError(msg)
      }
    }
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
      {toastEl}
      <Topbar
        title={polo?.nome ?? 'Carregando...'}
        action={
          <button onClick={() => navigate('/polos')} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <ArrowLeft size={13}/> Polos
          </button>
        }
      />

      {offline && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/50 px-3 md:px-5 py-2 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <Circle size={8} className="fill-current" />
          Offline · {pending} registros pendentes
        </div>
      )}

      {/* Banner: modo "Visualizar como" */}
      {viewAs && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border-b border-violet-200 dark:border-violet-700 px-3 md:px-5 py-2 flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-300">
          <Eye size={13} className="flex-shrink-0" />
          <span>Visualizando como <strong>{viewAs.nome}</strong> · {viewAs.cargo}</span>
          <button onClick={() => setViewAs(null)} className="ml-auto flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
            <X size={12}/> Sair
          </button>
        </div>
      )}

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
            <div className="flex gap-2">
              {isAdmin && (
                <Button size="sm" variant="secondary" onClick={() => setViewAsOpen(true)} title="Simular visão de outro usuário">
                  <Eye size={13}/> <span className="hidden sm:inline">Ver como</span>
                </Button>
              )}
              {canEditPolo && (
                <>
                  <Button size="sm" variant="secondary" onClick={openNovoFunc}>
                    <UserPlus size={13}/> <span className="hidden sm:inline">Novo Funcionário</span>
                  </Button>
                  <Button size="sm" onClick={() => { setNovoAlunoForm(EMPTY_ALUNO); setNovoAlunoMatriculas([{ turma_id: '' }]); setNovoAlunoOpen(true) }}>
                    <Plus size={13}/> <span className="hidden sm:inline">Novo Aluno</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl overflow-x-auto w-full md:w-fit">
          <TabBtn active={tab === 'geral'} onClick={() => setTab('geral')}>📊 Visão Geral</TabBtn>
          <TabBtn active={tab === 'operacional'} onClick={() => setTab('operacional')}>🏃 Operacional</TabBtn>
          <TabBtn active={tab === 'viagens'} onClick={() => setTab('viagens')}>🚌 Viagens</TabBtn>
          {canEditPolo && (
            <TabBtn active={tab === 'alunos'} onClick={() => setTab('alunos')}>👥 Alunos</TabBtn>
          )}
        </div>

        {/* ─── VISÃO GERAL ──────────────────────────────────────────── */}
        {tab === 'geral' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Alunos Ativos" value={alunosAtivos} sub={`em ${turmasAtivas} turmas`} icon={Users} highlight />
              <KpiCard label="Turmas Ativas" value={turmasAtivas} sub="em funcionamento" icon={BookOpen} />
              <KpiCard label="Freq. Média" value={`${freqMedia}%`} sub="últimos 90 dias" icon={TrendingUp} />
              <KpiCard label="Melhor Idade" value={melhorIdade} sub="alunos 60+" icon={UserCheck} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Novos (30 dias)" value={alunosNovos} sub="matrículas recentes" icon={Users} />
              <KpiCard label="Ocupação" value={`${ocupacao}%`} sub="capacidade total" icon={TrendingUp} />
              <KpiCard label="Atestados Vencendo" value={atestadosVencendo} sub="próximos 30 dias" icon={Stethoscope} />
              <KpiCard label="Atestados Vencidos" value={atestadosVencidos} sub="requer renovação" icon={Stethoscope} />
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-600 text-right">Freq. Média baseada nos últimos 90 dias de presença</p>

            {atestadosVencendo > 0 && (
              <button onClick={() => { setAtestadosFiltro('vencendo'); setAtestadosModalOpen(true) }} className="w-full text-left bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                ⚠️ {atestadosVencendo} atestado(s) vencendo nos próximos 30 dias
              </button>
            )}
            {atestadosVencidos > 0 && (
              <button onClick={() => { setAtestadosFiltro('vencido'); setAtestadosModalOpen(true) }} className="w-full text-left bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-300 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                🚨 {atestadosVencidos} atestado(s) vencido(s) — alunos precisam renovar
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* Presença 7 dias */}
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col">
                <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Presença — últimos 7 dias</p>
                {presencasPolo.length === 0 ? (
                  <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center gap-2">
                    <div className="text-2xl">📊</div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Nenhuma presença registrada neste polo.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ultimos7} barSize={14} barGap={3} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: dark ? '#1e2d42' : '#f8fafc' }} />
                          <Bar dataKey="Presentes" fill="#009640" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Faltas" fill="#f87171" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-primary-600 inline-block" /> Presentes</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Faltas</span>
                    </div>
                  </>
                )}
              </div>

              {/* Equipe */}
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col">
                <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Equipe no Polo</p>
                {equipe.length === 0 ? (
                  <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center gap-2">
                    <div className="text-2xl">👥</div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Nenhum funcionário vinculado a este polo.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto overscroll-contain max-h-[300px] space-y-1">
                    {equipe.map(m => {
                      const canEditEquipe = isAdmin || atribuicoes.some(
                        a => a.usuario_id === profile?.id && a.polo_id === id && a.cargo === 'coordenador'
                      )
                      return canEditEquipe ? (
                        <button
                          key={m.id}
                          onClick={() => openEditFunc(m)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors group text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[9px] font-bold">{m.nome?.charAt(0)?.toUpperCase()}</span>
                          </div>
                          <p className="text-xs font-semibold text-navy-900 dark:text-white flex-1 truncate">{m.nome}</p>
                          <Badge color={CARGO_COLORS[m.cargo] ?? 'gray'}>{CARGO_LABELS[m.cargo] ?? m.cargo}</Badge>
                          <Pencil size={11} className="text-slate-300 group-hover:text-slate-500 dark:group-hover:text-slate-300 flex-shrink-0 transition-colors" />
                        </button>
                      ) : (
                        <div key={m.id} className="flex items-center gap-2.5 px-2 py-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[9px] font-bold">{m.nome?.charAt(0)?.toUpperCase()}</span>
                          </div>
                          <p className="text-xs font-semibold text-navy-900 dark:text-white flex-1 truncate">{m.nome}</p>
                          <Badge color={CARGO_COLORS[m.cargo] ?? 'gray'}>{CARGO_LABELS[m.cargo] ?? m.cargo}</Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modalidades — cards compactos clicáveis para Operacional */}
            {porModalidade.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Modalidades</p>
                  <button onClick={() => setTab('operacional')}
                    className="text-[10px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
                    Ver todas →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {porModalidade.map(mod => {
                    const totalAlunos = mod.turmas.reduce((s, t) => s + alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length, 0)
                    const turmasAtivas = mod.turmas.filter(t => t.status === 'Ativa').length
                    return (
                      <button key={mod.nome}
                        onClick={() => { setTab('operacional'); setOpTab('turmas') }}
                        className="flex items-center gap-3 p-3 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all text-left">
                        <span className="text-2xl shrink-0">{mod.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-navy-900 dark:text-white truncate">{mod.nome}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {turmasAtivas} turma{turmasAtivas !== 1 ? 's' : ''} · {totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ─── OPERACIONAL ──────────────────────────────────────────── */}
        {tab === 'operacional' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl w-fit">
              {[
                { id: 'hoje', label: 'Hoje' },
                { id: 'turmas', label: 'Turmas' },
                { id: 'historico', label: 'Histórico' },
              ].map(st => (
                <button key={st.id} onClick={() => setOpTab(st.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    opTab === st.id
                      ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-navy-700 dark:hover:text-slate-200'
                  }`}>
                  {st.label}
                </button>
              ))}
            </div>

            {/* ── Sub-tab: Hoje ── */}
            {opTab === 'hoje' && <>
            {/* Aulas acontecendo agora — classifica cada uma por status */}
            {aulasAgora.length > 0 && (() => {
              // Classifica cada turma: 'em_aula' | 'tolerancia' | 'pre'
              const classificar = (t) => {
                const [h, m] = t.horario.split(':').map(Number)
                const tMins = h * 60 + m
                const dur = t.duracao_min || 60
                if (agoraMins < tMins) return { tipo: 'pre', minRestantes: tMins - agoraMins }
                if (agoraMins <= tMins + dur) return { tipo: 'em_aula', minRestantes: tMins + dur - agoraMins }
                return { tipo: 'tolerancia', minRestantes: tMins + dur + 30 - agoraMins }
              }
              const emAula = aulasAgora.filter(t => classificar(t).tipo === 'em_aula')
              const tolerancia = aulasAgora.filter(t => classificar(t).tipo === 'tolerancia')
              const pre = aulasAgora.filter(t => classificar(t).tipo === 'pre')

              const CardAula = ({ t, tipo }) => {
                const { minRestantes } = classificar(t)
                const isGreen = tipo === 'em_aula'
                const isAmber = tipo === 'tolerancia'
                return (
                  <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isGreen ? 'bg-green-700' : ''}`}>
                    <span className="text-xl flex-shrink-0">{t.modalidades?.emoji ?? '🏃'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isGreen ? 'text-white' : isAmber ? 'text-amber-800 dark:text-amber-200' : 'text-blue-700 dark:text-blue-300'}`}>
                        {t.modalidades?.nome ?? '—'}
                      </p>
                      <p className={`text-xs truncate ${isGreen ? 'text-green-100' : isAmber ? 'text-amber-600 dark:text-amber-400' : 'text-blue-500 dark:text-blue-400'}`}>
                        {t.faixa} · {t.horario?.slice(0,5)}{t.profiles?.nome ? ` · ${t.profiles.nome}` : ''}
                        {isAmber && ` · fecha em ${minRestantes} min`}
                        {tipo === 'pre' && ` · começa em ${minRestantes} min`}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setAulaOpen(t)}
                      className={`flex-shrink-0 border-0 font-bold text-xs ${
                        isGreen ? 'bg-white text-green-700 hover:bg-green-50' :
                        isAmber ? 'bg-amber-500 text-white hover:bg-amber-600' :
                                  'bg-blue-500 text-white hover:bg-blue-600'
                      }`}>
                      Registrar
                    </Button>
                  </div>
                )
              }

              return (
                <div className="space-y-2">
                  {/* 🟢 Em aula agora — DESTAQUE PRINCIPAL */}
                  {emAula.length > 0 && (
                    <div className="bg-green-600 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-100">
                          {emAula.length === 1 ? 'Em Aula Agora' : `${emAula.length} Aulas Acontecendo Agora`}
                        </p>
                      </div>
                      {emAula.map(t => <CardAula key={t.id} t={t} tipo="em_aula" />)}
                    </div>
                  )}

                  {/* 🟠 Janela de tolerância — compacto, menos destaque */}
                  {tolerancia.length > 0 && (
                    <div className="bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2.5 space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        ⏱ Janela de tolerância — aula encerrou, ainda pode registrar
                      </p>
                      {tolerancia.map(t => <CardAula key={t.id} t={t} tipo="tolerancia" />)}
                    </div>
                  )}

                  {/* 🔵 Iniciando em breve — ainda mais discreto */}
                  {pre.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400 flex items-center gap-1">
                        🕐 Iniciando em breve
                      </p>
                      {pre.map(t => <CardAula key={t.id} t={t} tipo="pre" />)}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Aulas de hoje */}
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">
                Aulas de Hoje — {format(hoje, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              {aulasHoje.length === 0 ? (
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma aula programada para hoje.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {aulasHoje.map(t => {
                    const cardStatus = (() => {
                      if (!t.horario) return 'normal'
                      const [th, tm] = t.horario.split(':').map(Number)
                      const tM = th * 60 + tm
                      const dur = t.duracao_min || 60
                      if (agoraMins >= tM && agoraMins <= tM + dur) return 'em_aula'
                      if (agoraMins > tM + dur && agoraMins <= tM + dur + 30) return 'tolerancia'
                      if (agoraMins >= tM - 30 && agoraMins < tM) return 'pre'
                      // Aula já encerrou (mais de 30min) — pendente se não registrou
                      if (agoraMins > tM + dur + 30) return 'pendente'
                      return 'normal'
                    })()
                    const alunosTurmaCount = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
                    const dataHoje = new Date().toISOString().split('T')[0]
                    const presencaHoje = presencas.filter(p => p.turma_id === t.id && p.data === dataHoje)
                    const jaRegistrou = presencaHoje.length > 0
                    const registroHoje = registros.find(r => r.turma_id === t.id && r.data === dataHoje)

                    // 'pendente' = aula encerrada sem presença registrada
                    const isPendente = cardStatus === 'pendente' && !jaRegistrou
                    const cardCls =
                      cardStatus === 'em_aula'    ? 'bg-green-600 border-green-500 text-white' :
                      cardStatus === 'tolerancia' ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700' :
                      cardStatus === 'pre'        ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' :
                      isPendente                  ? 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700' :
                                                    'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-primary-200'
                    const titleCls =
                      cardStatus === 'em_aula'    ? 'text-white' :
                      cardStatus === 'tolerancia' ? 'text-amber-900 dark:text-amber-100' :
                      cardStatus === 'pre'        ? 'text-blue-800 dark:text-blue-200' :
                      isPendente                  ? 'text-red-800 dark:text-red-200' :
                                                    'text-navy-900 dark:text-white'
                    const subCls =
                      cardStatus === 'em_aula'    ? 'text-green-100' :
                      cardStatus === 'tolerancia' ? 'text-amber-600 dark:text-amber-400' :
                      cardStatus === 'pre'        ? 'text-blue-500 dark:text-blue-400' :
                      isPendente                  ? 'text-red-500 dark:text-red-400' :
                                                    'text-slate-400 dark:text-slate-500'
                    const badgeEl =
                      cardStatus === 'em_aula'    ? <span className="text-[8px] bg-white text-green-700 px-1.5 py-0.5 rounded-full font-bold shrink-0">AGORA</span> :
                      cardStatus === 'tolerancia' ? <span className="text-[8px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full font-bold shrink-0">⏱</span> :
                      cardStatus === 'pre'        ? <span className="text-[8px] bg-blue-400 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">EM BREVE</span> :
                      isPendente                  ? <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">⚠️ PENDENTE</span> :
                                                    null
                    const checkColor = cardStatus === 'em_aula' ? 'text-green-100' : 'text-primary-600'
                    return (
                      <button key={t.id} onClick={() => setAulaOpen(t)}
                        className={`text-left p-3 rounded-xl border transition-all ${cardCls}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-base">{t.modalidades?.emoji ?? '📚'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] font-bold truncate ${titleCls}`}>{t.modalidades?.nome ?? '—'}</p>
                            <p className={`text-[9px] ${subCls}`}>{t.faixa}{t.faixa_etaria ? ` · ${t.faixa_etaria}` : ''}</p>
                          </div>
                          {badgeEl}
                        </div>
                        <div className={`text-[9px] space-y-0.5 ${subCls}`}>
                          <div className="flex items-center gap-1"><Clock size={8}/>{t.horario?.slice(0,5)}</div>
                          <div className="flex items-center gap-1"><Users size={8}/>{alunosTurmaCount} alunos</div>
                        </div>
                        <div className="mt-2 text-[9px]">
                          {jaRegistrou
                            ? <span className={`flex items-center gap-1 font-semibold ${checkColor}`}><CheckCircle2 size={9}/> Presença ok</span>
                            : isPendente
                            ? <span className="font-bold text-red-600 dark:text-red-400">⚠️ Registre a presença!</span>
                            : <span className={subCls}>Toque p/ registrar</span>
                          }
                          {registroHoje && <span className={`flex items-center gap-1 font-semibold ${checkColor}`}><CheckCircle2 size={9}/> Aula ok</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            </> /* fim sub-tab Hoje */}

            {/* ── Sub-tab: Turmas ── */}
            {opTab === 'turmas' && <>
            {canEditPolo && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setEditTurmaId(null); setTurmaForm(EMPTY_TURMA_FORM); setTurmaModalOpen(true) }}>
                  <Plus size={13}/> Nova Turma
                </Button>
              </div>
            )}

            {/* Todas as turmas — agrupadas por modalidade, colapsável */}
            {turmasPolo.length > 0 && (() => {
              const grupos = porModalidade.map(mod => ({
                ...mod,
                turmasAll: turmasPolo.filter(t => t.modalidade_id === mod.turmas[0]?.modalidade_id)
              }))
              // fallback: usar porModalidade direto
              return (
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">Todas as Turmas</p>
                  <div className="space-y-2">
                    {porModalidade.map(mod => {
                      const totalAlunos = mod.turmas.reduce((s, t) => s + alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length, 0)
                      const aberto = expandidos.has('op-' + mod.nome)
                      return (
                        <div key={mod.nome} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                          {/* Cabeçalho */}
                          <button onClick={() => toggleColapso('op-' + mod.nome)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-left">
                            <span className="text-xl shrink-0">{mod.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-navy-900 dark:text-white">{mod.nome}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                {mod.turmas.length} turma{mod.turmas.length !== 1 ? 's' : ''} · {totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''} ativo{totalAlunos !== 1 ? 's' : ''}
                              </p>
                            </div>
                            {canEditPolo && (
                              <button onClick={e => { e.stopPropagation(); setEditTurmaId(null); setTurmaForm({ ...EMPTY_TURMA_FORM, modalidade_id: mod.turmas[0]?.modalidade_id ?? '' }); setTurmaModalOpen(true) }}
                                className="flex items-center gap-1 text-[10px] font-semibold text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors mr-1">
                                <Plus size={11}/> Turma
                              </button>
                            )}
                            <ChevronRight size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`} />
                          </button>
                          {/* Turmas */}
                          {aberto && (
                            <div className="border-t border-slate-100 dark:border-navy-700">
                              {mod.turmas.map((t, idx) => {
                                const cnt = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
                                const ocup = t.capacidade ? Math.round((cnt / t.capacidade) * 100) : 0
                                const eHoje = !!aulasHoje.find(a => a.id === t.id)
                                return (
                                  <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-slate-100 dark:border-navy-700' : ''}`}>
                                    {/* Info principal */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-[11px] font-semibold text-navy-900 dark:text-white">{t.faixa}{t.faixa_etaria ? ` · ${t.faixa_etaria}` : ''}</p>
                                        {eHoje && <span className="text-[8px] bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full font-semibold">Hoje</span>}
                                        {t.status === 'Inativa' && <span className="text-[8px] bg-slate-100 dark:bg-navy-600 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">Inativa</span>}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5">
                                        <span className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400"><Clock size={8}/>{t.dias?.join(', ')} · {t.horario?.slice(0,5)}{t.duracao_min && t.duracao_min !== 60 ? ` · ${t.duracao_min < 60 ? `${t.duracao_min}min` : `${Math.floor(t.duracao_min/60)}h${t.duracao_min%60 ? `${t.duracao_min%60}min` : ''}`}` : ''}</span>
                                        <span className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400"><Users size={8}/>{cnt}/{t.capacidade}</span>
                                        <div className="w-14 h-1 bg-slate-200 dark:bg-navy-600 rounded-full overflow-hidden">
                                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${ocup}%` }}/>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Ações */}
                                    {canEditTurma(t) && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={e => abrirEditTurma(e, t)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-400 hover:text-primary-600 transition-colors">
                                          <Pencil size={12}/>
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); setDeleteTurmaTarget(t) }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                                          <Trash2 size={12}/>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            </> /* fim sub-tab Turmas */}

            {/* ── Sub-tab: Histórico ── */}
            {opTab === 'historico' && <>
            {/* Histórico de Aulas com filtros */}
            {(() => {
              const todosRegs = registros
                .filter(r => turmaIds.has(r.turma_id))
                .filter(r => {
                  if (regFiltroTurma && r.turma_id !== regFiltroTurma) return false
                  if (regFiltroData && r.data !== regFiltroData) return false
                  if (regFiltroMod) {
                    const t = turmasPolo.find(t => t.id === r.turma_id)
                    if (t?.modalidade_id !== regFiltroMod) return false
                  }
                  return true
                })
                .sort((a, b) => b.data.localeCompare(a.data))
              const visiveis = regExpandido ? todosRegs : todosRegs.slice(0, 5)
              if (registros.filter(r => turmaIds.has(r.turma_id)).length === 0) return null
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Histórico de Aulas</p>
                    <span className="text-[10px] text-slate-400">{todosRegs.length} registro{todosRegs.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Filtros */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <select value={regFiltroTurma} onChange={e => setRegFiltroTurma(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-navy-600 text-[11px] bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
                      <option value="">Todas as turmas</option>
                      {turmasPolo.map(t => <option key={t.id} value={t.id}>{t.modalidades?.emoji} {t.modalidades?.nome} · {t.horario?.slice(0,5)}</option>)}
                    </select>
                    <select value={regFiltroMod} onChange={e => setRegFiltroMod(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-navy-600 text-[11px] bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
                      <option value="">Todas as modalidades</option>
                      {modalidades.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.nome}</option>)}
                    </select>
                    <input type="date" value={regFiltroData} onChange={e => setRegFiltroData(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-navy-600 text-[11px] bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                  {visiveis.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Nenhum registro encontrado com esses filtros.</p>
                  ) : (
                    <div className="space-y-2">
                      {visiveis.map(r => {
                        const turma = turmasPolo.find(t => t.id === r.turma_id)
                        const presencasDia = presencas.filter(p => p.turma_id === r.turma_id && p.data === r.data)
                        const presentes = presencasDia.filter(p => p.status === 'presente' || p.status === 'justificado').length
                        const total = presencasDia.length
                        return (
                          <div key={r.id} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-3">
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{turma?.modalidades?.emoji ?? '📚'}</span>
                                <div>
                                  <p className="text-[11px] font-bold text-navy-900 dark:text-white">{turma?.modalidades?.nome ?? '—'}</p>
                                  <p className="text-[9px] text-slate-400">{formatDate(r.data)} · {turma?.horario?.slice(0,5)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-semibold text-primary-600">{presentes}/{total}</span>
                                <div className="w-12 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary-600 rounded-full" style={{ width: `${total ? (presentes/total)*100 : 0}%` }} />
                                </div>
                              </div>
                            </div>
                            {r.conteudo && <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2">{r.conteudo}</p>}
                            {r.ocorrencias && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 line-clamp-1">⚠ {r.ocorrencias}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {todosRegs.length > 5 && (
                    <button onClick={() => setRegExpandido(v => !v)}
                      className="w-full mt-2 py-2 text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                      {regExpandido ? '▲ Mostrar menos' : `▼ Ver todos (${todosRegs.length - 5} mais)`}
                    </button>
                  )}
                </div>
              )
            })()}
            </> /* fim sub-tab Histórico */}
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
                      {canEditPolo && (
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
                              {!passou && canEditPolo && (
                                <div className="flex gap-1">
                                  <button onClick={() => { setEditandoViagem(v); setViagemForm({ destino: v.destino, data: v.data, vagas: v.vagas }); setViagemModalOpen(true) }} className="p-1.5 rounded hover:bg-white dark:hover:bg-navy-600 transition-colors">
                                    <Pencil size={13} className="text-primary-600" />
                                  </button>
                                  <button onClick={() => setDeletandoViagem(v)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                                    <Trash2 size={13} className="text-red-500" />
                                  </button>
                                </div>
                              )}
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
                const turmasMelhorIdadeIds = new Set(turmasMelhorIdade.map(t => t.id))
                const alunosMelhorIdadeRaw = alunosPolo.filter(a => {
                  const ids = [a.turma_id, ...(a.aluno_turmas ?? []).map(at => at.turma_id)]
                  return ids.some(tid => turmasMelhorIdadeIds.has(tid))
                })
                // Enriquecer com freq e ordenar por freq desc (ranking)
                const alunosMelhorIdade = alunosMelhorIdadeRaw.map(a => {
                  const pAluno = presencas.filter(p => p.aluno_id === a.id)
                  const freqAluno = pAluno.length > 0 ? Math.round(pAluno.filter(p => p.status === 'presente' || p.status === 'justificado').length / pAluno.length * 100) : null
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
        {/* ─── ABA ALUNOS ──────────────────────────────────────────── */}
        {tab === 'alunos' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl w-fit">
              {[
                { id: 'lista', label: 'Lista' },
                { id: 'engajamento', label: 'Engajamento' },
              ].map(st => (
                <button key={st.id} onClick={() => {
                  setAlunosTab(st.id)
                  if (st.id === 'engajamento' && presencasHist === null) {
                    carregarHistoricoCompleto(turmasPolo.map(t => t.id))
                  }
                }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    alunosTab === st.id
                      ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-navy-700 dark:hover:text-slate-200'
                  }`}>
                  {st.label}
                </button>
              ))}
            </div>

            {/* ── Sub-tab: Lista ── */}
            {alunosTab === 'lista' && <>
            {/* Barra de busca + filtros */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={alunosBusca}
                  onChange={e => setAlunosBusca(e.target.value)}
                  placeholder="Buscar por nome, CPF ou telefone..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-xs bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <select
                value={alunosFiltroTurma}
                onChange={e => setAlunosFiltroTurma(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-xs bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todas as turmas</option>
                {turmasPolo.sort((a,b) => (a.modalidades?.nome ?? '').localeCompare(b.modalidades?.nome ?? '', 'pt-BR')).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.modalidades?.emoji} {t.modalidades?.nome} · {t.dias?.join('/')} {t.horario?.slice(0,5)}
                  </option>
                ))}
              </select>
              <select
                value={alunosFiltroStatus}
                onChange={e => setAlunosFiltroStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-xs bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todos status</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Pendente">Pendente</option>
              </select>
            </div>

            {/* Contagem */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest">
              {alunosFiltrados.length} aluno{alunosFiltrados.length !== 1 ? 's' : ''} encontrado{alunosFiltrados.length !== 1 ? 's' : ''}
            </p>

            {/* Lista de alunos */}
            {alunosFiltrados.length === 0 ? (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 py-12 flex flex-col items-center gap-3">
                <div className="text-3xl">👥</div>
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center">Nenhum aluno encontrado com esses filtros.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-700">
                  <p className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Aluno</p>
                  <p className="col-span-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Turma</p>
                  <p className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</p>
                  <p className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Ações</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-navy-700">
                  {alunosFiltrados.map(a => {
                    const turmaAluno = turmasPolo.find(t => t.id === a.turma_id)
                    return (
                      <div key={a.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-navy-700/40 transition-colors">
                        {/* Nome + foto */}
                        <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                          {a.foto_url ? (
                            <img src={a.foto_url} alt={a.nome} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-slate-200 dark:border-navy-600" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[10px] font-bold">{a.nome?.charAt(0)?.toUpperCase()}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-navy-900 dark:text-white truncate">{a.nome}</p>
                            {a.data_nasc && (
                              <p className="text-[9px] text-slate-400 dark:text-slate-500">
                                {new Date().getFullYear() - new Date(a.data_nasc).getFullYear()} anos
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Turma */}
                        <div className="col-span-4 min-w-0">
                          {turmaAluno ? (
                            <>
                              <p className="text-[10px] font-semibold text-navy-800 dark:text-slate-200 truncate">
                                {turmaAluno.modalidades?.emoji} {turmaAluno.modalidades?.nome}
                              </p>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                                {turmaAluno.dias?.join('/') ?? '—'} · {turmaAluno.horario?.slice(0,5)}
                              </p>
                            </>
                          ) : (
                            <p className="text-[10px] text-slate-400">Sem turma</p>
                          )}
                        </div>
                        {/* Status badge */}
                        <div className="col-span-1 flex justify-center">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            a.status === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : a.status === 'Inativo' ? 'bg-slate-100 text-slate-500 dark:bg-navy-700 dark:text-slate-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>{a.status}</span>
                        </div>
                        {/* Ações */}
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditAluno(a)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Editar aluno"
                          >
                            <Pencil size={13} />
                          </button>
                          {canDeleteAluno && (
                            <button
                              onClick={() => setDeleteAlunoTarget(a)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Excluir aluno"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            </> /* fim sub-tab Lista */}

            {/* ── Sub-tab: Engajamento ── */}
            {alunosTab === 'engajamento' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  {loadingHist ? (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest animate-pulse">
                      Carregando histórico completo...
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest">
                      {engajamento.length} aluno{engajamento.length !== 1 ? 's' : ''} ativos ·{' '}
                      {presencasHist !== null
                        ? `histórico completo (${presencasHist.filter(p => turmaIds.has(p.turma_id)).length} registros)`
                        : 'frequência dos últimos 90 dias'}
                    </p>
                  )}
                </div>
                {loadingHist ? (
                  <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 py-12 flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 dark:text-slate-500">Buscando histórico completo de presenças...</p>
                  </div>
                ) : engajamento.length === 0 ? (
                  <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 py-12 flex flex-col items-center gap-3">
                    <div className="text-3xl">📊</div>
                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center">Nenhum aluno ativo com histórico de presença.</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-700">
                      <p className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">#</p>
                      <p className="col-span-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Aluno</p>
                      <p className="col-span-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Frequência</p>
                      <p className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Aulas</p>
                      <p className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Afastado</p>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-navy-700">
                      {engajamento.map((a, idx) => {
                        const freqCor = a.freq === null ? 'text-slate-400' : a.freq >= 70 ? 'text-green-600 dark:text-green-400' : a.freq >= 50 ? 'text-amber-500' : 'text-red-500'
                        const barCor = a.freq === null ? '#e2e8f0' : a.freq >= 70 ? '#009640' : a.freq >= 50 ? '#f59e0b' : '#ef4444'
                        const alerta = a.diasAfastado !== null && a.diasAfastado >= 14
                        return (
                          <div key={a.id} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${alerta ? 'bg-red-50 dark:bg-red-950/30' : 'hover:bg-slate-50 dark:hover:bg-navy-700/40'} transition-colors`}>
                            <div className="col-span-1">
                              <span className={`text-[10px] font-bold ${idx < 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                                {idx < 3 ? ['🥇','🥈','🥉'][idx] : `${idx + 1}`}
                              </span>
                            </div>
                            <div className="col-span-4 flex items-center gap-2 min-w-0">
                              {a.foto_url ? (
                                <img src={a.foto_url} alt={a.nome} className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-slate-200 dark:border-navy-600" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-[9px] font-bold">{a.nome?.charAt(0)?.toUpperCase()}</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-navy-900 dark:text-white truncate">{a.nome}</p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                                  {turmasPolo.find(t => t.id === a.turma_id)?.modalidades?.nome ?? 'Sem turma'}
                                </p>
                              </div>
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${a.freq ?? 0}%`, backgroundColor: barCor }} />
                              </div>
                              <span className={`text-[10px] font-bold w-7 text-right shrink-0 ${freqCor}`}>
                                {a.freq !== null ? `${a.freq}%` : '—'}
                              </span>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {a.presentes}/{a.total}
                              </span>
                            </div>
                            <div className="col-span-2 text-center">
                              {a.diasAfastado === null ? (
                                <span className="text-[10px] text-slate-400">—</span>
                              ) : a.diasAfastado === 0 ? (
                                <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">Hoje</span>
                              ) : alerta ? (
                                <span className="text-[10px] text-red-500 font-semibold">{a.diasAfastado}d ⚠</span>
                              ) : (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">{a.diasAfastado}d</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
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
        adminMode={isAdmin}
      />

      {/* Modal Nova / Editar Turma */}
      <Modal open={turmaModalOpen} onClose={() => { setTurmaModalOpen(false); setEditTurmaId(null) }} title={editTurmaId ? 'Editar Turma' : 'Nova Turma'} size="lg">
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

          {/* Horário + Duração + Categoria */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Horário *</label>
              <input type="time" value={turmaForm.horario} onChange={e => setTurmaForm(f => ({ ...f, horario: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Duração</label>
              <select value={turmaForm.duracao_min} onChange={e => setTurmaForm(f => ({ ...f, duracao_min: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                {DURACAO_OPTIONS.map(d => <option key={d} value={d}>{d < 60 ? `${d} min` : d === 60 ? '1h' : `${Math.floor(d/60)}h${d%60 ? `${d%60}min` : ''}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Categoria</label>
              <select value={turmaForm.faixa} onChange={e => setTurmaForm(f => ({ ...f, faixa: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                {FAIXAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Faixa etária específica (opcional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Classificação de Idade <span className="font-normal text-slate-400">(opcional — ex: 6-9 anos, 10-12 anos)</span>
            </label>
            <input type="text" value={turmaForm.faixa_etaria} onChange={e => setTurmaForm(f => ({ ...f, faixa_etaria: e.target.value }))}
              placeholder="Ex: 6-9 anos"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

          {/* Professores / Estagiários */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Professores / Estagiários
              {turmaForm.professores_ids.length > 0 && (
                <span className="ml-2 text-primary-500 font-normal">{turmaForm.professores_ids.length} selecionado(s)</span>
              )}
            </label>
            {(() => {
              const disponiveis = professores.filter(p =>
                (p.cargo === 'professor' || p.cargo === 'estagiario' || p.cargo === 'coordenador') &&
                atribuicoes.some(a => a.usuario_id === p.id && a.polo_id === id)
              )
              if (disponiveis.length === 0) return (
                <p className="text-xs text-slate-400 italic py-2">Nenhum professor ou estagiário cadastrado neste polo.</p>
              )
              return (
                <div className="border border-slate-200 dark:border-navy-600 rounded-lg divide-y divide-slate-100 dark:divide-navy-600 max-h-40 overflow-y-auto">
                  {disponiveis.map(p => {
                    const sel = turmaForm.professores_ids.includes(p.id)
                    return (
                      <label key={p.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-600 transition-colors ${sel ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                        <input type="checkbox" checked={sel}
                          onChange={() => setTurmaForm(f => ({
                            ...f,
                            professores_ids: sel ? f.professores_ids.filter(x => x !== p.id) : [...f.professores_ids, p.id]
                          }))}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-sm text-navy-900 dark:text-white flex-1">{p.nome}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.cargo === 'estagiario' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                          {p.cargo}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setTurmaModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={editTurmaId ? salvarEditTurma : salvarTurma}
              disabled={savingTurma || !turmaForm.modalidade_id || !turmaForm.horario || turmaForm.dias.length === 0}>
              {savingTurma ? 'Salvando...' : editTurmaId ? 'Salvar Alterações' : 'Criar Turma'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Nova/Editar Viagem */}
      <Modal open={viagemModalOpen} onClose={() => { setViagemModalOpen(false); setEditandoViagem(null); setViagemForm({ destino: '', data: '', vagas: 20 }) }} title={editandoViagem ? 'Editar Viagem' : 'Nova Viagem'}>
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
      <Modal open={novoAlunoOpen} onClose={() => { setNovoAlunoOpen(false); setNovoAlunoMatriculas([{ turma_id: '' }]); setNovoAlunoErrors({}); setDupWarning(null) }} title="Novo Aluno" size="lg">
        <div className="space-y-3">

          {/* Foto do aluno */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Foto do Aluno</label>
            <div className="flex items-center gap-4">
              {novoAlunoForm.foto_url ? (
                <div className="relative flex-shrink-0">
                  <img src={novoAlunoForm.foto_url} alt="foto" className="w-16 h-16 rounded-full object-cover border-2 border-primary-200 dark:border-primary-700" />
                  <button type="button" onClick={() => setNovoAlunoForm(f => ({ ...f, foto_url: '' }))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                    <X size={10}/>
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-navy-700 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-navy-600 flex-shrink-0">
                  <Camera size={20} className="text-slate-300 dark:text-slate-600" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 cursor-pointer hover:text-primary-700 ${uploadingFotoAluno ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Camera size={12}/> Tirar Foto
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => uploadFotoAluno(e.target.files?.[0])} />
                </label>
                <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-700 ${uploadingFotoAluno ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={12}/> Escolher da Galeria
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => uploadFotoAluno(e.target.files?.[0])} />
                </label>
                {uploadingFotoAluno && <p className="text-[10px] text-slate-400 animate-pulse">Enviando...</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nome <span className="text-red-400">*</span></label>
            <input type="text" autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')} value={novoAlunoForm.nome}
              onChange={e => { setNovoAlunoForm(f => ({ ...f, nome: e.target.value })); setNovoAlunoErrors(e2 => ({ ...e2, nome: undefined })) }}
              placeholder="Nome completo"
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${novoAlunoErrors.nome ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400' : 'border-slate-200 dark:border-navy-600'}`} />
            {novoAlunoErrors.nome && <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">⚠ {novoAlunoErrors.nome}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data de Nascimento</label>
              <input type="date" autoComplete="new-password" value={novoAlunoForm.data_nasc}
                onChange={e => { setNovoAlunoForm(f => ({ ...f, data_nasc: e.target.value })); setNovoAlunoErrors(e2 => ({ ...e2, data_nasc: undefined })) }}
                className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${novoAlunoErrors.data_nasc ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400' : 'border-slate-200 dark:border-navy-600'}`} />
              {novoAlunoErrors.data_nasc && <p className="text-[11px] text-red-500 mt-1">⚠ {novoAlunoErrors.data_nasc}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">CPF</label>
              <input type="text" autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')} value={novoAlunoForm.cpf}
                onChange={e => setNovoAlunoForm(f => ({ ...f, cpf: e.target.value }))}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Telefone</label>
              <input type="text" autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')} value={novoAlunoForm.telefone}
                onChange={e => setNovoAlunoForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tel. Emergência</label>
              <input type="text" autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')} value={novoAlunoForm.telefone_emergencia}
                onChange={e => setNovoAlunoForm(f => ({ ...f, telefone_emergencia: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">E-mail</label>
              <input type="text" autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')} value={novoAlunoForm.email}
                onChange={e => { setNovoAlunoForm(f => ({ ...f, email: e.target.value })); setNovoAlunoErrors(e2 => ({ ...e2, email: undefined })) }}
                placeholder="aluno@email.com"
                className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${novoAlunoErrors.email ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400' : 'border-slate-200 dark:border-navy-600'}`} />
              {novoAlunoErrors.email && <p className="text-[11px] text-red-500 mt-1">⚠ {novoAlunoErrors.email}</p>}
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
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Gênero</label>
              <select value={novoAlunoForm.genero}
                onChange={e => setNovoAlunoForm(f => ({ ...f, genero: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Não informado</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>
          {/* Turmas (multi) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Turmas (neste polo) <span className="text-red-400">*</span></label>
            <div className="space-y-2">
              {novoAlunoMatriculas.map((m, idx) => {
                const selecionadas = new Set(novoAlunoMatriculas.map(x => x.turma_id).filter(Boolean))
                return (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={m.turma_id}
                      onChange={e => { setNovoAlunoMatriculas(prev => prev.map((x, i) => i === idx ? { turma_id: e.target.value } : x)); setNovoAlunoErrors(e2 => ({ ...e2, turma_id: undefined })) }}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${novoAlunoErrors.turma_id && idx === 0 ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400' : 'border-slate-200 dark:border-navy-600'}`}
                    >
                      <option value="">— Selecione uma turma —</option>
                      {turmasPolo.filter(t => t.status === 'Ativa' && (!selecionadas.has(t.id) || t.id === m.turma_id)).sort((a, b) => (a.modalidades?.nome ?? '').localeCompare(b.modalidades?.nome ?? '', 'pt-BR')).map(t => (
                        <option key={t.id} value={t.id}>{t.modalidades?.emoji} {t.modalidades?.nome} · {t.faixa} · {t.dias?.join('/')} {t.horario?.slice(0, 5)}</option>
                      ))}
                    </select>
                    {novoAlunoMatriculas.length > 1 && (
                      <button type="button" onClick={() => setNovoAlunoMatriculas(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none px-1">×</button>
                    )}
                  </div>
                )
              })}
            </div>
            {novoAlunoErrors.turma_id && <p className="text-[11px] text-red-500 mt-1">⚠ {novoAlunoErrors.turma_id}</p>}
            {novoAlunoMatriculas.every(m => m.turma_id) && novoAlunoMatriculas.length < turmasPolo.filter(t => t.status === 'Ativa').length && (
              <button type="button" onClick={() => setNovoAlunoMatriculas(prev => [...prev, { turma_id: '' }])}
                className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium">+ Adicionar outra turma neste polo</button>
            )}
          </div>
          {/* Atestado médico — somente para turmas Melhor Idade */}
          {novoAlunoMatriculas.some(m => turmasPolo.find(t => t.id === m.turma_id)?.faixa === 'Melhor Idade') && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 p-3 space-y-3">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">🏥 Atestado Médico — Melhor Idade</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Validade do Atestado</label>
                <input type="date" value={novoAlunoForm.atestado_validade}
                  onChange={e => setNovoAlunoForm(f => ({ ...f, atestado_validade: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Foto do Atestado</label>
                {novoAlunoForm.atestado_foto ? (
                  <div className="flex items-center gap-2">
                    <a href={novoAlunoForm.atestado_foto} target="_blank" rel="noreferrer" className="text-[11px] text-primary-600 hover:underline">✓ Ver atestado enviado</a>
                    <button type="button" onClick={() => setNovoAlunoForm(f => ({ ...f, atestado_foto: '' }))} className="text-[10px] text-red-400 hover:text-red-600">Remover</button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 cursor-pointer hover:text-primary-700 ${uploadingAtestadoFoto ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Camera size={12}/> Fotografar
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => uploadFotoAtestado(e.target.files?.[0])} />
                    </label>
                    <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-700 ${uploadingAtestadoFoto ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload size={12}/> Galeria / PDF
                      <input type="file" accept="image/*,.pdf" className="hidden"
                        onChange={e => uploadFotoAtestado(e.target.files?.[0])} />
                    </label>
                    {uploadingAtestadoFoto && <p className="text-[10px] text-slate-400 animate-pulse">Enviando...</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {novoAlunoError && (
            <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400 flex items-center gap-2">
              ⚠ {novoAlunoError}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setNovoAlunoOpen(false); setNovoAlunoMatriculas([{ turma_id: '' }]); setNovoAlunoErrors({}); setDupWarning(null); setNovoAlunoError('') }}>Cancelar</Button>
            <Button size="sm" onClick={() => salvarNovoAluno()} disabled={savingAluno}>
              {savingAluno ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Atestados (vencendo/vencidos) */}
      <Modal open={atestadosModalOpen} onClose={() => setAtestadosModalOpen(false)} title={atestadosFiltro === 'vencendo' ? 'Atestados Vencendo' : 'Atestados Vencidos'} size="lg">
        <div className="space-y-4">
          {alunosComAtestadosProblema.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum aluno encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {alunosComAtestadosProblema.map(({ aluno, atestado }) => (
                <div key={atestado.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                  atestadosFiltro === 'vencendo'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                }`}>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${atestadosFiltro === 'vencendo' ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                      {aluno.nome}
                    </p>
                    <p className={`text-xs ${atestadosFiltro === 'vencendo' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      Validade: {formatDate(atestado.data_validade)}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/alunos?turma_id=${alunos.find(a => a.id === atestado.aluno_id)?.turma_id}`)}
                    className="text-xs px-2 py-1 rounded bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                  >
                    Ver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Editar Funcionário (clicou no card Equipe do polo) */}
      <EditarFuncionarioModal
        open={editFuncOpen}
        onClose={() => setEditFuncOpen(false)}
        form={editFuncForm}
        setForm={setEditFuncForm}
        onSave={handleSaveFunc}
        saving={editFuncSaving}
        cargos={getAllowedCargos()}
        polos={polos}
        turmas={turmas}
      />

      {/* Modal: Novo Funcionário (polo pré-preenchido) */}
      <NovoFuncionarioModal
        open={novoFuncOpen}
        onClose={() => { if (!criandoFunc) setNovoFuncOpen(false) }}
        form={novoFuncForm}
        setForm={setNovoFuncForm}
        onSave={handleCreateFunc}
        creating={criandoFunc}
        error={funcError}
        success={funcSuccess}
        cargos={isAdmin ? ['admin', 'coordenador', 'professor', 'estagiario']
          : atribuicoes.some(a => a.usuario_id === profile?.id && a.polo_id === id && a.cargo === 'coordenador')
            ? ['coordenador', 'professor', 'estagiario']
            : ['professor', 'estagiario']}
        polos={polos}
        turmas={turmas}
        prePoloId={id}
      />

      <ConfirmDialog
        open={!!deletandoViagem}
        title="Excluir viagem"
        message={`Tem certeza que deseja excluir a viagem para ${deletandoViagem?.destino}?`}
        confirmLabel="Excluir"
        onConfirm={deletarViagem}
        onCancel={() => setDeletandoViagem(null)}
        danger
      />

      <ConfirmDialog
        open={!!deleteTurmaTarget}
        title="Excluir turma"
        message={`Tem certeza que deseja excluir a turma de ${deleteTurmaTarget?.modalidades?.nome ?? 'esta modalidade'}? Os alunos vinculados perderão a turma mas não serão deletados.`}
        confirmLabel={deletingTurma ? 'Excluindo...' : 'Excluir'}
        onConfirm={handleDeleteTurma}
        onCancel={() => setDeleteTurmaTarget(null)}
        danger
      />

      <ConfirmDialog
        open={!!dupWarning}
        title="Aluno já cadastrado no sistema"
        description={`"${dupWarning?.aluno?.nome}" já está cadastrado (mesmo CPF)${dupWarning?.turma ? ` na modalidade ${dupWarning.turma.modalidades?.nome ?? 'turma'}` : ''}. Deseja matriculá-lo na turma selecionada sem criar um novo cadastro?`}
        confirmLabel="Matricular na turma"
        confirmVariant="primary"
        onConfirm={() => { setDupWarning(null); salvarNovoAluno(true) }}
        onClose={() => setDupWarning(null)}
      />

      {/* Modal: Editar Aluno (aba Alunos) */}
      <Modal open={editAlunoOpen} onClose={() => setEditAlunoOpen(false)} title="Editar Aluno" size="lg">
        <div className="space-y-3">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nome *</label>
            <input type="text" value={editAlunoForm.nome} onChange={e => setEditAlunoForm(f => ({ ...f, nome: e.target.value }))}
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${editAlunoErrors.nome ? 'border-red-400' : 'border-slate-200 dark:border-navy-600'}`} />
            {editAlunoErrors.nome && <p className="text-[10px] text-red-500 mt-1">{editAlunoErrors.nome}</p>}
          </div>

          {/* Turmas (multi) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Turmas *</label>
            <div className="space-y-2">
              {editAlunoMatriculas.map((m, idx) => {
                const selecionadas = new Set(editAlunoMatriculas.map(x => x.turma_id).filter(Boolean))
                return (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={m.turma_id}
                      onChange={e => setEditAlunoMatriculas(prev => prev.map((x, i) => i === idx ? { turma_id: e.target.value } : x))}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${editAlunoErrors.turma_id && idx === 0 ? 'border-red-400' : 'border-slate-200 dark:border-navy-600'}`}
                    >
                      <option value="">Selecione uma turma...</option>
                      {turmasPolo.filter(t => t.status === 'Ativa' && (!selecionadas.has(t.id) || t.id === m.turma_id)).sort((a, b) => (a.modalidades?.nome ?? '').localeCompare(b.modalidades?.nome ?? '', 'pt-BR')).map(t => (
                        <option key={t.id} value={t.id}>{t.modalidades?.emoji} {t.modalidades?.nome} · {t.dias?.join('/')} {t.horario?.slice(0, 5)} ({t.faixa})</option>
                      ))}
                    </select>
                    {editAlunoMatriculas.length > 1 && (
                      <button type="button" onClick={() => setEditAlunoMatriculas(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                    )}
                  </div>
                )
              })}
            </div>
            {editAlunoErrors.turma_id && <p className="text-[10px] text-red-500 mt-1">{editAlunoErrors.turma_id}</p>}
            {editAlunoMatriculas.every(m => m.turma_id) && editAlunoMatriculas.length < turmasPolo.filter(t => t.status === 'Ativa').length && (
              <button type="button" onClick={() => setEditAlunoMatriculas(prev => [...prev, { turma_id: '' }])}
                className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium">+ Adicionar outra turma neste polo</button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Data de nascimento */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data de Nascimento</label>
              <input type="date" value={editAlunoForm.data_nasc} onChange={e => setEditAlunoForm(f => ({ ...f, data_nasc: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${editAlunoErrors.data_nasc ? 'border-red-400' : 'border-slate-200 dark:border-navy-600'}`} />
              {editAlunoErrors.data_nasc && <p className="text-[10px] text-red-500 mt-1">{editAlunoErrors.data_nasc}</p>}
            </div>
            {/* Gênero */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Gênero</label>
              <select value={editAlunoForm.genero} onChange={e => setEditAlunoForm(f => ({ ...f, genero: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Não informado</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* CPF */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">CPF</label>
              <input type="text" value={editAlunoForm.cpf} onChange={e => setEditAlunoForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Status</label>
              <select value={editAlunoForm.status} onChange={e => setEditAlunoForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>Ativo</option>
                <option>Inativo</option>
                <option>Pendente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Telefone */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Telefone</label>
              <input type="tel" value={editAlunoForm.telefone} onChange={e => setEditAlunoForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(21) 9 9999-9999"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            {/* Telefone Emergência */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Telefone Emergência</label>
              <input type="tel" value={editAlunoForm.telefone_emergencia} onChange={e => setEditAlunoForm(f => ({ ...f, telefone_emergencia: e.target.value }))} placeholder="(21) 9 9999-9999"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">E-mail</label>
            <input type="email" value={editAlunoForm.email} onChange={e => setEditAlunoForm(f => ({ ...f, email: e.target.value }))} placeholder="aluno@email.com"
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${editAlunoErrors.email ? 'border-red-400' : 'border-slate-200 dark:border-navy-600'}`} />
            {editAlunoErrors.email && <p className="text-[10px] text-red-500 mt-1">{editAlunoErrors.email}</p>}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditAlunoOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarEditAluno} disabled={savingEditAluno}>
              <Save size={13} /> {savingEditAluno ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm: Excluir Aluno */}
      <ConfirmDialog
        open={!!deleteAlunoTarget}
        title="Excluir aluno"
        message={`Tem certeza que deseja excluir ${deleteAlunoTarget?.nome}? Todas as presenças e atestados serão removidos permanentemente.`}
        confirmLabel={deletingAluno ? 'Excluindo...' : 'Excluir'}
        onConfirm={deletarAluno}
        onCancel={() => setDeleteAlunoTarget(null)}
        danger
      />

      {/* Modal: Visualizar como */}
      <Modal open={viewAsOpen} onClose={() => setViewAsOpen(false)} title="👁 Visualizar como">
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecione um funcionário para ver o sistema exatamente como ele vê — turmas, alunos e chamadas filtradas pela atribuição dele.
          </p>
          {viewAs && (
            <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-2">
              <Eye size={13} className="text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                Ativo: <strong>{viewAs.nome}</strong>
              </span>
              <button onClick={() => { setViewAs(null); setViewAsOpen(false) }} className="ml-auto text-xs text-violet-500 hover:text-violet-700 font-medium">
                Remover
              </button>
            </div>
          )}
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {equipe.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum funcionário encontrado neste polo.</p>
            )}
            {equipe.map(m => {
              const isSelected = viewAs?.id === m.id
              const turmasDoMembro = atribuicoes.filter(a => a.usuario_id === m.id && a.turma_id)
              const qtdTurmas = new Set(turmasDoMembro.map(a => a.turma_id)).size
              return (
                <button
                  key={m.id}
                  onClick={() => { setViewAs({ id: m.id, nome: m.nome, cargo: m.cargo }); setViewAsOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-600'
                      : 'hover:bg-slate-50 dark:hover:bg-navy-700 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-700 dark:text-primary-400">{m.nome?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy-900 dark:text-white truncate">{m.nome}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{m.cargo} · {qtdTurmas} turma{qtdTurmas !== 1 ? 's' : ''} neste polo</p>
                  </div>
                  {isSelected && <CheckCircle2 size={15} className="text-violet-600 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

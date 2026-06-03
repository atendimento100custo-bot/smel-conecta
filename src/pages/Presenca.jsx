// src/pages/Presenca.jsx
import { useState, useEffect, useCallback } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logAcao } from '../lib/auditLog'
import { useSidebar } from '../contexts/SidebarContext'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import {
  Check, X, Save, Users, Clock, StopCircle, ChevronDown, ChevronUp,
  AlertCircle, ShieldCheck, PlayCircle, List, Map as MapIcon, Menu
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { usePoloCoords } from '../hooks/usePoloCoords'
import { VR_CENTER } from '../lib/voltaRedondaCoords'

// Leaflet marker icons
const mkIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const ICON_GREEN  = mkIcon('green')
const ICON_ORANGE = mkIcon('orange')
const ICON_RED    = mkIcon('red')
const ICON_GREY   = mkIcon('grey')

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayIso() { return new Date().toISOString().slice(0, 10) }
function prevDay(iso) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}
function date7daysAgoIso() {
  const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10)
}
function buildDateRange() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10))
  }
  return days
}
function fmtTime(isoTs) {
  if (!isoTs) return '—'
  return new Date(isoTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── main component ───────────────────────────────────────────────────────────
export default function Presenca() {
  const { profile, isAdmin, isCoordenador, isProfessor } = useAuth()
  const { toggle: toggleSidebar } = useSidebar()

  // ── turmas ──────────────────────────────────────────────────────────────────
  const { data: allTurmas, loading: turmasLoading } = useSupabaseData(
    'turmas', '*, modalidades(nome), polos(id,nome,bairro,tipo), profiles(nome)'
  )
  // Todos os polos do sistema (para o filtro "Todos os polos")
  const { data: allPolos } = useSupabaseData('polos')
  const [myTurmaIds, setMyTurmaIds] = useState(null)

  useEffect(() => {
    if (!profile) return
    if (isAdmin || isCoordenador) { setMyTurmaIds(null); return }
    supabase.from('atribuicoes').select('turma_id').eq('usuario_id', profile.id)
      .not('turma_id', 'is', null)
      .then(({ data }) => setMyTurmaIds((data ?? []).map(a => a.turma_id)))
  }, [profile, isAdmin, isCoordenador])

  const turmas = (() => {
    if (!profile || turmasLoading) return []
    if (isAdmin || isCoordenador) return allTurmas
    if (myTurmaIds === null) return []
    const ids = new Set(myTurmaIds ?? [])
    return allTurmas.filter(t => ids.has(t.id) || (isProfessor && t.professor_id === profile.id))
  })()

  // ── state ───────────────────────────────────────────────────────────────────
  const [dataSel,    setDataSel]    = useState(todayIso())
  const [turmaId,    setTurmaId]    = useState('')
  const [viewMode,   setViewMode]   = useState('lista') // 'lista' | 'mapa'
  const [filtroPolo, setFiltroPolo] = useState('')
  const [filtroMod,  setFiltroMod]  = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')  // '' | 'ok' | 'pendente'

  // ── chamada ─────────────────────────────────────────────────────────────────
  const [chamada,        setChamada]        = useState(null)
  const [chamadaLoading, setChamadaLoading] = useState(false)
  const [encerrando,     setEncerrando]     = useState(false)

  // ── alunos & presença ───────────────────────────────────────────────────────
  const [alunos,        setAlunos]        = useState([])
  const [alunosLoading, setAlunosLoading] = useState(false)
  const [presencaState, setPresencaState] = useState({})
  const [motivoState,   setMotivoState]   = useState({})
  const [motivoAberto,  setMotivoAberto]  = useState(null)
  const [existingIds,   setExistingIds]   = useState({})
  const [history,       setHistory]       = useState([])
  const [historyLoading,setHistoryLoading]= useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState(null)

  // ── painel ──────────────────────────────────────────────────────────────────
  const [painelData,    setPainelData]    = useState([])
  const [painelLoading, setPainelLoading] = useState(false)
  const [painelOpen,    setPainelOpen]    = useState(true)

  // ── mapa coords ─────────────────────────────────────────────────────────────
  const todosPolosUnicos = [...new Map(
    turmas.map(t => [t.polo_id, { id: t.polo_id, nome: t.polos?.nome, bairro: t.polos?.bairro, endereco: t.polos?.endereco }])
  ).values()].filter(p => p.id)
  const { coords: poloCoords } = usePoloCoords(viewMode === 'mapa' ? todosPolosUnicos : [])

  // ── derivados ────────────────────────────────────────────────────────────────
  const hoje         = todayIso()
  const dataAnterior = prevDay(dataSel)

  function isEditavel() {
    if (!dataSel) return false
    if (isAdmin) return true
    if (chamada?.encerrada_em) return false
    const diff = Math.round((new Date(hoje) - new Date(dataSel)) / 86400000)
    return diff >= 0 && diff <= 2
  }
  const editavel       = isEditavel()
  const chamadaAberta  = chamada && !chamada.encerrada_em
  const chamadaEncerrada = chamada && !!chamada.encerrada_em

  const selectedTurma    = turmas.find(t => t.id === turmaId)
  const dateRange        = buildDateRange()
  const historyMap       = {}
  for (const p of history) {
    if (!historyMap[p.aluno_id]) historyMap[p.aluno_id] = {}
    historyMap[p.aluno_id][p.data] = p.status
  }
  const alunosAtivos      = alunos.filter(a => a.status === 'Ativo')
  const totalPresentes    = alunosAtivos.filter(a => presencaState[a.id] === 'presente').length
  const totalFaltas       = alunosAtivos.filter(a => presencaState[a.id] === 'falta').length
  const totalJustificados = alunosAtivos.filter(a => presencaState[a.id] === 'justificado').length
  const totalNaoMarcados  = alunosAtivos.filter(a => !(a.id in presencaState)).length

  // ── effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!turmaId || !dataSel) { setChamada(null); return }
    let cancelled = false
    setChamadaLoading(true)
    supabase.from('chamadas').select('*').eq('turma_id', turmaId).eq('data', dataSel).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setChamada(data ?? null); setChamadaLoading(false) } })
    return () => { cancelled = true }
  }, [turmaId, dataSel])

  useEffect(() => {
    if (!turmaId || !dataSel) { setAlunos([]); setPresencaState({}); return }
    let cancelled = false
    async function load() {
      setAlunosLoading(true)
      const [{ data: alunosData }, { data: presencasData }] = await Promise.all([
        supabase.from('alunos').select('id,nome,status').eq('turma_id', turmaId).order('nome'),
        supabase.from('presencas').select('id,aluno_id,status,motivo').eq('turma_id', turmaId).eq('data', dataSel),
      ])
      if (cancelled) return
      const rows = (alunosData ?? []).sort((a, b) => {
        const aA = a.status === 'Ativo' ? 0 : 1; const bA = b.status === 'Ativo' ? 0 : 1
        return aA - bA || (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')
      })
      const pMap = {}, idMap = {}, motivoMap = {}
      for (const p of presencasData ?? []) {
        pMap[p.aluno_id] = p.status; idMap[p.aluno_id] = p.id
        if (p.motivo) motivoMap[p.aluno_id] = p.motivo
      }
      const initState = {}
      for (const a of rows) { if (a.id in pMap) initState[a.id] = pMap[a.id] }
      setAlunos(rows); setPresencaState(initState); setExistingIds(idMap)
      setMotivoState(motivoMap); setMotivoAberto(null); setAlunosLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [turmaId, dataSel])

  useEffect(() => {
    if (!turmaId) { setHistory([]); return }
    let cancelled = false
    setHistoryLoading(true)
    supabase.from('presencas').select('*').eq('turma_id', turmaId).gte('data', date7daysAgoIso())
      .then(({ data }) => { if (!cancelled) { setHistory(data ?? []); setHistoryLoading(false) } })
    return () => { cancelled = true }
  }, [turmaId])

  const loadPainel = useCallback(async () => {
    if (!profile || !turmas.length) { setPainelData([]); setPainelLoading(false); return }
    setPainelLoading(true)
    const ids = turmas.map(t => t.id)
    const { data: chamadas } = await supabase.from('chamadas').select('*')
      .in('turma_id', ids).gte('data', dataAnterior).lte('data', dataSel)
      .order('data', { ascending: false })
    const map = {}
    for (const c of chamadas ?? []) {
      if (!map[c.turma_id]) map[c.turma_id] = {}
      map[c.turma_id][c.data] = c
    }
    setPainelData(turmas.map(t => ({
      turma: t,
      hoje: map[t.id]?.[dataSel] ?? null,
      ontem: map[t.id]?.[dataAnterior] ?? null,
    })))
    setPainelLoading(false)
  }, [turmas, profile, dataSel])

  useEffect(() => { loadPainel() }, [loadPainel])

  // ── actions ──────────────────────────────────────────────────────────────────

  function toggle(alunoId, value) {
    setPresencaState(prev => ({ ...prev, [alunoId]: value }))
    if (value === 'justificado') { setMotivoAberto(alunoId) }
    else { setMotivoAberto(null); setMotivoState(prev => ({ ...prev, [alunoId]: '' })) }
  }

  async function encerrarChamada() {
    if (!chamada) return
    setEncerrando(true)
    const { data } = await supabase.from('chamadas')
      .update({ encerrada_em: new Date().toISOString(), encerrada_por: profile.id })
      .eq('id', chamada.id).select('*').single()
    if (data) setChamada(data)
    setEncerrando(false)
  }

  async function handleSave() {
    if (!turmaId || !dataSel || alunos.length === 0) return
    const touched = alunos.filter(a => a.id in presencaState)
    if (!touched.length) {
      setSaveMsg({ type: 'error', text: 'Marque ao menos um aluno antes de salvar.' })
      setTimeout(() => setSaveMsg(null), 3000); return
    }
    setSaving(true); setSaveMsg(null)
    let chamadaAtual = chamada
    if (!chamadaAtual) {
      const { data: novaChamada, error: errChamada } = await supabase.from('chamadas')
        .insert({ turma_id: turmaId, data: dataSel, iniciada_por: profile.id }).select('*').single()
      if (errChamada) {
        setSaving(false)
        setSaveMsg({ type: 'error', text: 'Não foi possível registrar a chamada. Verifique sua internet.' })
        return
      }
      chamadaAtual = novaChamada; setChamada(novaChamada)
    }
    const { data: latestPresencas } = await supabase.from('presencas')
      .select('id,aluno_id').eq('turma_id', turmaId).eq('data', dataSel)
    const latestIds = {}
    for (const p of latestPresencas ?? []) latestIds[p.aluno_id] = p.id
    const errors = []; const newIds = { ...latestIds }
    for (const aluno of touched) {
      const val = presencaState[aluno.id]
      const motivo = val === 'justificado' ? (motivoState[aluno.id] ?? null) : null
      const rowId = latestIds[aluno.id]
      if (rowId) {
        const { error } = await supabase.from('presencas')
          .update({ status: val, motivo, registrado_por: profile.id }).eq('id', rowId)
        if (error) errors.push(error)
      } else {
        const { data: inserted, error } = await supabase.from('presencas')
          .insert({ turma_id: turmaId, aluno_id: aluno.id, registrado_por: profile.id, data: dataSel, status: val, motivo })
          .select('id').single()
        if (error) errors.push(error); else if (inserted) newIds[aluno.id] = inserted.id
      }
    }
    setExistingIds(prev => ({ ...prev, ...newIds }))
    const presentesCount = alunosAtivos.filter(a => presencaState[a.id] === 'presente').length
    const justifCount    = alunosAtivos.filter(a => presencaState[a.id] === 'justificado').length
    const freq = alunosAtivos.length > 0 ? Math.round(((presentesCount + justifCount) / alunosAtivos.length) * 100) : 0
    if (chamadaAtual?.id) {
      const { data: updChamada } = await supabase.from('chamadas')
        .update({ frequencia_pct: freq, total_presentes: presentesCount, total_alunos: alunosAtivos.length })
        .eq('id', chamadaAtual.id).select('*').single()
      if (updChamada) setChamada(updChamada)
    }
    logAcao?.({ acao: 'registro_presenca', perfil: profile, turma: selectedTurma,
      detalhes: `${presentesCount}P / ${alunosAtivos.length} — ${freq}% · ${dataSel} · ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` })
    setSaving(false)
    if (errors.length) {
      setSaveMsg({ type: 'error', text: `Não conseguimos salvar ${errors.length} registro(s). Tente novamente.` })
    } else {
      const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      setSaveMsg({ type: 'success', text: `✅ Salvo às ${agora} — ${presentesCount} presentes · ${freq}% frequência` })
      const { data: histData } = await supabase.from('presencas').select('*')
        .eq('turma_id', turmaId).gte('data', date7daysAgoIso())
      setHistory(histData ?? [])
      loadPainel()
      setTimeout(() => setSaveMsg(null), 6000)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Derivados para o painel
  // Lista TODOS os polos do sistema (não só os com turma) — para o filtro
  const todosPolosFiltro = (allPolos ?? [])
    .map(p => ({ id: p.id, bairro: p.bairro, nome: p.nome, tipo: p.tipo }))
    .sort((a, b) => (a.bairro ?? a.nome ?? '').localeCompare(b.bairro ?? b.nome ?? '', 'pt-BR'))

  const todasMods = [...new Set(painelData.map(({ turma }) => turma.modalidades?.nome ?? 'Sem modalidade'))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const dadosFiltrados = painelData.filter(({ turma, hoje: hj }) => {
    if (filtroPolo && turma.polo_id !== filtroPolo) return false
    if (filtroMod && (turma.modalidades?.nome ?? '') !== filtroMod) return false
    if (filtroStatus === 'ok' && !hj) return false
    if (filtroStatus === 'pendente' && hj) return false
    return true
  })
  const pendentesHoje = painelData.filter(({ hoje: hj }) => !hj).length
  const temFiltro = filtroPolo || filtroMod || filtroStatus

  const porPolo = {}
  for (const item of dadosFiltrados) {
    const poloId   = item.turma.polo_id ?? 'sem-polo'
    const poloBairro = item.turma.polos?.bairro ?? item.turma.polos?.nome ?? 'Sem polo'
    const poloNome = item.turma.polos?.nome ?? 'Sem polo'
    const poloTipo = item.turma.polos?.tipo ?? ''
    const modNome  = item.turma.modalidades?.nome ?? 'Sem modalidade'
    if (!porPolo[poloId]) porPolo[poloId] = { bairro: poloBairro, nome: poloNome, tipo: poloTipo, mods: {} }
    if (!porPolo[poloId].mods[modNome]) porPolo[poloId].mods[modNome] = []
    porPolo[poloId].mods[modNome].push(item)
  }
  const polosOrdenados = Object.entries(porPolo).sort(([,a],[,b]) => a.bairro.localeCompare(b.bairro,'pt-BR'))

  // Status de cada polo para o mapa
  const poloStatusMap = {}
  for (const item of painelData) {
    const pid = item.turma.polo_id
    if (!poloStatusMap[pid]) poloStatusMap[pid] = { total: 0, comChamada: 0, bairro: item.turma.polos?.bairro ?? '', nome: item.turma.polos?.nome ?? '' }
    poloStatusMap[pid].total++
    if (item.hoje) poloStatusMap[pid].comChamada++
  }

  const sCls = 'text-xs border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-700 text-navy-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500'

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">

        {/* ── Seção de presença da turma selecionada ── */}
        {turmaId && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
            {/* Cabeçalho com botão fechar */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-navy-900 dark:text-white">Lista de Presença</h2>
                  <button onClick={() => setTurmaId('')}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-navy-700">
                    <X size={10}/> fechar
                  </button>
                </div>
                {selectedTurma && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    📍 {selectedTurma.polos?.bairro ?? selectedTurma.polos?.nome ?? ''}
                    {selectedTurma.modalidades?.nome && ` · ${selectedTurma.modalidades.nome}`}
                    {selectedTurma.horario && ` · ${selectedTurma.horario.slice(0,5)}`}
                    {' · '}{fmtDate(dataSel)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!chamadaLoading && chamadaAberta && (
                  <>
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <PlayCircle size={11}/> {fmtTime(chamada.iniciada_em)}
                      {chamada.frequencia_pct != null && ` · ${chamada.frequencia_pct}%`}
                    </span>
                    <button onClick={encerrarChamada} disabled={encerrando}
                      className="text-[10px] font-semibold text-slate-400 hover:text-red-500 flex items-center gap-1">
                      <StopCircle size={11}/>{encerrando ? '…' : 'Encerrar'}
                    </button>
                  </>
                )}
                {!chamadaLoading && chamadaEncerrada && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <StopCircle size={11}/> Encerrada {fmtTime(chamada.encerrada_em)}
                    {chamada.frequencia_pct != null && ` · ${chamada.frequencia_pct}%`}
                    {isAdmin && <button onClick={() => setChamada(p => ({...p, encerrada_em: null}))} className="ml-1 text-primary-500 hover:underline">reabrir</button>}
                  </span>
                )}
              </div>
            </div>

            {/* Banners */}
            {chamadaEncerrada && !isAdmin && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/40 border-b border-slate-100 text-xs text-slate-500 flex items-center gap-2">🔒 Chamada encerrada — somente leitura</div>
            )}
            {!chamadaEncerrada && !editavel && dataSel < hoje && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 text-xs text-amber-700 flex items-center gap-2">
                <Clock size={12}/> Janela de edição encerrada para esta data
              </div>
            )}
            {!chamada && !chamadaLoading && editavel && alunos.length > 0 && (
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
                <PlayCircle size={12}/> A chamada é registrada automaticamente ao salvar.
              </div>
            )}

            {/* Placar */}
            {alunos.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700 grid grid-cols-4 gap-2">
                {[
                  { val: totalPresentes,    label: '✅ Presentes', bg: 'bg-emerald-50 dark:bg-emerald-900/20', txt: 'text-emerald-600 dark:text-emerald-400' },
                  { val: totalFaltas,       label: '❌ Faltas',    bg: 'bg-red-50 dark:bg-red-900/20',         txt: 'text-red-500 dark:text-red-400' },
                  { val: totalJustificados, label: '📋 Justif.',   bg: 'bg-amber-50 dark:bg-amber-900/20',     txt: 'text-amber-500 dark:text-amber-400' },
                  { val: totalNaoMarcados,  label: '⏳ Pend.',     bg: 'bg-slate-100 dark:bg-navy-700',        txt: 'text-slate-400' },
                ].map(({ val, label, bg, txt }) => (
                  <div key={label} className={`${bg} rounded-lg p-2.5 text-center`}>
                    <div className={`text-xl font-extrabold ${txt} leading-none`}>{val}</div>
                    <div className={`text-[9px] font-bold ${txt} uppercase tracking-wide mt-1`}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista alunos */}
            {alunosLoading ? (
              <div className="p-8 text-center text-sm text-slate-400">Carregando alunos…</div>
            ) : alunos.length === 0 ? (
              <div className="p-8"><EmptyState icon={<Users size={32} className="text-slate-300"/>} title="Nenhum aluno nesta turma" description="Adicione alunos para registrar a presença." /></div>
            ) : (chamadaEncerrada && !isAdmin) || (!editavel && dataSel < hoje && alunos.some(a => a.id in presencaState)) ? (
              <ul className="divide-y divide-slate-100 dark:divide-navy-700">
                {alunos.map(a => {
                  const st = presencaState[a.id]; const mot = motivoState[a.id]
                  return (
                    <li key={a.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block">{a.nome}</span>
                        {mot && <span className="text-[10px] text-amber-600">{mot}</span>}
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        {st === 'presente'    && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 rounded-full"><Check size={11}/> Presente</span>}
                        {st === 'falta'       && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-full"><X size={11}/> Falta</span>}
                        {st === 'justificado' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1 rounded-full">📋 Justificada</span>}
                        {!st && <span className="text-xs text-slate-400 italic">Sem registro</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-navy-700">
                {alunos.map(aluno => {
                  const ativo = aluno.status === 'Ativo'
                  return (
                    <li key={aluno.id} className={`flex items-center justify-between px-4 py-3 ${ativo ? 'hover:bg-slate-50/60 dark:hover:bg-navy-700/30' : 'opacity-60 bg-slate-50/40 dark:bg-navy-900/20'}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate ${ativo ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{aluno.nome}</span>
                        {!ativo && <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{aluno.status}</span>}
                      </div>
                      {ativo ? (
                        <div className="space-y-1">
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            {[
                              { val: 'presente',    label: 'Presente', icon: <Check size={11}/>, active: 'bg-emerald-600 text-white', idle: 'bg-slate-100 dark:bg-navy-700 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700' },
                              { val: 'falta',       label: 'Falta',    icon: <X size={11}/>,     active: 'bg-red-500 text-white',     idle: 'bg-slate-100 dark:bg-navy-700 text-slate-500 hover:bg-red-50 hover:text-red-600' },
                              { val: 'justificado', label: 'Justif.',  icon: '📋',               active: 'bg-amber-500 text-white',   idle: 'bg-slate-100 dark:bg-navy-700 text-slate-500 hover:bg-amber-50 hover:text-amber-600' },
                            ].map(({ val, label, icon, active, idle }) => (
                              <button key={val} onClick={() => toggle(aluno.id, val)} disabled={!editavel}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${presencaState[aluno.id] === val ? active : idle}`}>
                                {icon} {label}
                              </button>
                            ))}
                          </div>
                          {motivoAberto === aluno.id && editavel && (
                            <input type="text" value={motivoState[aluno.id] ?? ''}
                              onChange={e => setMotivoState(p => ({ ...p, [aluno.id]: e.target.value }))}
                              placeholder="Motivo (ex: atestado médico)…"
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-900"/>
                          )}
                          {presencaState[aluno.id] === 'justificado' && motivoAberto !== aluno.id && motivoState[aluno.id] && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate">📋 {motivoState[aluno.id]}</p>
                          )}
                        </div>
                      ) : <span className="text-[10px] text-slate-400 italic">sem registro</span>}
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Rodapé salvar + histórico */}
            {alunos.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between gap-3 flex-wrap">
                {saveMsg
                  ? <span className={`text-xs font-medium flex items-center gap-1.5 ${saveMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{saveMsg.type === 'error' && <AlertCircle size={13}/>}{saveMsg.text}</span>
                  : <span/>}
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !editavel || (chamadaEncerrada && !isAdmin)}>
                  <Save size={13}/>{saving ? 'Salvando…' : 'Salvar Presença'}
                </Button>
              </div>
            )}

            {/* Histórico 7 dias */}
            {alunos.length > 0 && (
              <details className="border-t border-slate-100 dark:border-navy-700">
                <summary className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700/30 select-none">
                  Histórico — últimos 7 dias ▾
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-navy-900/40">
                        <th className="text-left px-4 py-2 font-semibold text-slate-500 w-48">Aluno</th>
                        {dateRange.map(d => (
                          <th key={d} className={`px-2 py-2 font-semibold text-center whitespace-nowrap ${d === dataSel ? 'text-primary-600' : 'text-slate-500 dark:text-slate-400'}`}>
                            {fmtDate(d)}{d === todayIso() && <span className="ml-1 text-[9px] text-primary-500 font-bold">hoje</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                      {alunos.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-navy-700/30">
                          <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[12rem]">{a.nome}</td>
                          {dateRange.map(d => {
                            const val = historyMap[a.id]?.[d]
                            return (
                              <td key={d} className="px-2 py-2 text-center">
                                {val === 'presente' ? <span className="inline-block w-4 h-4 rounded-full bg-primary-500" title="Presente"/>
                                 : val === 'falta'  ? <span className="inline-block w-4 h-4 rounded-full bg-red-400" title="Falta"/>
                                 : val === 'justificado' ? <span className="inline-block w-4 h-4 rounded-full bg-amber-400" title="Justificada"/>
                                 : <span className="inline-block w-4 h-4 rounded-full bg-slate-200 dark:bg-navy-600" title="Sem registro"/>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-700 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-primary-500"/> Presente</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-red-400"/> Falta</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-amber-400"/> Justificada</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-slate-200 dark:bg-navy-600"/> Sem registro</span>
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── Painel de Verificação (lista ou mapa) ── */}
        {turmas.length > 0 && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">

            {/* Cabeçalho do painel com data e toggle lista/mapa integrados */}
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-slate-100 dark:border-navy-700">
              <button onClick={toggleSidebar}
                className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors flex-shrink-0">
                <Menu size={17}/>
              </button>
              <button onClick={() => setPainelOpen(v => !v)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <ShieldCheck size={15} className="text-primary-500 flex-shrink-0"/>
                <span className="text-sm font-bold text-navy-900 dark:text-white truncate">
                  {isAdmin ? 'Painel de Verificação — Todos os Polos' : isCoordenador ? 'Painel de Verificação — Meus Polos' : 'Painel de Verificação — Minhas Chamadas'}
                </span>
                {pendentesHoje > 0 && (
                  <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                    ⚠️ {pendentesHoje} sem chamada
                  </span>
                )}
              </button>

              {/* Toggle Lista / Mapa */}
              <div className="flex rounded-lg border border-slate-200 dark:border-navy-600 overflow-hidden flex-shrink-0">
                <button onClick={() => setViewMode('lista')}
                  className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${viewMode === 'lista' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'}`}>
                  <List size={12}/> Lista
                </button>
                <button onClick={() => setViewMode('mapa')}
                  className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 border-l border-slate-200 dark:border-navy-600 transition-colors ${viewMode === 'mapa' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'}`}>
                  <MapIcon size={12}/> Mapa
                </button>
              </div>

              {/* Data — integrada no cabeçalho */}
              <input type="date" value={dataSel}
                onChange={e => { setDataSel(e.target.value); setSaveMsg(null) }}
                className="text-xs border border-slate-200 dark:border-navy-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-navy-700 text-navy-900 dark:text-white flex-shrink-0"/>

              <button onClick={() => setPainelOpen(v => !v)} className="flex-shrink-0">
                {painelOpen ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
              </button>
            </div>

            {painelOpen && (
              <>
                {/* Filtros */}
                <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-navy-900/30 border-b border-slate-100 dark:border-navy-700 flex items-center gap-2 flex-wrap">
                  {todosPolosFiltro.length > 1 && (
                    <select value={filtroPolo} onChange={e => setFiltroPolo(e.target.value)} className={sCls}>
                      <option value="">Todos os polos</option>
                      {todosPolosFiltro.map(p => (
                        <option key={p.id} value={p.id}>
                          📍 {p.bairro || p.nome}{p.tipo ? ` — ${p.tipo}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {todasMods.length > 1 && (
                    <select value={filtroMod} onChange={e => setFiltroMod(e.target.value)} className={sCls}>
                      <option value="">Todas as modalidades</option>
                      {todasMods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                  <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={sCls}>
                    <option value="">Todos os status</option>
                    <option value="ok">✅ Com chamada</option>
                    <option value="pendente">⚠️ Sem chamada</option>
                  </select>
                  {temFiltro && (
                    <button onClick={() => { setFiltroPolo(''); setFiltroMod(''); setFiltroStatus('') }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
                      <X size={11}/> Limpar
                    </button>
                  )}
                  <span className="ml-auto text-[10px] text-slate-400">
                    {dadosFiltrados.length} turma{dadosFiltrados.length !== 1 ? 's' : ''}{temFiltro && ` de ${painelData.length}`}
                  </span>
                </div>

                {/* Conteúdo: lista ou mapa */}
                {viewMode === 'mapa' ? (
                  <div style={{ height: '60vh' }}>
                    <MapContainer center={VR_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {Object.entries(poloStatusMap).map(([pid, ps]) => {
                        const coords = poloCoords[pid]
                        if (!coords) return null
                        const pct = ps.total > 0 ? ps.comChamada / ps.total : 0
                        const icon = pct === 1 ? ICON_GREEN : pct > 0 ? ICON_ORANGE : ICON_RED
                        return (
                          <Marker key={pid} position={coords} icon={icon}>
                            <Popup>
                              <div style={{ minWidth: 180 }}>
                                <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>📍 {ps.bairro}</p>
                                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{ps.nome}</p>
                                <p style={{ fontSize: 12, marginBottom: 4 }}>
                                  {ps.comChamada}/{ps.total} turmas com chamada em {fmtDate(dataSel)}
                                </p>
                                <p style={{ fontSize: 11, color: pct === 1 ? '#16a34a' : pct > 0 ? '#d97706' : '#dc2626' }}>
                                  {pct === 1 ? '✅ Todas registradas' : pct > 0 ? '🟡 Parcial' : '⚠️ Nenhuma registrada'}
                                </p>
                              </div>
                            </Popup>
                          </Marker>
                        )
                      })}
                    </MapContainer>
                    <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-700 flex items-center gap-4 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">🟢 Todas ok</span>
                      <span className="flex items-center gap-1">🟡 Parcial</span>
                      <span className="flex items-center gap-1">🔴 Nenhuma</span>
                    </div>
                  </div>
                ) : painelLoading ? (
                  <div className="p-6 text-center text-sm text-slate-400">Carregando…</div>
                ) : dadosFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">
                    {temFiltro ? 'Nenhuma turma para esses filtros.' : 'Nenhum dado.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-navy-700">
                    {polosOrdenados.map(([poloId, polo]) => {
                      const totalT = Object.values(polo.mods).flat().length
                      const semHj  = Object.values(polo.mods).flat().filter(({ hoje: hj }) => !hj).length
                      const comHj  = totalT - semHj
                      return (
                        <div key={poloId}>
                          {/* Polo header */}
                          <div className="px-4 py-2.5 bg-slate-50 dark:bg-navy-900/40 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold text-navy-900 dark:text-white truncate">
                                📍 {polo.bairro || polo.nome}{polo.tipo ? ` — ${polo.tipo}` : ''} <span className="font-normal text-slate-500 dark:text-slate-400 text-[10px]">— {polo.nome}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">{totalT} turma{totalT !== 1 ? 's' : ''}</span>
                              {comHj > 0 && <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">{comHj} ok</span>}
                            </div>
                            {semHj > 0 && <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">⚠️ {semHj} pendente{semHj !== 1 ? 's' : ''}</span>}
                          </div>

                          {/* Modalidades */}
                          {Object.entries(polo.mods).sort(([a],[b]) => a.localeCompare(b,'pt-BR')).map(([modNome, items]) => (
                            <div key={modNome}>
                              <div className="px-5 py-1.5 bg-slate-100/60 dark:bg-navy-800/60 border-t border-slate-100 dark:border-navy-700 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{modNome}</span>
                                <span className="text-[9px] text-slate-400">{items.length} turma{items.length !== 1 ? 's' : ''}</span>
                              </div>
                              <table className="w-full text-xs">
                                <tbody>
                                  {items.map(({ turma, hoje: hj, ontem: ont }) => (
                                    <tr key={turma.id}
                                      onClick={() => { setTurmaId(turma.id); setSaveMsg(null) }}
                                      className={`border-t border-slate-50 dark:border-navy-700/50 cursor-pointer transition-colors ${turmaId === turma.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50/60 dark:hover:bg-navy-700/20'}`}>
                                      <td className="px-6 py-2.5">
                                        <p className={`font-semibold text-[11px] ${turmaId === turma.id ? 'text-primary-700 dark:text-primary-400' : 'text-navy-900 dark:text-white'}`}>
                                          {turma.faixa ?? '—'}{turma.faixa_etaria ? ` · ${turma.faixa_etaria}` : ''}
                                          {turmaId === turma.id && <span className="ml-2 text-[9px] bg-primary-100 dark:bg-primary-900/40 text-primary-600 px-1.5 py-0.5 rounded-full">selecionada</span>}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                          {turma.dias?.join(', ') ?? '—'} · {turma.horario?.slice(0,5) ?? '—'}
                                          {turma.profiles?.nome ? ` · ${turma.profiles.nome}` : ''}
                                        </p>
                                      </td>
                                      <td className="px-3 py-2.5 text-center w-32">
                                        <p className="text-[9px] text-slate-400 mb-0.5">{fmtDate(dataSel)}</p>
                                        <ChamadaBadge chamada={hj}/>
                                      </td>
                                      <td className="px-3 py-2.5 text-center w-32">
                                        <p className="text-[9px] text-slate-400 mb-0.5">{fmtDate(dataAnterior)}</p>
                                        <ChamadaBadge chamada={ont}/>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Legenda */}
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-navy-700 flex items-center gap-4 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> Encerrada</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/> Em andamento</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-navy-600 inline-block"/> Não registrada</span>
                  {viewMode === 'lista' && <span className="ml-auto text-[10px] text-primary-500">Toque em uma turma para registrar presença</span>}
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {turmas.length === 0 && !turmasLoading && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-10">
            <EmptyState icon={<Users size={36} className="text-slate-300"/>}
              title="Nenhuma turma disponível"
              description="Você ainda não foi vinculado a nenhuma turma."/>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function ChamadaBadge({ chamada }) {
  if (!chamada) return <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-navy-600 inline-block"/> —</span>
  if (chamada.encerrada_em) return (
    <div>
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> Encerrada</span>
      {chamada.frequencia_pct != null && <p className="text-[9px] text-slate-500 mt-0.5">{chamada.frequencia_pct}% · {chamada.total_presentes}/{chamada.total_alunos}</p>}
      <p className="text-[9px] text-slate-400">{new Date(chamada.encerrada_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
    </div>
  )
  return (
    <div>
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/> Aberta</span>
      {chamada.frequencia_pct != null && <p className="text-[9px] text-slate-500 mt-0.5">{chamada.frequencia_pct}% salvo</p>}
      <p className="text-[9px] text-slate-400">{new Date(chamada.iniciada_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
    </div>
  )
}

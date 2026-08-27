// src/pages/Presenca.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMinhasChamadasSemana } from '../hooks/useMinhasChamadasSemana'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logAcao } from '../lib/auditLog'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import {
  Check, X, Save, Users, Clock, StopCircle, AlertCircle, PlayCircle, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, ClipboardList, Radar as RadarIcon,
} from 'lucide-react'
import { fmtDiaCurto } from '../lib/semana'

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayIso() { return new Date().toISOString().slice(0, 10) }
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
  const { profile, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()

  // ── minhas turmas + adesão da semana (escopado por cargo) ───────────────────
  // Pra admin, "turmas" já vem sem escopo (todas) — os mesmos dados servem
  // pro seletor de chamada E pra seção de Supervisão abaixo, sem buscar 2x.
  const {
    loading: minhasLoading, turmas, linhas, chamadasPorTurma, hoje, dias, segunda,
    pctSemana, totalFeito, totalEsperado, pendencias,
  } = useMinhasChamadasSemana()

  // Atribuições de professor por turma — fonte mais confiável que turmas.professor_id
  // (que fica desatualizado quando o vínculo é feito só em Equipe). Sem isso, turmas
  // com professor de verdade apareciam agrupadas em "Sem professor" na Supervisão.
  const { data: atribProfessores } = useSupabaseData('atribuicoes', 'turma_id,cargo,profiles(nome)')
  const professorPorTurma = {}
  for (const a of atribProfessores ?? []) {
    if (a.cargo === 'professor' && a.turma_id && a.profiles?.nome) professorPorTurma[a.turma_id] = a.profiles.nome
  }
  function nomeProfessorDaTurma(turma) {
    return professorPorTurma[turma.id] ?? turma.profiles?.nome ?? null
  }

  // ── state ───────────────────────────────────────────────────────────────────
  const [dataSel,    setDataSel]    = useState(todayIso())
  const [turmaId,    setTurmaId]    = useState(searchParams.get('turma') ?? '')
  const [filtroPolo, setFiltroPolo] = useState('')
  const [adminTab,   setAdminTab]   = useState('supervisao') // 'supervisao' | 'chamada'
  const [supervisaoView, setSupervisaoView] = useState('pendencias') // 'pendencias' | 'adesao' | 'polo'
  const [poloAberto, setPoloAberto] = useState({}) // { [poloId]: bool } — override manual do padrão (Supervisão)
  const [poloTurmaAberto, setPoloTurmaAberto] = useState({}) // idem, mas do Selecionar Turma
  const listaPresencaRef = useRef(null)

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

  // ── justificativa de ausência antecipada ────────────────────────────────────
  const [justModalAluno, setJustModalAluno] = useState(null) // aluno sendo justificado
  const [justForm,       setJustForm]       = useState({ data_inicio: '', data_fim: '', motivo: '' })
  const [savingJust,     setSavingJust]     = useState(false)

  // ── derivados ────────────────────────────────────────────────────────────────
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
  const nomesDuplos = new Set(
    alunos.map(a => (a.nome ?? '').trim().toLowerCase())
          .filter((n, _, arr) => arr.filter(x => x === n).length > 1)
  )
  // Nome amigável de cada turma — usado pra avisar "também matriculado em X"
  const turmaNomeById = {}
  for (const t of turmas ?? []) {
    turmaNomeById[t.id] = `${t.modalidades?.nome ?? 'Turma'}${t.polos?.bairro ? ' · ' + t.polos.bairro : ''}`
  }
  function outrasTurmasDoAluno(aluno) {
    const ids = new Set([aluno.turma_id, ...(aluno.aluno_turmas ?? []).map(v => v.turma_id)].filter(Boolean))
    ids.delete(turmaId)
    return [...ids].map(tid => turmaNomeById[tid]).filter(Boolean)
  }
  const alunosAtivos      = alunos.filter(a => a.status === 'Ativo')
  const totalPresentes    = alunosAtivos.filter(a => presencaState[a.id] === 'presente').length
  const totalFaltas       = alunosAtivos.filter(a => presencaState[a.id] === 'falta').length
  const totalJustificados = alunosAtivos.filter(a => presencaState[a.id] === 'justificado').length
  const totalNaoMarcados  = alunosAtivos.filter(a => !(a.id in presencaState)).length

  // Agrupamento por polo, pra listar as turmas selecionáveis
  const todosPolosFiltro = [...new Map(
    turmas.map(t => [t.polos?.id ?? t.polo_id, { id: t.polos?.id ?? t.polo_id, bairro: t.polos?.bairro, nome: t.polos?.nome, tipo: t.polos?.tipo }])
  ).values()].filter(p => p.id).sort((a, b) => (a.bairro ?? a.nome ?? '').localeCompare(b.bairro ?? b.nome ?? '', 'pt-BR'))

  const turmasFiltradas = turmas.filter(t => !filtroPolo || (t.polos?.id ?? t.polo_id) === filtroPolo)
  const porPolo = {}
  for (const t of turmasFiltradas) {
    const poloId = t.polos?.id ?? t.polo_id ?? 'sem-polo'
    const label = t.polos?.bairro ?? t.polos?.nome ?? 'Sem polo'
    if (!porPolo[poloId]) porPolo[poloId] = { label, turmas: [] }
    porPolo[poloId].turmas.push(t)
  }
  const polosOrdenados = Object.entries(porPolo).sort(([, a], [, b]) => a.label.localeCompare(b.label, 'pt-BR'))

  // ── Supervisão (só admin) — reaproveita linhas/chamadasPorTurma do hook acima ──
  const linhasHoje = linhas.map(l => ({
    ...l,
    chamadaHoje: chamadasPorTurma[l.turma.id]?.[hoje] ?? null,
    esperaHoje: l.diasEsperados.includes(hoje),
  }))

  // Adesão por professor — separada em "precisa de atenção" (pendências) vs "em dia",
  // pra não competir visualmente com quem já está tudo certo.
  const porProfessor = {}
  for (const l of linhasHoje) {
    if (l.diasEsperados.length === 0) continue // sem aula programada nesses dias — não entra na cobrança
    const nomeProf = nomeProfessorDaTurma(l.turma) ?? 'Sem professor definido'
    if (!porProfessor[nomeProf]) porProfessor[nomeProf] = { feitos: 0, esperados: 0, turmas: [] }
    porProfessor[nomeProf].feitos += l.diasFeitos.length
    porProfessor[nomeProf].esperados += l.diasEsperados.length
    porProfessor[nomeProf].turmas.push(l)
  }
  const professoresOrdenados = Object.entries(porProfessor)
    .map(([nome, v]) => ({ nome, ...v, pct: v.esperados > 0 ? Math.round(v.feitos / v.esperados * 100) : 100 }))
    .sort((a, b) => a.pct - b.pct)
  const professoresAtencao = professoresOrdenados.filter(p => p.pct < 100)
  const professoresEmDia   = professoresOrdenados.filter(p => p.pct === 100)

  const pendentesHojeAdmin = linhasHoje.filter(l => l.esperaHoje && !l.chamadaHoje)
  const pendentesOrdenados = [...pendentesHojeAdmin].sort((a, b) => {
    const la = a.turma.polos?.bairro ?? a.turma.polos?.nome ?? ''
    const lb = b.turma.polos?.bairro ?? b.turma.polos?.nome ?? ''
    return la.localeCompare(lb, 'pt-BR') || (a.turma.modalidades?.nome ?? '').localeCompare(b.turma.modalidades?.nome ?? '', 'pt-BR')
  })

  // Detalhe por turma — agrupado por polo, colapsável (aba "Detalhe por polo").
  const detalhePorPolo = {}
  for (const l of linhasHoje) {
    const poloId = l.turma.polos?.id ?? l.turma.polo_id ?? 'sem-polo'
    const label = l.turma.polos?.bairro ?? l.turma.polos?.nome ?? 'Sem polo'
    if (!detalhePorPolo[poloId]) detalhePorPolo[poloId] = { label, linhas: [] }
    detalhePorPolo[poloId].linhas.push(l)
  }
  const detalhePorPoloOrdenado = Object.entries(detalhePorPolo).sort(([, a], [, b]) => a.label.localeCompare(b.label, 'pt-BR'))
  function poloEstaAberto(poloId, temPendencia) {
    return poloAberto[poloId] ?? temPendencia
  }

  // ── effects ──────────────────────────────────────────────────────────────────

  // Rola até a Lista de Presença assim que uma turma é escolhida — sem isso,
  // a seleção só aparecia lá embaixo (onde a lista de turmas fica) e dava a
  // impressão de que o clique não tinha feito nada, até rolar manualmente.
  useEffect(() => {
    if (!turmaId) return
    listaPresencaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [turmaId])

  useEffect(() => {
    if (!turmaId || !dataSel) { setChamada(null); return }
    let cancelled = false
    setChamadaLoading(true)
    supabase.from('chamadas').select('*').eq('turma_id', turmaId).eq('data', dataSel).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setChamada(data ?? null); setChamadaLoading(false) } })
    return () => { cancelled = true }
  }, [turmaId, dataSel])

  const carregarAlunosEChamada = useCallback(async ({ cancelledRef } = {}) => {
    if (!turmaId || !dataSel) { setAlunos([]); setPresencaState({}); return }
    setAlunosLoading(true)
    // Um aluno pode estar matriculado nesta turma como "turma principal" (alunos.turma_id)
    // ou como matrícula extra (aluno_turmas) — ex: aluno que faz Corrida E Funcional.
    // Sem isso, quem só está vinculado via aluno_turmas sumia da chamada dessa turma.
    const { data: vinculos } = await supabase.from('aluno_turmas').select('aluno_id').eq('turma_id', turmaId)
    const extraIds = (vinculos ?? []).map(v => v.aluno_id)
    const alunosQuery = extraIds.length > 0
      ? supabase.from('alunos').select('id,nome,status,turma_id,aluno_turmas(turma_id)').or(`turma_id.eq.${turmaId},id.in.(${extraIds.join(',')})`).order('nome')
      : supabase.from('alunos').select('id,nome,status,turma_id,aluno_turmas(turma_id)').eq('turma_id', turmaId).order('nome')
    const [{ data: alunosData }, { data: presencasData }] = await Promise.all([
      alunosQuery,
      supabase.from('presencas').select('id,aluno_id,status,motivo').eq('turma_id', turmaId).eq('data', dataSel),
    ])
    if (cancelledRef?.current) return
    const rows = (alunosData ?? []).sort((a, b) => {
      const aA = a.status === 'Ativo' ? 0 : 1; const bA = b.status === 'Ativo' ? 0 : 1
      return aA - bA || (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')
    })
    const alunoIds = rows.map(a => a.id)
    const pMap = {}, idMap = {}, motivoMap = {}
    for (const p of presencasData ?? []) {
      pMap[p.aluno_id] = p.status; idMap[p.aluno_id] = p.id
      if (p.motivo) motivoMap[p.aluno_id] = p.motivo
    }

    // Duas fontes de "isso não deveria virar falta":
    // 1) justificativa cadastrada com antecedência (aluno/responsável avisou, com motivo e período)
    // 2) presença já registrada em OUTRA turma do aluno no mesmo dia (matrícula dupla —
    //    ele foi na outra modalidade hoje, não deveria levar falta nesta)
    let justifMap = {}, outraTurmaSet = new Set()
    if (alunoIds.length > 0) {
      const [{ data: justifs }, { data: outrasPresencas }] = await Promise.all([
        supabase.from('justificativas_ausencia').select('aluno_id,motivo')
          .in('aluno_id', alunoIds).lte('data_inicio', dataSel).gte('data_fim', dataSel),
        supabase.from('presencas').select('aluno_id')
          .in('aluno_id', alunoIds).eq('data', dataSel).neq('turma_id', turmaId).in('status', ['presente', 'justificado']),
      ])
      for (const j of justifs ?? []) justifMap[j.aluno_id] = j.motivo
      for (const p of outrasPresencas ?? []) outraTurmaSet.add(p.aluno_id)
    }
    if (cancelledRef?.current) return

    const initState = {}, initMotivo = { ...motivoMap }
    for (const a of rows) {
      if (a.id in pMap) { initState[a.id] = pMap[a.id]; continue } // já tem registro salvo — respeita
      if (justifMap[a.id]) {
        initState[a.id] = 'justificado'
        initMotivo[a.id] = `📅 Ausência avisada: ${justifMap[a.id]}`
      } else if (outraTurmaSet.has(a.id)) {
        initState[a.id] = 'justificado'
        initMotivo[a.id] = '🔀 Presente em outra turma hoje'
      }
    }
    setAlunos(rows); setPresencaState(initState); setExistingIds(idMap)
    setMotivoState(initMotivo); setMotivoAberto(null); setAlunosLoading(false)
  }, [turmaId, dataSel])

  useEffect(() => {
    const cancelledRef = { current: false }
    carregarAlunosEChamada({ cancelledRef })
    return () => { cancelledRef.current = true }
  }, [carregarAlunosEChamada])

  useEffect(() => {
    if (!turmaId) { setHistory([]); return }
    let cancelled = false
    setHistoryLoading(true)
    supabase.from('presencas').select('*').eq('turma_id', turmaId).gte('data', date7daysAgoIso())
      .then(({ data }) => { if (!cancelled) { setHistory(data ?? []); setHistoryLoading(false) } })
    return () => { cancelled = true }
  }, [turmaId])

  // ── actions ──────────────────────────────────────────────────────────────────

  function abrirJustificar(aluno) {
    setJustForm({ data_inicio: dataSel, data_fim: dataSel, motivo: '' })
    setJustModalAluno(aluno)
  }

  async function salvarJustificativa() {
    if (!justModalAluno || !justForm.data_inicio || !justForm.data_fim || !justForm.motivo.trim()) return
    setSavingJust(true)
    const { error } = await supabase.from('justificativas_ausencia').insert({
      aluno_id: justModalAluno.id,
      data_inicio: justForm.data_inicio,
      data_fim: justForm.data_fim,
      motivo: justForm.motivo.trim(),
      criado_por: profile?.id ?? null,
    })
    setSavingJust(false)
    if (!error) {
      setJustModalAluno(null)
      carregarAlunosEChamada({ cancelledRef: { current: false } })
    }
  }

  // Salva no banco assim que o aluno é tocado — não espera o "Salvar Presença"
  // no fim. Resolve perder a chamada inteira se o celular travar/desligar no
  // meio (cada toque já fica gravado no instante em que acontece).
  async function toggle(alunoId, value) {
    setPresencaState(prev => ({ ...prev, [alunoId]: value }))
    if (value === 'justificado') { setMotivoAberto(alunoId) }
    else { setMotivoAberto(null); setMotivoState(prev => ({ ...prev, [alunoId]: '' })) }

    if (!turmaId || !dataSel) return
    let chamadaAtual = chamada
    if (!chamadaAtual) {
      const { data: nova, error: errChamada } = await supabase.from('chamadas')
        .insert({ turma_id: turmaId, data: dataSel, iniciada_por: profile.id }).select('*').single()
      if (!errChamada && nova) { chamadaAtual = nova; setChamada(nova) }
      else if (errChamada?.code === '23505') {
        const { data: ex } = await supabase.from('chamadas').select('*').eq('turma_id', turmaId).eq('data', dataSel).single()
        if (ex) { chamadaAtual = ex; setChamada(ex) }
      }
    }
    const { error } = await supabase.from('presencas').upsert({
      turma_id: turmaId, aluno_id: alunoId, data: dataSel, status: value,
      motivo: value === 'justificado' ? (motivoState[alunoId] ?? null) : null,
      registrado_por: profile.id,
    }, { onConflict: 'turma_id,aluno_id,data' })
    if (error) setSaveMsg({ type: 'error', text: 'Não deu pra salvar esse aluno agora. Confira sua internet e toque nele de novo.' })
  }

  // "Marcar todos presentes" / "Limpar" — pra não precisar tocar aluno por
  // aluno numa turma grande. Só mexe nos alunos ativos, salva tudo de uma vez.
  // "Limpar" apaga o registro (volta pra "Pendente"), não marca falta —
  // marcar falta em massa por engano seria pior que ficar sem registro.
  async function marcarTodosPresenca(status) {
    const alvo = alunosAtivos
    if (!alvo.length || !turmaId || !dataSel) return

    if (status === 'limpar') {
      setPresencaState(prev => { const n = { ...prev }; alvo.forEach(a => { delete n[a.id] }); return n })
      const { error } = await supabase.from('presencas').delete()
        .eq('turma_id', turmaId).eq('data', dataSel).in('aluno_id', alvo.map(a => a.id))
      if (error) setSaveMsg({ type: 'error', text: 'Não deu pra limpar a lista agora. Confira sua internet e tente de novo.' })
      return
    }

    setPresencaState(prev => { const n = { ...prev }; alvo.forEach(a => { n[a.id] = status }); return n })
    let chamadaAtual = chamada
    if (!chamadaAtual) {
      const { data: nova, error: errChamada } = await supabase.from('chamadas')
        .insert({ turma_id: turmaId, data: dataSel, iniciada_por: profile.id }).select('*').single()
      if (!errChamada && nova) { chamadaAtual = nova; setChamada(nova) }
    }
    const { error } = await supabase.from('presencas').upsert(
      alvo.map(a => ({ turma_id: turmaId, aluno_id: a.id, data: dataSel, status, motivo: null, registrado_por: profile.id })),
      { onConflict: 'turma_id,aluno_id,data' }
    )
    if (error) setSaveMsg({ type: 'error', text: 'Não deu pra salvar a lista inteira agora. Confira sua internet e tente de novo.' })
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
      setTimeout(() => setSaveMsg(null), 6000)
    }
  }

  const sCls = 'text-xs border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-700 text-navy-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500'

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Frequência" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">

        {/* ── Sub-abas — só admin: Supervisão (visão geral) vs Chamada (fazer a chamada) ── */}
        {isAdmin && (
          <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl w-fit">
            <button onClick={() => setAdminTab('supervisao')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${adminTab === 'supervisao' ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-navy-700'}`}>
              <RadarIcon size={13} /> Supervisão
              {pendentesHojeAdmin.length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${adminTab === 'supervisao' ? 'bg-white/25' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                  {pendentesHojeAdmin.length}
                </span>
              )}
            </button>
            <button onClick={() => setAdminTab('chamada')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${adminTab === 'chamada' ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-navy-700'}`}>
              <ClipboardList size={13} /> Chamada
            </button>
          </div>
        )}

        {/* ── Supervisão — só admin: visão de quem fez/não fez chamada ── */}
        {isAdmin && adminTab === 'supervisao' && !minhasLoading && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Semana atual ({fmtDiaCurto(segunda)} — {fmtDiaCurto(hoje)}) · considera só os dias com aula programada.
            </p>

            {/* Resumo de hoje — uma faixa só (não 3 caixas competindo) */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 flex divide-x divide-slate-100 dark:divide-navy-700">
              <div className="flex-1 px-5 py-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Turmas com aula hoje</p>
                <p className="text-3xl font-extrabold text-navy-900 dark:text-white leading-none">{linhasHoje.filter(l => l.esperaHoje).length}</p>
              </div>
              <div className="flex-1 px-5 py-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Já fizeram chamada</p>
                <p className="text-3xl font-extrabold text-emerald-600 leading-none">{linhasHoje.filter(l => l.esperaHoje && l.chamadaHoje).length}</p>
              </div>
              <button onClick={() => setSupervisaoView('pendencias')}
                className="flex-1 px-5 py-4 text-left hover:bg-red-50/40 dark:hover:bg-red-900/10 rounded-r-xl transition-colors">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Ainda não fizeram</p>
                <p className="text-3xl font-extrabold text-red-500 leading-none">{pendentesHojeAdmin.length}</p>
              </button>
            </div>

            {/* Sub-visões — uma coisa de cada vez, em vez de tudo empilhado */}
            <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl w-fit">
              {[
                { key: 'pendencias', label: 'Pendências', count: pendentesHojeAdmin.length },
                { key: 'adesao',     label: 'Adesão por professor', count: 0 },
                { key: 'polo',       label: 'Detalhe por polo', count: 0 },
              ].map(t => (
                <button key={t.key} onClick={() => setSupervisaoView(t.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${supervisaoView === t.key ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-navy-700'}`}>
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${supervisaoView === t.key ? 'bg-white/25' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Pendências — lista enxuta com ação direta */}
            {supervisaoView === 'pendencias' && (
              <div className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
                {pendentesOrdenados.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-2xl mb-1">🎉</p>
                    <p className="text-sm font-semibold text-emerald-600">Tudo em dia — nenhuma turma pendente hoje.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-navy-700">
                    {pendentesOrdenados.map(l => (
                      <li key={l.turma.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-700/30">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-navy-900 dark:text-white truncate">
                            {l.turma.modalidades?.nome ?? 'Turma'} · {l.turma.faixa}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            📍 {l.turma.polos?.bairro ?? l.turma.polos?.nome ?? '—'} · {nomeProfessorDaTurma(l.turma) ?? 'Sem professor definido'}
                          </p>
                        </div>
                        <button onClick={() => { setTurmaId(l.turma.id); setAdminTab('chamada'); setFiltroPolo('') }}
                          className="flex-shrink-0 text-[11px] font-semibold text-primary-600 hover:text-primary-700 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-2.5 py-1.5 rounded-lg transition-colors">
                          Fazer chamada →
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Adesão por professor — quem precisa de atenção primeiro, quem já está em dia fica compacto */}
            {supervisaoView === 'adesao' && (
              <div className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
                {professoresOrdenados.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma turma com aula programada nesta semana.</p>
                ) : (
                  <>
                    {professoresAtencao.length > 0 && (
                      <div className="divide-y divide-slate-100 dark:divide-navy-700">
                        {professoresAtencao.map(p => (
                          <div key={p.nome} className="px-4 py-3.5">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs font-semibold text-navy-900 dark:text-white">{p.nome}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              }`}>{p.feitos}/{p.esperados} · {p.pct}%</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {p.turmas.filter(l => l.pendente > 0).map(l => (
                                <span key={l.turma.id} className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                  <AlertTriangle size={10} />
                                  {l.turma.modalidades?.nome ?? '—'} · {l.turma.polos?.bairro ?? l.turma.polos?.nome ?? '—'} ({l.pendente} pendente{l.pendente > 1 ? 's' : ''})
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {professoresEmDia.length > 0 && (
                      <details className="border-t border-slate-100 dark:border-navy-700" open={professoresAtencao.length === 0}>
                        <summary className="px-4 py-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer select-none flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-navy-700/30">
                          <CheckCircle2 size={12} /> {professoresEmDia.length} professor{professoresEmDia.length > 1 ? 'es' : ''} em dia
                        </summary>
                        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                          {professoresEmDia.map(p => (
                            <span key={p.nome} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                              {p.nome} · {p.feitos}/{p.esperados}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Detalhe por polo — grade semanal completa, agrupada e colapsável */}
            {supervisaoView === 'polo' && (
              <div className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
                {detalhePorPoloOrdenado.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma turma cadastrada.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-navy-700">
                    {detalhePorPoloOrdenado.map(([poloId, polo]) => {
                      const temPendencia = polo.linhas.some(l => l.pendente > 0)
                      const aberto = poloEstaAberto(poloId, temPendencia)
                      return (
                        <div key={poloId}>
                          <button onClick={() => setPoloAberto(p => ({ ...p, [poloId]: !aberto }))}
                            className="w-full px-4 py-2.5 flex items-center gap-2 bg-slate-50/60 dark:bg-navy-900/30 hover:bg-slate-100 dark:hover:bg-navy-900/50 transition-colors">
                            <span className="text-xs font-bold text-navy-900 dark:text-white flex-1 text-left">📍 {polo.label}</span>
                            <span className="text-[10px] text-slate-400">{polo.linhas.length} turma{polo.linhas.length !== 1 ? 's' : ''}</span>
                            {temPendencia && (
                              <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                                {polo.linhas.filter(l => l.pendente > 0).length} pendente{polo.linhas.filter(l => l.pendente > 0).length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {aberto ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                          </button>
                          {aberto && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-50/60 dark:bg-navy-900/20">
                                    <th className="text-left px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">Turma</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Professor</th>
                                    {dias.map(d => (
                                      <th key={d} className={`px-2 py-2 font-semibold text-center whitespace-nowrap ${d === hoje ? 'text-primary-600' : 'text-slate-500'}`}>{fmtDiaCurto(d)}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-navy-700/50">
                                  {polo.linhas.map(l => (
                                    <tr key={l.turma.id} onClick={() => { setTurmaId(l.turma.id); setAdminTab('chamada'); setFiltroPolo('') }}
                                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700/30 transition-colors">
                                      <td className="px-4 py-2 font-medium text-navy-900 dark:text-white whitespace-nowrap">{l.turma.modalidades?.nome ?? '—'} · {l.turma.faixa}</td>
                                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{nomeProfessorDaTurma(l.turma) ?? '—'}</td>
                                      {dias.map(d => {
                                        const esperado = l.diasEsperados.includes(d)
                                        const feito = !!chamadasPorTurma[l.turma.id]?.[d]
                                        return (
                                          <td key={d} className="px-2 py-2 text-center">
                                            {!esperado ? <span className="text-slate-200 dark:text-navy-700">—</span>
                                              : feito ? <CheckCircle2 size={13} className="inline text-emerald-500" />
                                              : <AlertTriangle size={13} className="inline text-red-400" />}
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
        )}

        {/* ── Chamada — não-admin sempre; admin só na sub-aba "Chamada" ── */}
        {(!isAdmin || adminTab === 'chamada') && (
        <>
        {/* ── Resumo pessoal da semana — professor, estagiário e coordenador ── */}
        {!isAdmin && !minhasLoading && turmas.length > 0 && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-navy-900 dark:text-white">Sua semana</p>
              <span className={`text-xs font-extrabold ${pctSemana === 100 ? 'text-emerald-600' : pctSemana >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                {totalFeito}/{totalEsperado} · {pctSemana}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full ${pctSemana === 100 ? 'bg-emerald-500' : pctSemana >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${pctSemana}%` }} />
            </div>
            {pendencias.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pendencias.map(l => (
                  <span key={l.turma.id} className="text-[10px] px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle size={10} /> {l.turma.modalidades?.nome ?? '—'} ({l.pendente} pendente{l.pendente > 1 ? 's' : ''})
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Tudo em dia essa semana.</p>
            )}
          </div>
        )}

        {/* ── Seção de presença da turma selecionada ── */}
        {turmaId && (
          <div ref={listaPresencaRef} className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 scroll-mt-4">
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
                <input type="date" value={dataSel}
                  onChange={e => { setDataSel(e.target.value); setSaveMsg(null) }}
                  className={sCls}/>
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

            {/* Ações em massa — evita tocar aluno por aluno em turma grande */}
            {alunos.length > 0 && editavel && (
              <div className="px-4 py-2 border-b border-slate-100 dark:border-navy-700 flex gap-2">
                <button onClick={() => marcarTodosPresenca('presente')}
                  className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                  ✅ Marcar todos presentes
                </button>
                <button onClick={() => marcarTodosPresenca('limpar')}
                  className="text-[10px] font-semibold text-slate-500 hover:text-red-500 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-navy-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  🧹 Limpar presença
                </button>
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
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block">
                          {a.nome}
                          {nomesDuplos.has((a.nome ?? '').trim().toLowerCase()) && (
                            <span className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded" title="Há outro aluno com o mesmo nome nesta turma">⚠️ Nome repetido</span>
                          )}
                        </span>
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
                      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                        <span className={`text-sm font-medium truncate ${ativo ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{aluno.nome}</span>
                        {nomesDuplos.has((aluno.nome ?? '').trim().toLowerCase()) && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex-shrink-0" title="Há outro aluno com o mesmo nome nesta turma">⚠️ Nome repetido</span>
                        )}
                        {outrasTurmasDoAluno(aluno).map(nome => (
                          <span key={nome} className="text-[10px] font-semibold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded flex-shrink-0" title="Aluno com matrícula dupla — presença em uma turma não vira falta na outra">🔀 também em: {nome}</span>
                        ))}
                        {!ativo && <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{aluno.status}</span>}
                        {ativo && editavel && (
                          <button onClick={() => abrirJustificar(aluno)}
                            className="text-[10px] font-medium text-slate-400 hover:text-primary-600 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 flex-shrink-0">
                            📅 Justificar período
                          </button>
                        )}
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
                              onBlur={e => supabase.from('presencas')
                                .upsert({ turma_id: turmaId, aluno_id: aluno.id, data: dataSel, status: 'justificado',
                                          motivo: e.target.value || null, registrado_por: profile.id },
                                        { onConflict: 'turma_id,aluno_id,data' })}
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
                          <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 max-w-[12rem]">
                            <span className="truncate block">{a.nome}</span>
                            {nomesDuplos.has((a.nome ?? '').trim().toLowerCase()) && (
                              <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded" title="Há outro aluno com o mesmo nome nesta turma">⚠️ repetido</span>
                            )}
                          </td>
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

        {/* ── Selecionar Turma ── */}
        {turmas.length > 0 && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-slate-100 dark:border-navy-700">
              <span className="text-sm font-bold text-navy-900 dark:text-white flex-1 min-w-0">
                {isAdmin ? 'Selecionar Turma' : 'Minhas Turmas'}
              </span>
              {todosPolosFiltro.length > 1 && (
                <select value={filtroPolo} onChange={e => setFiltroPolo(e.target.value)} className={sCls}>
                  <option value="">Todos os polos</option>
                  {todosPolosFiltro.map(p => (
                    <option key={p.id} value={p.id}>📍 {p.bairro || p.nome}{p.tipo ? ` — ${p.tipo}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-navy-700">
              {polosOrdenados.map(([poloId, polo]) => {
                const pendentesPolo = polo.turmas.filter(t => !chamadasPorTurma[t.id]?.[hoje]).length
                const temSelecionada = polo.turmas.some(t => t.id === turmaId)
                const aberto = poloTurmaAberto[poloId] ?? temSelecionada
                return (
                <div key={poloId}>
                  <button onClick={() => setPoloTurmaAberto(p => ({ ...p, [poloId]: !aberto }))}
                    className="w-full px-4 py-2.5 flex items-center gap-2 bg-slate-50 dark:bg-navy-900/40 hover:bg-slate-100 dark:hover:bg-navy-900/60 transition-colors">
                    <span className="text-xs font-bold text-navy-900 dark:text-white flex-1 text-left">📍 {polo.label}</span>
                    <span className="text-[10px] text-slate-400">{polo.turmas.length} turma{polo.turmas.length !== 1 ? 's' : ''}</span>
                    {pendentesPolo > 0 && (
                      <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                        {pendentesPolo} pendente{pendentesPolo !== 1 ? 's' : ''}
                      </span>
                    )}
                    {aberto ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                  </button>
                  {aberto && (
                  <table className="w-full text-xs">
                    <tbody>
                      {polo.turmas.map(turma => {
                        const feita = !!chamadasPorTurma[turma.id]?.[hoje]
                        return (
                          <tr key={turma.id} onClick={() => { setTurmaId(turma.id); setSaveMsg(null) }}
                            className={`cursor-pointer transition-colors border-t border-slate-50 dark:border-navy-700/50 ${turmaId === turma.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50/60 dark:hover:bg-navy-700/20'}`}>
                            <td className="px-4 py-2.5">
                              <p className={`font-semibold text-[11px] ${turmaId === turma.id ? 'text-primary-700 dark:text-primary-400' : 'text-navy-900 dark:text-white'}`}>
                                {turma.modalidades?.emoji} {turma.modalidades?.nome ?? 'Turma'} · {turma.faixa}
                                {turmaId === turma.id && <span className="ml-2 text-[9px] bg-primary-100 dark:bg-primary-900/40 text-primary-600 px-1.5 py-0.5 rounded-full">selecionada</span>}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {turma.dias?.join(', ') ?? '—'} · {turma.horario?.slice(0,5) ?? '—'}
                                {nomeProfessorDaTurma(turma) ? ` · ${nomeProfessorDaTurma(turma)}` : ''}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-right w-28">
                              {feita
                                ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={11}/> Feita hoje</span>
                                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400"><AlertTriangle size={11}/> Pendente</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {turmas.length === 0 && !minhasLoading && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-10">
            <EmptyState icon={<Users size={36} className="text-slate-300"/>}
              title="Nenhuma turma disponível"
              description="Você ainda não foi vinculado a nenhuma turma."/>
          </div>
        )}
        </>
        )}
      </div>

      {/* Modal — Justificar Ausência (antecipada, vale para todas as turmas do aluno) */}
      <Modal open={!!justModalAluno} onClose={() => setJustModalAluno(null)} title={`Justificar ausência — ${justModalAluno?.nome ?? ''}`} size="sm">
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vale para todas as turmas do aluno no período. Durante esse intervalo, a chamada já marca "Justificado" automaticamente com o motivo abaixo.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">De</label>
              <input type="date" value={justForm.data_inicio}
                onChange={e => setJustForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Até</label>
              <input type="date" value={justForm.data_fim}
                onChange={e => setJustForm(f => ({ ...f, data_fim: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Motivo</label>
            <input type="text" value={justForm.motivo}
              onChange={e => setJustForm(f => ({ ...f, motivo: e.target.value }))}
              placeholder="Ex: viagem em família, atestado médico, matriculado em outra turma…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"/>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setJustModalAluno(null)}>Cancelar</Button>
            <Button size="sm" onClick={salvarJustificativa}
              disabled={savingJust || !justForm.data_inicio || !justForm.data_fim || !justForm.motivo.trim()}>
              {savingJust ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

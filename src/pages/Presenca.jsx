// src/pages/Presenca.jsx
import { useState, useEffect } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logAcao } from '../lib/auditLog'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { Check, X, Save, Users, Clock } from 'lucide-react'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function date7daysAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

function buildDateRange() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default function Presenca() {
  const { profile, isAdmin, isCoordenador, isProfessor, isEstagiario } = useAuth()

  // All turmas
  const { data: allTurmas, loading: turmasLoading } = useSupabaseData(
    'turmas',
    '*, modalidades(nome), polos(nome), profiles(nome)'
  )

  // IDs de turmas acessíveis para professor/estagiário, lidos de `atribuicoes`
  // null = ainda carregando | array = carregado (pode ser vazio)
  const [myTurmaIds, setMyTurmaIds] = useState(null)

  useEffect(() => {
    if (!profile) return
    if (isAdmin || isCoordenador) {
      setMyTurmaIds(null) // null = acesso total (tratado abaixo)
      return
    }
    // Professor e estagiário: busca na tabela atribuicoes (fonte única de verdade)
    supabase
      .from('atribuicoes')
      .select('turma_id')
      .eq('usuario_id', profile.id)
      .not('turma_id', 'is', null)
      .then(({ data }) => {
        setMyTurmaIds((data ?? []).map((a) => a.turma_id))
      })
  }, [profile, isAdmin, isCoordenador])

  // Filtered turmas by role — totalmente dinâmico via atribuicoes
  const turmas = (() => {
    if (!profile || turmasLoading) return []
    if (isAdmin || isCoordenador) return allTurmas
    // Ainda carregando as atribuições
    if (!isAdmin && !isCoordenador && myTurmaIds === null) return []
    const ids = new Set(myTurmaIds ?? [])
    // Para professor: também inclui turmas com professor_id (compatibilidade)
    return allTurmas.filter(
      (t) => ids.has(t.id) || (isProfessor && t.professor_id === profile.id)
    )
  })()

  // Selection state
  const [turmaId, setTurmaId] = useState('')
  const [dataSel, setDataSel] = useState(todayIso())

  // Alunos
  const [alunos, setAlunos] = useState([])
  const [alunosLoading, setAlunosLoading] = useState(false)

  // Presença state: { [alunoId]: 'presente' | 'falta' | 'justificado' }
  const [presencaState, setPresencaState] = useState({})

  // Motivo state: { [alunoId]: string }
  const [motivoState, setMotivoState] = useState({})
  // alunoId com input de motivo expandido
  const [motivoAberto, setMotivoAberto] = useState(null)

  // History presencas (last 7 days)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // IDs dos registros já existentes no banco: { [alunoId]: presencaRowId }
  const [existingIds, setExistingIds] = useState({})

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  function isEditavel() {
    if (!dataSel) return false

    const hoje = todayIso()

    // Admin edita sempre
    if (isAdmin) return true

    // Datas futuras: pode preparar
    if (dataSel > hoje) return true

    // Janela de 3 dias: hoje (dia 0), ontem (dia -1), anteontem (dia -2)
    const diffMs = new Date(hoje).getTime() - new Date(dataSel).getTime()
    const diffDias = Math.round(diffMs / 86400000)
    return diffDias <= 2
  }

  const editavel = isEditavel()

  // Load alunos + existing presencas when turma or date changes
  useEffect(() => {
    if (!turmaId || !dataSel) {
      setAlunos([])
      setPresencaState({})
      return
    }

    let cancelled = false
    async function load() {
      setAlunosLoading(true)
      const [{ data: alunosData }, { data: presencasData }] = await Promise.all([
        supabase
          .from('alunos')
          .select('id,nome,status')
          .eq('turma_id', turmaId)
          .order('nome'),
        supabase
          .from('presencas')
          .select('id,aluno_id,status,motivo')
          .eq('turma_id', turmaId)
          .eq('data', dataSel),
      ])
      if (cancelled) return

      // Ordena: ativos primeiro, depois inativos/transferidos
      const rows = (alunosData ?? []).sort((a, b) => {
        const aAtivo = a.status === 'Ativo' ? 0 : 1
        const bAtivo = b.status === 'Ativo' ? 0 : 1
        return aAtivo - bAtivo || (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')
      })
      const motivoMap = {}
      const pMap = {}
      const idMap = {}
      for (const p of presencasData ?? []) {
        pMap[p.aluno_id] = p.status   // agora string: 'presente'|'falta'|'justificado'
        idMap[p.aluno_id] = p.id
        if (p.motivo) motivoMap[p.aluno_id] = p.motivo
      }
      // Initialize: se já existe registro usa o valor; caso contrário fica undefined (intocado)
      const initState = {}
      for (const a of rows) {
        if (a.id in pMap) initState[a.id] = pMap[a.id]
      }
      setAlunos(rows)
      setPresencaState(initState)
      setExistingIds(idMap)
      setMotivoState(motivoMap)
      setMotivoAberto(null)
      setAlunosLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [turmaId, dataSel])

  // Load history when turma changes
  useEffect(() => {
    if (!turmaId) {
      setHistory([])
      return
    }
    let cancelled = false
    async function loadHistory() {
      setHistoryLoading(true)
      const { data } = await supabase
        .from('presencas')
        .select('*')
        .eq('turma_id', turmaId)
        .gte('data', date7daysAgoIso())
      if (!cancelled) {
        setHistory(data ?? [])
        setHistoryLoading(false)
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [turmaId])

  function toggle(alunoId, value) {
    setPresencaState(prev => ({ ...prev, [alunoId]: value }))
    if (value === 'justificado') {
      setMotivoAberto(alunoId)  // abre campo de motivo
    } else {
      setMotivoAberto(null)  // fecha o campo para qualquer aluno
      // limpa o motivo se o usuário sair de 'justificado'
      setMotivoState(prev => ({ ...prev, [alunoId]: '' }))
    }
  }

  async function handleSave() {
    if (!turmaId || !dataSel || alunos.length === 0) return

    // Só salva alunos que foram explicitamente marcados (presente ou falta)
    const touched = alunos.filter((a) => a.id in presencaState)
    if (!touched.length) {
      setSaveMsg({ type: 'error', text: 'Marque ao menos um aluno antes de salvar.' })
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }

    setSaving(true)
    setSaveMsg(null)

    // Re-busca registros existentes agora para evitar conflito com salvamentos simultâneos
    const { data: latestPresencas } = await supabase
      .from('presencas')
      .select('id,aluno_id')
      .eq('turma_id', turmaId)
      .eq('data', dataSel)

    const latestIds = {}
    for (const p of latestPresencas ?? []) latestIds[p.aluno_id] = p.id

    const errors = []
    const newIds = { ...latestIds }

    for (const aluno of touched) {
      const val = presencaState[aluno.id]   // agora string: 'presente'|'falta'|'justificado'
      const motivo = val === 'justificado' ? (motivoState[aluno.id] ?? null) : null
      const rowId = latestIds[aluno.id]

      if (rowId) {
        // Registro já existe → atualiza
        const { error } = await supabase
          .from('presencas')
          .update({ status: val, motivo, registrado_por: profile.id })
          .eq('id', rowId)
        if (error) errors.push(error)
      } else {
        // Registro novo → insere
        const { data: inserted, error } = await supabase
          .from('presencas')
          .insert({
            turma_id: turmaId,
            aluno_id: aluno.id,
            registrado_por: profile.id,
            data: dataSel,
            status: val,
            motivo,
          })
          .select('id')
          .single()
        if (error) errors.push(error)
        else if (inserted) newIds[aluno.id] = inserted.id
      }
    }

    // Atualiza IDs conhecidos para próximos salvamentos
    setExistingIds(prev => ({ ...prev, ...newIds }))

    setSaving(false)
    if (errors.length) {
      setSaveMsg({ type: 'error', text: `Erro ao salvar ${errors.length} registro(s).` })
    } else {
      // Calcula frequência: (presentes + justificados) / total de ativos
      const totalAtivos = alunosAtivos.length
      const presentesCount = alunosAtivos.filter(a => presencaState[a.id] === 'presente').length
      const justifCount    = alunosAtivos.filter(a => presencaState[a.id] === 'justificado').length
      const freq = totalAtivos > 0
        ? Math.round(((presentesCount + justifCount) / totalAtivos) * 100)
        : 0

      setSaveMsg({
        type: 'success',
        text: `✅ Chamada salva! ${presentesCount} presente${presentesCount !== 1 ? 's' : ''} · ${freq}% de frequência`
      })

      // Registra auditoria
      const turmaAtual = turmas.find(t => t.id === turmaId)
      if (typeof logAcao === 'function') {
        logAcao({
          acao: 'registro_presenca',
          perfil: profile,
          turma: turmaAtual,
          detalhes: `${touched.length} marcação(ões) para ${dataSel} — ${freq}% frequência`,
        })
      }

      // Atualiza histórico
      const { data: histData } = await supabase
        .from('presencas')
        .select('*')
        .eq('turma_id', turmaId)
        .gte('data', date7daysAgoIso())
      setHistory(histData ?? [])

      setTimeout(() => setSaveMsg(null), 4000)
    }
  }

  const selectedTurma = turmas.find((t) => t.id === turmaId)
  const dateRange = buildDateRange()

  // Build history map: { alunoId: { date: status } }
  const historyMap = {}
  for (const p of history) {
    if (!historyMap[p.aluno_id]) historyMap[p.aluno_id] = {}
    historyMap[p.aluno_id][p.data] = p.status  // era p.presente
  }

  const alunosAtivos = alunos.filter(a => a.status === 'Ativo')
  const totalPresentes    = alunosAtivos.filter(a => presencaState[a.id] === 'presente').length
  const totalFaltas       = alunosAtivos.filter(a => presencaState[a.id] === 'falta').length
  const totalJustificados = alunosAtivos.filter(a => presencaState[a.id] === 'justificado').length
  const totalNaoMarcados  = alunosAtivos.filter(a => !(a.id in presencaState)).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Presença" />

      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-5">

        {/* Selection row */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Selecionar Turma e Data
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Turma</label>
              <select
                value={turmaId}
                onChange={(e) => {
                  setTurmaId(e.target.value)
                  setSaveMsg(null)
                }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-slate-800"
              >
                <option value="">— Selecione uma turma —</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                    {t.modalidades?.nome ? ` · ${t.modalidades.nome}` : ''}
                    {t.polos?.nome ? ` · ${t.polos.nome}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:w-48">
              <label className="block text-xs font-medium text-slate-600 mb-1">Data</label>
              <input
                type="date"
                value={dataSel}
                onChange={(e) => {
                  setDataSel(e.target.value)
                  setSaveMsg(null)
                }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Alunos list */}
        {turmaId && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-navy-900">Lista de Alunos</h2>
                {selectedTurma && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedTurma.nome}
                    {selectedTurma.modalidades?.nome && ` · ${selectedTurma.modalidades.nome}`}
                    {selectedTurma.polos?.nome && ` · ${selectedTurma.polos.nome}`}
                  </p>
                )}
              </div>
            </div>

            {/* Placar ao vivo */}
            {alunos.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100 grid grid-cols-4 gap-2">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 text-center">
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">{totalPresentes}</div>
                  <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wide mt-1">✅ Presentes</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 text-center">
                  <div className="text-xl font-extrabold text-red-500 dark:text-red-400 leading-none">{totalFaltas}</div>
                  <div className="text-[9px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wide mt-1">❌ Faltas</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 text-center">
                  <div className="text-xl font-extrabold text-amber-500 dark:text-amber-400 leading-none">{totalJustificados}</div>
                  <div className="text-[9px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wide mt-1">📋 Justif.</div>
                </div>
                <div className="bg-slate-100 dark:bg-navy-700 rounded-lg p-2.5 text-center">
                  <div className="text-xl font-extrabold text-slate-400 leading-none">{totalNaoMarcados}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1">⏳ Pend.</div>
                </div>
              </div>
            )}

            {/* Indicator da janela de edição */}
            {dataSel && (() => {
              const hoje = todayIso()
              const diffDias = dataSel <= hoje
                ? Math.round((new Date(hoje).getTime() - new Date(dataSel).getTime()) / 86400000)
                : -1
              if (editavel && diffDias >= 0 && diffDias <= 2) {
                const diasRestantes = 2 - diffDias
                return (
                  <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 font-medium">
                    <Clock size={12} />
                    {diasRestantes === 0
                      ? 'Editável somente hoje'
                      : `Editável por mais ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} (chamada de ${new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`
                    }
                  </div>
                )
              }
              if (!editavel && dataSel < hoje) {
                return (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/30 border-b border-slate-100 dark:border-navy-700 flex items-center gap-2 text-xs text-slate-500 font-medium">
                    🔒 Somente leitura — janela de edição encerrada
                  </div>
                )
              }
              return null
            })()}

            {alunosLoading ? (
              <div className="p-8 text-center text-sm text-slate-400">Carregando alunos…</div>
            ) : alunos.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users size={32} className="text-slate-300" />}
                  title="Nenhum aluno nesta turma"
                  description="Adicione alunos para registrar a presença."
                />
              </div>
            ) : !editavel && dataSel <= todayIso() && alunos.some(a => a.id in presencaState) ? (
              /* VIEW SOMENTE-LEITURA: chamada já registrada e janela fechada */
              <ul className="divide-y divide-slate-100 dark:divide-navy-700">
                {alunos.map(aluno => {
                  const st = presencaState[aluno.id]
                  const mot = motivoState[aluno.id]
                  return (
                    <li key={aluno.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block">
                          {aluno.nome}
                        </span>
                        {mot && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">{mot}</span>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        {st === 'presente' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                            <Check size={11} /> Presente
                          </span>
                        )}
                        {st === 'falta' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-full">
                            <X size={11} /> Falta
                          </span>
                        )}
                        {st === 'justificado' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1 rounded-full">
                            📋 Justificada
                          </span>
                        )}
                        {!st && (
                          <span className="text-xs text-slate-400 italic">Sem registro</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              /* VIEW EDITÁVEL: lista com botões */
              <ul className="divide-y divide-slate-100">
                {alunos.map((aluno) => {
                  const ativo = aluno.status === 'Ativo'
                  return (
                    <li key={aluno.id} className={`flex items-center justify-between px-4 py-3 transition-colors ${ativo ? 'hover:bg-slate-50/60' : 'opacity-60 bg-slate-50/40 dark:bg-navy-900/20'}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate ${ativo ? 'text-slate-800' : 'text-slate-400 dark:text-slate-500'}`}>{aluno.nome}</span>
                        {!ativo && (
                          <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            aluno.status === 'Transferido'
                              ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400'
                              : 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-navy-700 dark:border-navy-600 dark:text-slate-400'
                          }`}>
                            {aluno.status}
                          </span>
                        )}
                      </div>
                      {ativo ? (
                        <div className="space-y-1">
                          <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button
                              onClick={() => toggle(aluno.id, 'presente')}
                              disabled={!editavel}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                presencaState[aluno.id] === 'presente'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              <Check size={11} /> Presente
                            </button>
                            <button
                              onClick={() => toggle(aluno.id, 'falta')}
                              disabled={!editavel}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                presencaState[aluno.id] === 'falta'
                                  ? 'bg-red-500 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600'
                              }`}
                            >
                              <X size={11} /> Falta
                            </button>
                            <button
                              onClick={() => toggle(aluno.id, 'justificado')}
                              disabled={!editavel}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                presencaState[aluno.id] === 'justificado'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                              }`}
                            >
                              📋 Justif.
                            </button>
                          </div>
                          {/* Campo de motivo — expande ao clicar em Justificada */}
                          {motivoAberto === aluno.id && editavel && (
                            <div className="mt-1">
                              <input
                                type="text"
                                value={motivoState[aluno.id] ?? ''}
                                onChange={e => setMotivoState(prev => ({ ...prev, [aluno.id]: e.target.value }))}
                                placeholder="Motivo (ex: atestado médico)…"
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-900 placeholder-amber-400"
                              />
                            </div>
                          )}
                          {/* Motivo salvo (leitura) */}
                          {presencaState[aluno.id] === 'justificado' && motivoAberto !== aluno.id && motivoState[aluno.id] && (
                            <p className="text-[10px] text-amber-700 mt-0.5 truncate">
                              📋 {motivoState[aluno.id]}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 flex-shrink-0 italic">sem registro</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {alunos.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                {saveMsg ? (
                  <span className={`text-xs font-medium ${saveMsg.type === 'success' ? 'text-primary-600' : 'text-red-500'}`}>
                    {saveMsg.text}
                  </span>
                ) : !editavel ? (
                  <span className="text-xs text-amber-600 font-medium">
                    🔒 {dataSel < todayIso() ? 'Presença finalizada — somente leitura' : 'Fora da janela de registro (±15min antes até 30min após a aula)'}
                  </span>
                ) : (
                  <span />
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !editavel}
                >
                  <Save size={13} />
                  {saving ? 'Salvando…' : 'Salvar Presença'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* History table */}
        {turmaId && alunos.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-navy-900">Histórico — últimos 7 dias</h2>
            </div>

            {historyLoading ? (
              <div className="p-6 text-center text-sm text-slate-400">Carregando histórico…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-4 py-2 font-semibold text-slate-500 w-48">Aluno</th>
                      {dateRange.map((d) => (
                        <th
                          key={d}
                          className={`px-2 py-2 font-semibold text-center whitespace-nowrap ${
                            d === dataSel ? 'text-primary-600' : 'text-slate-500'
                          }`}
                        >
                          {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                          {d === todayIso() && (
                            <span className="ml-1 text-[9px] text-primary-500 font-bold">hoje</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alunos.map((aluno) => (
                      <tr key={aluno.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2 font-medium text-slate-700 truncate max-w-[12rem]">
                          {aluno.nome}
                        </td>
                        {dateRange.map((d) => {
                          const val = historyMap[aluno.id]?.[d]
                          return (
                            <td key={d} className="px-2 py-2 text-center">
                              {val === 'presente' ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-primary-500" title="Presente" />
                              ) : val === 'falta' ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-red-400" title="Falta" />
                              ) : val === 'justificado' ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-amber-400" title="Justificada" />
                              ) : (
                                <span className="inline-block w-4 h-4 rounded-full bg-slate-200" title="Sem registro" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-primary-500" /> Presente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-red-400" /> Falta
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-400" /> Justificada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-slate-200" /> Sem registro
              </span>
            </div>
          </div>
        )}

        {/* Empty: no turma selected */}
        {!turmaId && !turmasLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-10">
            <EmptyState
              icon={<Users size={36} className="text-slate-300" />}
              title="Selecione uma turma"
              description="Escolha uma turma e uma data para registrar ou consultar a presença."
            />
          </div>
        )}
      </div>
    </div>
  )
}

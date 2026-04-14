// src/pages/Presenca.jsx
import { useState, useEffect } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { Check, X, Save, Users } from 'lucide-react'

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

  // Estagiário vinculos
  const [vinculoTurmaIds, setVinculoTurmaIds] = useState(null)
  useEffect(() => {
    if (!profile) return
    if (isEstagiario) {
      supabase
        .from('vinculos_estagiario_turma')
        .select('turma_id')
        .eq('estagiario_id', profile.id)
        .then(({ data }) => {
          setVinculoTurmaIds((data ?? []).map((v) => v.turma_id))
        })
    } else {
      setVinculoTurmaIds(null)
    }
  }, [profile, isEstagiario])

  // Filtered turmas by role
  const turmas = (() => {
    if (!profile || turmasLoading) return []
    if (isAdmin || isCoordenador) return allTurmas
    if (isProfessor) return allTurmas.filter((t) => t.professor_id === profile.id)
    if (isEstagiario && vinculoTurmaIds !== null)
      return allTurmas.filter((t) => vinculoTurmaIds.includes(t.id))
    return []
  })()

  // Selection state
  const [turmaId, setTurmaId] = useState('')
  const [dataSel, setDataSel] = useState(todayIso())

  // Alunos
  const [alunos, setAlunos] = useState([])
  const [alunosLoading, setAlunosLoading] = useState(false)

  // Presença state: { [alunoId]: true | false }
  const [presencaState, setPresencaState] = useState({})

  // History presencas (last 7 days)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

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
          .eq('status', 'Ativo')
          .order('nome'),
        supabase
          .from('presencas')
          .select('*')
          .eq('turma_id', turmaId)
          .eq('data', dataSel),
      ])
      if (cancelled) return

      const rows = alunosData ?? []
      const pMap = {}
      for (const p of presencasData ?? []) {
        pMap[p.aluno_id] = p.presente
      }
      // Initialize: if existing record use it, otherwise undefined (untouched)
      const initState = {}
      for (const a of rows) {
        if (a.id in pMap) initState[a.id] = pMap[a.id]
      }
      setAlunos(rows)
      setPresencaState(initState)
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
    setPresencaState((prev) => ({ ...prev, [alunoId]: value }))
  }

  async function handleSave() {
    if (!turmaId || !dataSel || alunos.length === 0) return
    setSaving(true)
    setSaveMsg(null)
    const records = alunos.map((a) => ({
      turma_id: turmaId,
      aluno_id: a.id,
      registrado_por: profile.id,
      data: dataSel,
      presente: presencaState[a.id] ?? false,
    }))
    const { error } = await supabase
      .from('presencas')
      .upsert(records, { onConflict: 'turma_id,aluno_id,data' })
    setSaving(false)
    if (error) {
      setSaveMsg({ type: 'error', text: 'Erro ao salvar: ' + error.message })
    } else {
      setSaveMsg({ type: 'success', text: 'Presença salva com sucesso!' })
      // Refresh history
      const { data } = await supabase
        .from('presencas')
        .select('*')
        .eq('turma_id', turmaId)
        .gte('data', date7daysAgoIso())
      setHistory(data ?? [])
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const selectedTurma = turmas.find((t) => t.id === turmaId)
  const dateRange = buildDateRange()

  // Build history map: { alunoId: { date: presente } }
  const historyMap = {}
  for (const p of history) {
    if (!historyMap[p.aluno_id]) historyMap[p.aluno_id] = {}
    historyMap[p.aluno_id][p.data] = p.presente
  }

  const totalPresentes = Object.values(presencaState).filter(Boolean).length
  const totalFaltas = Object.values(presencaState).filter((v) => v === false).length
  const totalNaoMarcados = alunos.length - Object.keys(presencaState).length

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
              {alunos.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold">
                    <Check size={11} /> {totalPresentes}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                    <X size={11} /> {totalFaltas}
                  </span>
                  {totalNaoMarcados > 0 && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                      ? {totalNaoMarcados}
                    </span>
                  )}
                </div>
              )}
            </div>

            {alunosLoading ? (
              <div className="p-8 text-center text-sm text-slate-400">Carregando alunos…</div>
            ) : alunos.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users size={32} className="text-slate-300" />}
                  title="Nenhum aluno ativo nesta turma"
                  description="Adicione alunos ativos para registrar a presença."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alunos.map((aluno) => (
                  <li key={aluno.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors">
                    <span className="text-sm font-medium text-slate-800">{aluno.nome}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggle(aluno.id, true)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          presencaState[aluno.id] === true
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-primary-50 hover:text-primary-700'
                        }`}
                      >
                        <Check size={12} /> Presente
                      </button>
                      <button
                        onClick={() => toggle(aluno.id, false)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          presencaState[aluno.id] === false
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600'
                        }`}
                      >
                        <X size={12} /> Falta
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {alunos.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                {saveMsg ? (
                  <span
                    className={`text-xs font-medium ${
                      saveMsg.type === 'success' ? 'text-primary-600' : 'text-red-500'
                    }`}
                  >
                    {saveMsg.text}
                  </span>
                ) : (
                  <span />
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
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
                              {val === true ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-primary-500" title="Presente" />
                              ) : val === false ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-red-400" title="Falta" />
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

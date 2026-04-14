// src/pages/MelhorIdade.jsx
import { useState, useMemo } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Badge from '../components/ui/Badge'

function calcIdade(dataNasc) {
  if (!dataNasc) return 0
  const hoje = new Date()
  const nasc = new Date(dataNasc)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

function calcFreqMes(alunoId, presencas, mes, ano) {
  const doMes = presencas.filter(p => {
    const d = new Date(p.data)
    return p.aluno_id === alunoId && d.getMonth() + 1 === mes && d.getFullYear() === ano
  })
  if (!doMes.length) return 0
  return Math.round((doMes.filter(p => p.presente).length / doMes.length) * 100)
}

const TABS = [
  { key: 'elegivel',     label: 'Elegíveis',      color: 'green', barColor: '#10b981' },
  { key: 'quase',        label: 'Quase lá',        color: 'amber', barColor: '#f59e0b' },
  { key: 'nao_elegivel', label: 'Não elegíveis',   color: 'red',   barColor: '#ef4444' },
]

function getStatus(freq) {
  if (freq >= 75) return 'elegivel'
  if (freq >= 60) return 'quase'
  return 'nao_elegivel'
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

export default function MelhorIdade() {
  const hoje = new Date()
  const [mes, setMes]   = useState(hoje.getMonth() + 1)
  const [ano, setAno]   = useState(hoje.getFullYear())
  const [tab, setTab]   = useState('elegivel')

  const { data: alunos,   loading: loadA } = useSupabaseData('alunos',   '*, turmas(*, modalidades(nome), polos(nome))')
  const { data: presencas, loading: loadP } = useSupabaseData('presencas', 'id, aluno_id, data, presente')

  const anosDisponiveis = useMemo(() => {
    const ano_atual = hoje.getFullYear()
    return [ano_atual - 1, ano_atual, ano_atual + 1]
  }, [])

  const alunosMelhorIdade = useMemo(() => {
    return alunos
      .filter(a => a.status === 'Ativo' && calcIdade(a.data_nasc) >= 60)
      .map(a => {
        const freq   = calcFreqMes(a.id, presencas, mes, ano)
        const status = getStatus(freq)
        return { ...a, freq, status }
      })
      .sort((a, b) => b.freq - a.freq)
  }, [alunos, presencas, mes, ano])

  const counts = useMemo(() => ({
    elegivel:     alunosMelhorIdade.filter(a => a.status === 'elegivel').length,
    quase:        alunosMelhorIdade.filter(a => a.status === 'quase').length,
    nao_elegivel: alunosMelhorIdade.filter(a => a.status === 'nao_elegivel').length,
  }), [alunosMelhorIdade])

  const listaFiltrada = useMemo(() =>
    alunosMelhorIdade.filter(a => a.status === tab),
    [alunosMelhorIdade, tab]
  )

  const tabAtual = TABS.find(t => t.key === tab)

  const loading = loadA || loadP

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Melhor Idade" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-navy-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-navy-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {anosDisponiveis.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400 ml-1">
            {alunosMelhorIdade.length} aluno(s) 60+
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                tab === t.key
                  ? t.key === 'elegivel'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : t.key === 'quase'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {t.label}
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                tab === t.key
                  ? t.key === 'elegivel'
                    ? 'bg-emerald-100 text-emerald-700'
                    : t.key === 'quase'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">Nenhum aluno nesta categoria</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Tente outro período ou verifique os registros de presença.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {listaFiltrada.map(aluno => {
              const barColor = tabAtual?.barColor ?? '#94a3b8'
              const badgeColor = tabAtual?.color ?? 'gray'
              const statusLabel = tabAtual?.label ?? ''
              return (
                <div key={aluno.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm font-bold text-navy-900 truncate">{aluno.nome}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {aluno.turmas?.modalidades?.nome ?? '—'}
                        {aluno.turmas?.polos?.nome ? ` · ${aluno.turmas.polos.nome}` : ''}
                      </p>
                    </div>
                    <Badge color={badgeColor}>{statusLabel}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${aluno.freq}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <span className="text-xs font-bold text-navy-900 tabular-nums">{aluno.freq}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

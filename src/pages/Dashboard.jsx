// src/pages/Dashboard.jsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { useTheme } from '../contexts/ThemeContext'
import Topbar from '../components/Topbar'
import { subDays, format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function KpiCard({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${
      highlight
        ? 'bg-gradient-to-br from-primary-700 to-primary-500 border-transparent text-white'
        : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700'
    }`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${
        highlight ? 'text-primary-100' : 'text-slate-400 dark:text-slate-500'
      }`}>{label}</p>
      <p className={`text-3xl font-extrabold leading-none ${
        highlight ? 'text-white' : 'text-navy-900 dark:text-white'
      }`}>{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${
        highlight ? 'text-primary-100' : 'text-slate-400 dark:text-slate-500'
      }`}>{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-navy-900 dark:text-white mb-1 capitalize">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { dark } = useTheme()
  const { data: alunos } = useSupabaseData('alunos', 'id,status,turma_id,data_nasc,data_matricula')
  const { data: turmas } = useSupabaseData('turmas', 'id,status,modalidade_id,capacidade,modalidades(nome,emoji)')
  const { data: presencas } = useSupabaseData('presencas', 'id,data,presente,turma_id,aluno_id')
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')
  const { data: polos } = useSupabaseData('polos', 'id,status')

  const hoje = new Date()
  const em30 = new Date(); em30.setDate(hoje.getDate() + 30)
  const ha30 = new Date(); ha30.setDate(hoje.getDate() - 30)

  const alunosAtivos = alunos.filter(a => a.status === 'Ativo').length
  const turmasAtivas = turmas.filter(t => t.status === 'Ativa').length
  const polosAtivos = polos.filter(p => p.status === 'Ativo').length

  const alunosNovos = alunos.filter(a =>
    a.data_matricula && new Date(a.data_matricula) >= ha30
  ).length

  const melhorIdade = useMemo(() => alunos.filter(a => {
    if (a.status !== 'Ativo' || !a.data_nasc) return false
    const idade = new Date().getFullYear() - new Date(a.data_nasc).getFullYear()
    return idade >= 60
  }).length, [alunos])

  const freqMedia = useMemo(() => {
    if (!presencas.length) return 0
    return Math.round((presencas.filter(p => p.presente).length / presencas.length) * 100)
  }, [presencas])

  const ocupacao = useMemo(() => {
    const cap = turmas.filter(t => t.status === 'Ativa').reduce((s, t) => s + (t.capacidade || 0), 0)
    return cap ? Math.round((alunosAtivos / cap) * 100) : 0
  }, [turmas, alunosAtivos])

  const atestadosVencendo = atestados.filter(a => {
    const aluno = alunos.find(al => al.id === a.aluno_id)
    if (!aluno || aluno.status !== 'Ativo') return false
    const val = new Date(a.data_validade)
    return val >= hoje && val <= em30
  }).length

  const atestadosVencidos = atestados.filter(a => {
    const aluno = alunos.find(al => al.id === a.aluno_id)
    if (!aluno || aluno.status !== 'Ativo') return false
    return new Date(a.data_validade) < hoje
  }).length

  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const dp = presencas.filter(p => isSameDay(new Date(p.data), d))
    return {
      dia: format(d, 'EEE', { locale: ptBR }),
      Presentes: dp.filter(p => p.presente).length,
      Faltas: dp.filter(p => !p.presente).length,
    }
  })

  const porModalidade = useMemo(() => {
    const map = {}
    turmas.forEach(t => {
      const nome = t.modalidades?.nome ?? 'Sem modalidade'
      const emoji = t.modalidades?.emoji ?? '🏃'
      const count = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
      if (!map[nome]) map[nome] = { nome, emoji, count: 0 }
      map[nome].count += count
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [turmas, alunos])

  // chart theme colors
  const axisColor = dark ? '#475569' : '#94a3b8'
  const gridColor = dark ? '#1e2d42' : '#f1f5f9'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">

        {/* KPIs — row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Alunos Ativos" value={alunosAtivos} sub={`em ${turmasAtivas} turmas`} highlight />
          <KpiCard label="Turmas Ativas" value={turmasAtivas} sub="em funcionamento" />
          <KpiCard label="Freq. Média" value={`${freqMedia}%`} sub="geral" />
          <KpiCard label="Melhor Idade" value={melhorIdade} sub="alunos 60+" />
        </div>

        {/* KPIs — row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Polos Ativos" value={polosAtivos} sub="unidades" />
          <KpiCard label="Novos (30 dias)" value={alunosNovos} sub="matrículas recentes" />
          <KpiCard label="Ocupação" value={`${ocupacao}%`} sub="capacidade total" />
          <KpiCard label="Atestados Vencidos" value={atestadosVencidos} sub="requer atenção" />
        </div>

        {/* Alertas */}
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

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Gráfico de presença */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Presença — últimos 7 dias</p>
            {presencas.length === 0 ? (
              <div className="h-[140px] flex flex-col items-center justify-center gap-2">
                <div className="text-2xl">📊</div>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Nenhuma presença registrada ainda.<br />Registre presença para ver o gráfico.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={ultimos7} barSize={14} barGap={3}>
                  <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: dark ? '#1e2d42' : '#f8fafc' }} />
                  <Bar dataKey="Presentes" fill="#009640" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Faltas" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Legenda */}
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary-600 inline-block" /> Presentes
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Faltas
              </span>
            </div>
          </div>

          {/* Alunos por modalidade */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Alunos por Modalidade</p>
            {porModalidade.length === 0 ? (
              <div className="h-[140px] flex flex-col items-center justify-center gap-2">
                <div className="text-2xl">🏃</div>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Nenhuma turma com alunos ainda.<br />Cadastre turmas e alunos para ver aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {porModalidade.map(m => (
                  <div key={m.nome}>
                    <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-300 mb-1">
                      <span>{m.emoji} {m.nome}</span>
                      <span className="font-bold">{m.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all"
                        style={{ width: alunosAtivos ? `${(m.count / alunosAtivos) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

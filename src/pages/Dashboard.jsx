// src/pages/Dashboard.jsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { useTheme } from '../contexts/ThemeContext'
import Topbar from '../components/Topbar'
import { subDays, format, startOfMonth, endOfMonth } from 'date-fns'
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
  const { data: alunos } = useSupabaseData('alunos', 'id,nome,status,turma_id,data_nasc,data_matricula')
  const { data: turmas } = useSupabaseData('turmas', 'id,status,modalidade_id,capacidade,faixa,horario,polo_id,modalidades(nome,emoji),polos(nome,tipo,bairro)')
  const { data: presencas } = useSupabaseData('presencas', 'id,data,status,turma_id,aluno_id')
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')
  const { data: polos } = useSupabaseData('polos', 'id,nome,tipo,bairro,status')
  const { data: modalidades } = useSupabaseData('modalidades', 'id,nome,emoji,status')

  const hoje = new Date()
  const em30 = new Date(); em30.setDate(hoje.getDate() + 30)
  const ha30 = new Date(); ha30.setDate(hoje.getDate() - 30)
  const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd')
  const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd')
  const nomeMes = format(hoje, 'MMMM/yy', { locale: ptBR })

  const alunosAtivos = alunos.filter(a => a.status === 'Ativo').length
  const turmasAtivas = turmas.filter(t => t.status === 'Ativa').length
  const polosAtivos = polos.filter(p => p.status === 'Ativo').length

  const alunosNovos = alunos.filter(a =>
    a.status === 'Ativo' && a.data_matricula && new Date(a.data_matricula) >= ha30
  ).length

  const melhorIdade = useMemo(() => alunos.filter(a => {
    if (a.status !== 'Ativo' || !a.data_nasc) return false
    const idade = new Date().getFullYear() - new Date(a.data_nasc).getFullYear()
    return idade >= 60
  }).length, [alunos])

  const freqMedia = useMemo(() => {
    if (!presencas.length) return 0
    return Math.round((presencas.filter(p => p.status === 'presente' || p.status === 'justificado').length / presencas.length) * 100)
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
    const dStr = format(d, 'yyyy-MM-dd')
    const dp = presencas.filter(p => (p.data ?? '').slice(0, 10) === dStr)
    return {
      dia: format(d, 'EEE', { locale: ptBR }),
      Presentes: dp.filter(p => p.status === 'presente').length,
      Faltas: dp.filter(p => p.status === 'falta').length,
    }
  })

  // Today's presence
  const hojeStr = format(hoje, 'yyyy-MM-dd')
  const presencasHoje = useMemo(() =>
    presencas.filter(p => (p.data ?? '').slice(0, 10) === hojeStr)
  , [presencas, hojeStr])

  const hojePresentes = presencasHoje.filter(p => p.status === 'presente').length
  const hojeJustificados = presencasHoje.filter(p => p.status === 'justificado').length
  const hojeFaltas = presencasHoje.filter(p => p.status === 'falta').length
  const hojeTotal = presencasHoje.length
  const hojePct = hojeTotal ? Math.round(((hojePresentes + hojeJustificados) / hojeTotal) * 100) : 0

  // Per-turma attendance rate (mês atual)
  const turmaFreq = useMemo(() => {
    return turmas
      .filter(t => t.status === 'Ativa')
      .map(t => {
        const tp = presencas.filter(p => p.turma_id === t.id && p.data >= inicioMes && p.data <= fimMes)
        if (!tp.length) return null
        const rate = Math.round((tp.filter(p => p.status === 'presente' || p.status === 'justificado').length / tp.length) * 100)
        const modNome = t.modalidades?.nome ?? 'Turma'
        const label = t.faixa ? `${modNome} · ${t.faixa}` : modNome
        return {
          id: t.id,
          label,
          emoji: t.modalidades?.emoji ?? '🏃',
          polo: t.polos ? [t.polos.tipo, t.polos.bairro].filter(Boolean).join(' · ') || t.polos.nome : '—',
          horario: t.horario ?? '—',
          rate,
          total: tp.length,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 30)
  }, [turmas, presencas])

  // Top alunos por frequência
  const topAlunos = useMemo(() => {
    return alunos
      .filter(a => a.status === 'Ativo')
      .map(a => {
        const ap = presencas.filter(p => p.aluno_id === a.id)
        if (ap.length < 3) return null
        const rate = Math.round((ap.filter(p => p.status === 'presente' || p.status === 'justificado').length / ap.length) * 100)
        return { id: a.id, nome: a.nome, rate, total: ap.length }
      })
      .filter(Boolean)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10)
  }, [alunos, presencas])

  const topPolos = useMemo(() => {
    return polos
      .filter(p => p.status === 'Ativo')
      .map(p => {
        const turmasPolo = turmas.filter(t => t.polo_id === p.id && t.status === 'Ativa')
        const turmaIds = new Set(turmasPolo.map(t => t.id))
        const alunosPolo = alunos.filter(a => turmaIds.has(a.turma_id) && a.status === 'Ativo').length
        if (alunosPolo === 0) return null
        const cap = turmasPolo.reduce((s, t) => s + (t.capacidade || 0), 0)
        const ocupacao = cap ? Math.round((alunosPolo / cap) * 100) : 0
        const pp = presencas.filter(p2 => turmaIds.has(p2.turma_id) && p2.data >= inicioMes && p2.data <= fimMes)
        const freq = pp.length ? Math.round((pp.filter(p2 => p2.status === 'presente' || p2.status === 'justificado').length / pp.length) * 100) : null
        const label = [p.tipo, p.bairro].filter(Boolean).join(' · ') || p.nome
        return { id: p.id, label, alunosPolo, turmas: turmasPolo.length, ocupacao, freq }
      })
      .filter(Boolean)
      .sort((a, b) => b.alunosPolo - a.alunosPolo)
      .slice(0, 5)
  }, [polos, turmas, alunos, presencas, inicioMes, fimMes])

  const porModalidade = useMemo(() => {
    // Soma alunos ativos por modalidade_id via turmas
    const countPorModId = {}
    turmas.forEach(t => {
      if (!t.modalidade_id) return
      const count = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
      countPorModId[t.modalidade_id] = (countPorModId[t.modalidade_id] ?? 0) + count
    })
    // Base: TODAS as modalidades ativas (não só as que têm turma)
    const lista = modalidades
      .filter(m => m.status !== 'Inativo')
      .map(m => ({ nome: m.nome, emoji: m.emoji ?? '🏃', count: countPorModId[m.id] ?? 0 }))
    // Turmas sem modalidade (turma_id sem join)
    const semMod = alunos.filter(a => a.status === 'Ativo' && turmas.find(t => t.id === a.turma_id && !t.modalidade_id)).length
    if (semMod > 0) lista.push({ nome: 'Sem modalidade', emoji: '🏃', count: semMod })
    return lista.sort((a, b) => b.count - a.count)
  }, [turmas, alunos, modalidades])

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

        {/* Row: Presença 7 dias + Presença Hoje */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

          {/* Gráfico de presença */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Presença — últimos 7 dias</p>
            {presencas.length === 0 ? (
              <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center gap-2">
                <div className="text-2xl">📊</div>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Nenhuma presença registrada ainda.<br />Registre presença para ver o gráfico.
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ultimos7} barSize={16} barGap={4} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="dia"
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: dark ? '#1e2d42' : '#f8fafc' }} />
                      <Bar dataKey="Presentes" fill="#009640" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas" fill="#f87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary-600 inline-block" /> Presentes
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Faltas
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Presença Hoje */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Presença — Hoje</p>
            {hojeTotal === 0 ? (
              <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">📅</span>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Nenhuma presença registrada hoje ainda.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-end gap-5 mb-4">
                  <div>
                    <p className="text-3xl font-extrabold text-emerald-600 leading-none">{hojePresentes}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">presentes</p>
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-red-400 leading-none">{hojeFaltas}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">faltas</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-2xl font-extrabold text-navy-900 dark:text-white leading-none">{hojePct}%</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">presença</p>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${hojePct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">{hojeTotal} registros hoje</p>
              </div>
            )}
          </div>

        </div>

        {/* Row: Alunos por Modalidade | Ranking de Frequência por Turma — lado a lado */}
        {/* A altura é ditada pelo card Modalidade (sem scroll). Freq usa o mesmo espaço e rola se tiver mais itens. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

          {/* Alunos por Modalidade — sem scroll, all items, dita a altura do grid */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Alunos por Modalidade</p>
            {porModalidade.length === 0 ? (
              <div className="min-h-[120px] flex flex-col items-center justify-center gap-2">
                <div className="text-2xl">🏃</div>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Nenhuma turma com alunos ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pr-1">
                {porModalidade.map(m => (
                  <div key={m.nome}>
                    <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 mb-1.5">
                      <span className="font-medium">{m.emoji} {m.nome}</span>
                      <span className="font-bold text-navy-900 dark:text-white ml-2 shrink-0">{m.count}</span>
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

          {/* Ranking de Frequência por Turma — mesmo tamanho que Modalidade, scroll interno */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-xs font-bold text-navy-900 dark:text-white">
                📋 Freq. por Turma — <span className="capitalize">{nomeMes}</span>
              </p>
              {turmaFreq.length > 0 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-2">{turmaFreq.length} turma{turmaFreq.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {turmaFreq.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">📋</span>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Nenhuma chamada registrada este mês ainda.
                </p>
              </div>
            ) : (
              <>
                {/* Cabeçalho fixo */}
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-navy-700 mb-0.5 shrink-0">
                  <span className="w-5 shrink-0 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">#</span>
                  <span className="flex-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Turma · Polo · Horário</span>
                  <span className="w-20 shrink-0 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">Freq.</span>
                </div>
                {/* Lista: flex-1 + overflow-y-auto → ocupa o espaço restante e rola se necessário */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {turmaFreq.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-2 py-2 border-b border-slate-50 dark:border-navy-700/40 hover:bg-slate-50/60 dark:hover:bg-navy-700/30 transition-colors rounded-sm">
                      <span className={`w-5 shrink-0 text-[10px] font-bold text-right ${
                        i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300 dark:text-navy-600'
                      }`}>{i + 1}</span>
                      <span className="text-base shrink-0 leading-none">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-navy-900 dark:text-white truncate leading-snug">{t.label}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate leading-snug">
                          {t.polo}{t.horario !== '—' ? ` · ${t.horario}` : ''} · {t.total} aula{t.total !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 w-20">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${t.rate >= 75 ? 'bg-emerald-500' : t.rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${t.rate}%` }} />
                        </div>
                        <span className={`w-9 text-right text-[11px] font-extrabold shrink-0 ${
                          t.rate >= 75 ? 'text-emerald-600' : t.rate >= 50 ? 'text-amber-500' : 'text-red-500'
                        }`}>{t.rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>{/* fim grid Modalidade + Freq */}

        {/* Top Alunos | Top Polos — lado a lado, mesmo tamanho, scroll interno */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

          {/* Top 10 Alunos — Maior Frequência: se adequa ao tamanho do Top Polos, scroll interno */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3 shrink-0">🏆 Top Alunos — Maior Frequência</p>
            {topAlunos.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-[100px]">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Registre pelo menos 3 aulas por aluno para aparecer aqui.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                {topAlunos.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold w-4 text-right shrink-0 ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300 dark:text-navy-600'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-300 mb-1">
                        <span className="truncate font-medium">{a.nome}</span>
                        <span className="font-bold ml-2 shrink-0 text-emerald-600">{a.rate}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${a.rate}%` }} />
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 shrink-0">{a.total} aulas</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top 5 Polos — referência de tamanho, sem scroll, conteúdo natural */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex flex-col">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3 shrink-0">🏟️ Top Polos — Engajamento e Ocupação</p>
            {topPolos.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-[100px]">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Nenhum polo com alunos ativos ainda.</p>
              </div>
            ) : (
              <div className="space-y-3 pr-1">
                {topPolos.map((p, i) => (
                  <div key={p.id} className="flex items-start gap-3">
                    <span className={`text-[10px] font-bold w-4 text-right shrink-0 mt-0.5 ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300 dark:text-navy-600'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-semibold text-navy-900 dark:text-white truncate leading-snug">{p.label}</span>
                        <span className="text-[10px] font-bold text-primary-600 shrink-0 ml-2">{p.alunosPolo} alunos</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all" style={{ width: `${p.ocupacao}%` }} />
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-slate-400 dark:text-slate-500">
                        <span>{p.turmas} turma{p.turmas !== 1 ? 's' : ''}</span>
                        <span>· {p.ocupacao}% ocupação</span>
                        {p.freq !== null && (
                          <span className={`font-semibold ${p.freq >= 75 ? 'text-emerald-600' : p.freq >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            · {p.freq}% freq.
                          </span>
                        )}
                      </div>
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

// src/pages/Dashboard.jsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import { subDays, format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function KpiCard({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-gradient-to-br from-primary-700 to-primary-500 border-transparent text-white' : 'bg-white border-slate-200'}`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${highlight ? 'text-primary-100' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-3xl font-extrabold leading-none ${highlight ? 'text-white' : 'text-navy-900'}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${highlight ? 'text-primary-100' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { data: alunos } = useSupabaseData('alunos', 'id,status,turma_id,data_nasc')
  const { data: turmas } = useSupabaseData('turmas', 'id,status,modalidade_id,modalidades(nome,emoji)')
  const { data: presencas } = useSupabaseData('presencas', 'id,data,presente,turma_id,aluno_id')
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')

  const alunosAtivos = alunos.filter(a => a.status === 'Ativo').length
  const turmasAtivas = turmas.filter(t => t.status === 'Ativa').length

  // Melhor Idade = alunos ativos com 60+ anos
  const melhorIdade = useMemo(() => alunos.filter(a => {
    if (a.status !== 'Ativo' || !a.data_nasc) return false
    const idade = new Date().getFullYear() - new Date(a.data_nasc).getFullYear()
    return idade >= 60
  }).length, [alunos])

  // Frequência média geral
  const freqMedia = useMemo(() => {
    if (!presencas.length) return 0
    return Math.round((presencas.filter(p => p.presente).length / presencas.length) * 100)
  }, [presencas])

  // Atestados vencendo em 30 dias
  const hoje = new Date()
  const em30 = new Date(); em30.setDate(hoje.getDate() + 30)
  const atestadosVencendo = atestados.filter(a => {
    const val = new Date(a.data_validade)
    return val >= hoje && val <= em30
  }).length

  // Presença últimos 7 dias
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const dp = presencas.filter(p => isSameDay(new Date(p.data), d))
    return {
      dia: format(d, 'EEE', { locale: ptBR }),
      presentes: dp.filter(p => p.presente).length,
      faltas: dp.filter(p => !p.presente).length,
    }
  })

  // Alunos por modalidade
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="Alunos Ativos" value={alunosAtivos} sub={`em ${turmasAtivas} turmas`} highlight />
          <KpiCard label="Turmas Ativas" value={turmasAtivas} sub="em funcionamento" />
          <KpiCard label="Freq. Média" value={`${freqMedia}%`} sub="geral" />
          <KpiCard label="Melhor Idade" value={melhorIdade} sub="alunos 60+" />
        </div>

        {/* Alertas */}
        {atestadosVencendo > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-medium">
            ⚠️ {atestadosVencendo} atestado(s) vencendo nos próximos 30 dias
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-navy-900 mb-3">Presença — últimos 7 dias</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={ultimos7} barSize={14}>
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="presentes" fill="#009640" radius={[3,3,0,0]} name="Presentes" />
                <Bar dataKey="faltas" fill="#fecaca" radius={[3,3,0,0]} name="Faltas" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-navy-900 mb-3">Alunos por Modalidade</p>
            <div className="space-y-2.5">
              {porModalidade.length === 0 && (
                <p className="text-xs text-slate-400">Nenhum dado disponível</p>
              )}
              {porModalidade.map(m => (
                <div key={m.nome}>
                  <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                    <span>{m.emoji} {m.nome}</span>
                    <span className="font-bold">{m.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all"
                      style={{ width: alunosAtivos ? `${(m.count / alunosAtivos) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

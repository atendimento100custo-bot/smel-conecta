// src/pages/DashboardStaff.jsx
// Dashboard simplificada — professor, estagiário e coordenador.
// Só o essencial do dia a dia: minhas turmas hoje, e como está minha semana.
// Nada de rankings cruzando polos — isso é conteúdo do DashboardAdmin.jsx.
import { useNavigate } from 'react-router-dom'
import { useMinhasChamadasSemana } from '../hooks/useMinhasChamadasSemana'
import { useSupabaseData } from '../hooks/useSupabaseData'
import Topbar from '../components/Topbar'
import EmptyState from '../components/ui/EmptyState'
import { CheckCircle2, AlertTriangle, Clock, ClipboardList } from 'lucide-react'

function KpiMini({ label, value }) {
  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-navy-900 dark:text-white leading-none">{value}</p>
    </div>
  )
}

export default function DashboardStaff() {
  const navigate = useNavigate()
  const { loading, turmas, turmasHoje, chamadasPorTurma, hoje, pctSemana, totalFeito, totalEsperado, pendencias } = useMinhasChamadasSemana()
  const { data: alunosData } = useSupabaseData('alunos', 'id,status,turma_id,aluno_turmas(turma_id)')

  const meuIdSet = new Set(turmas.map(t => t.id))
  const alunosAtivos = (alunosData ?? []).filter(a => {
    if (a.status !== 'Ativo') return false
    const ids = [a.turma_id, ...(a.aluno_turmas ?? []).map(v => v.turma_id)]
    return ids.some(tid => meuIdSet.has(tid))
  }).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : turmas.length === 0 ? (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-10">
            <EmptyState icon={<ClipboardList size={32} className="text-slate-300" />}
              title="Nenhuma turma vinculada"
              description="Você ainda não foi vinculado a nenhuma turma." />
          </div>
        ) : (
          <>
            {/* KPIs simples */}
            <div className="grid grid-cols-2 gap-3">
              <KpiMini label="Minhas Turmas" value={turmas.length} />
              <KpiMini label="Alunos Ativos" value={alunosAtivos} />
            </div>

            {/* Minhas turmas hoje */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              <p className="text-xs font-bold text-navy-900 dark:text-white px-4 py-3 border-b border-slate-100 dark:border-navy-700">
                Minhas turmas hoje
              </p>
              {turmasHoje.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma das suas turmas tem aula hoje.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-navy-700">
                  {turmasHoje.map(l => {
                    const feita = !!chamadasPorTurma[l.turma.id]?.[hoje]
                    return (
                      <button key={l.turma.id} onClick={() => navigate(`/polos/${l.turma.polos?.id ?? l.turma.polo_id}?turma=${l.turma.id}`)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-700/40 transition-colors text-left">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy-900 dark:text-white truncate">
                            {l.turma.modalidades?.emoji} {l.turma.modalidades?.nome ?? 'Turma'} · {l.turma.faixa}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> {l.turma.horario?.slice(0, 5) ?? '—'} · {l.turma.polos?.bairro ?? l.turma.polos?.nome ?? '—'}
                          </p>
                        </div>
                        {feita
                          ? <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full flex-shrink-0"><CheckCircle2 size={11} /> Feita</span>
                          : <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-full flex-shrink-0"><AlertTriangle size={11} /> Pendente</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Resumo da semana */}
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
          </>
        )}
      </div>
    </div>
  )
}

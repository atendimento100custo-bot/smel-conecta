// src/pages/Supervisao.jsx
import { useState, useEffect } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import Topbar from '../components/Topbar'
import { AlertTriangle, CheckCircle2, Radar } from 'lucide-react'

const DIAS_JS = { 'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }

function todayIso() { return new Date().toISOString().slice(0, 10) }
function mondayOfThisWeekIso() {
  const d = new Date()
  const diff = (d.getDay() + 6) % 7 // 0 = segunda-feira
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}
function isoRange(startIso, endIso) {
  const out = []
  let cur = new Date(startIso + 'T12:00:00')
  const end = new Date(endIso + 'T12:00:00')
  while (cur <= end) { out.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
  return out
}
function fmtDia(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
}

export default function Supervisao() {
  const { data: turmas, loading: loadingTurmas } = useSupabaseData(
    'turmas', '*, modalidades(nome), polos(id,nome,bairro), profiles(nome)'
  )
  const [chamadas, setChamadas] = useState([])
  const [loadingChamadas, setLoadingChamadas] = useState(true)

  const segunda = mondayOfThisWeekIso()
  const hoje = todayIso()
  const dias = isoRange(segunda, hoje)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingChamadas(true)
      const ids = (turmas ?? []).map(t => t.id)
      if (!ids.length) { if (!cancelled) { setChamadas([]); setLoadingChamadas(false) }; return }
      const { data } = await supabase.from('chamadas').select('*')
        .in('turma_id', ids).gte('data', segunda).lte('data', hoje)
      if (!cancelled) { setChamadas(data ?? []); setLoadingChamadas(false) }
    }
    if (!loadingTurmas) load()
    return () => { cancelled = true }
  }, [turmas, loadingTurmas, segunda, hoje])

  const turmasAtivas = (turmas ?? []).filter(t => t.status !== 'Inativa')

  const chamadasPorTurma = {}
  for (const c of chamadas) {
    if (!chamadasPorTurma[c.turma_id]) chamadasPorTurma[c.turma_id] = {}
    chamadasPorTurma[c.turma_id][c.data] = c
  }

  // Para cada turma: dias em que ela tem aula programada dentro da semana até hoje,
  // e quantos desses dias já tiveram chamada registrada.
  const linhas = turmasAtivas.map(t => {
    const diasEsperados = dias.filter(d => {
      const dow = new Date(d + 'T12:00:00').getDay()
      return (t.dias ?? []).some(nome => DIAS_JS[nome] === dow)
    })
    const diasFeitos = diasEsperados.filter(d => chamadasPorTurma[t.id]?.[d])
    return {
      turma: t,
      diasEsperados,
      pendente: diasEsperados.length - diasFeitos.length,
      chamadaHoje: chamadasPorTurma[t.id]?.[hoje] ?? null,
      esperaHoje: diasEsperados.includes(hoje),
    }
  })

  const porProfessor = {}
  for (const l of linhas) {
    if (l.diasEsperados.length === 0) continue // sem aula programada nesses dias — não entra na cobrança
    const nome = l.turma.profiles?.nome ?? 'Sem professor'
    if (!porProfessor[nome]) porProfessor[nome] = { feitos: 0, esperados: 0, turmas: [] }
    const diasFeitos = l.diasEsperados.length - l.pendente
    porProfessor[nome].feitos += diasFeitos
    porProfessor[nome].esperados += l.diasEsperados.length
    porProfessor[nome].turmas.push(l)
  }
  const professoresOrdenados = Object.entries(porProfessor)
    .map(([nome, v]) => ({ nome, ...v, pct: v.esperados > 0 ? Math.round(v.feitos / v.esperados * 100) : 100 }))
    .sort((a, b) => a.pct - b.pct)

  const pendentesHoje = linhas.filter(l => l.esperaHoje && !l.chamadaHoje)
  const loading = loadingTurmas || loadingChamadas

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Supervisão de Chamadas" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <Radar size={14} className="flex-shrink-0 mt-0.5" />
          <span>Semana atual ({fmtDia(segunda)} — {fmtDia(hoje)}). Considera só os dias em que cada turma tem aula programada.</span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <>
            {/* Resumo de hoje */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Turmas com aula hoje</p>
                <p className="text-2xl font-extrabold text-navy-900 dark:text-white">{linhas.filter(l => l.esperaHoje).length}</p>
              </div>
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Já fizeram chamada</p>
                <p className="text-2xl font-extrabold text-emerald-600">{linhas.filter(l => l.esperaHoje && l.chamadaHoje).length}</p>
              </div>
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ainda não fizeram</p>
                <p className="text-2xl font-extrabold text-red-500">{pendentesHoje.length}</p>
              </div>
            </div>

            {/* Por professor — quem está usando, quem não está */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              <p className="text-xs font-bold text-navy-900 dark:text-white px-4 py-3 border-b border-slate-100 dark:border-navy-700">
                Adesão por professor — esta semana
              </p>
              <div className="divide-y divide-slate-100 dark:divide-navy-700">
                {professoresOrdenados.map(p => (
                  <div key={p.nome} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-navy-900 dark:text-white">{p.nome}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.pct === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : p.pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>{p.feitos}/{p.esperados} · {p.pct}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.turmas.map(l => (
                        <span key={l.turma.id} className={`text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 ${
                          l.pendente === 0 ? 'bg-slate-50 dark:bg-navy-900/40 text-slate-500 dark:text-slate-400'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        }`}>
                          {l.pendente === 0 ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                          {l.turma.modalidades?.nome ?? '—'} · {l.turma.polos?.bairro ?? l.turma.polos?.nome ?? '—'}
                          {l.pendente > 0 && ` (${l.pendente} pendente${l.pendente > 1 ? 's' : ''})`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {professoresOrdenados.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma turma com aula programada nesta semana.</p>
                )}
              </div>
            </div>

            {/* Detalhe por turma */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              <p className="text-xs font-bold text-navy-900 dark:text-white px-4 py-3 border-b border-slate-100 dark:border-navy-700">
                Detalhe por turma
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-navy-900/40">
                      <th className="text-left px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">Turma</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Polo</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Professor</th>
                      {dias.map(d => (
                        <th key={d} className={`px-2 py-2 font-semibold text-center whitespace-nowrap ${d === hoje ? 'text-primary-600' : 'text-slate-500'}`}>{fmtDia(d)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                    {linhas.map(l => (
                      <tr key={l.turma.id}>
                        <td className="px-4 py-2 font-medium text-navy-900 dark:text-white whitespace-nowrap">{l.turma.modalidades?.nome ?? '—'} · {l.turma.faixa}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{l.turma.polos?.bairro ?? l.turma.polos?.nome ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{l.turma.profiles?.nome ?? '—'}</td>
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
                    {linhas.length === 0 && (
                      <tr><td colSpan={3 + dias.length} className="px-4 py-8 text-center text-slate-400">Nenhuma turma cadastrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

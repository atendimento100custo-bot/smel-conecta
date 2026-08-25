// src/hooks/useMinhasChamadasSemana.js
import { useState, useEffect } from 'react'
import { useSupabaseData } from './useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { todayIso, mondayOfThisWeekIso, isoRange, calcularAdesaoSemana } from '../lib/semana'

// Turmas + adesão de chamada da semana atual, escopadas ao usuário logado:
// professor/estagiário → só as turmas atribuídas a ele; coordenador/admin → todas.
// Usado pelo resumo pessoal da Presença e pela Dashboard simplificada (staff).
export function useMinhasChamadasSemana() {
  const { profile, isAdmin, isCoordenador, isProfessor } = useAuth()
  const { data: allTurmas, loading: turmasLoading } = useSupabaseData(
    'turmas', '*, modalidades(nome,emoji), polos(id,nome,bairro,tipo), profiles(nome)'
  )
  const [myTurmaIds, setMyTurmaIds] = useState(null)
  const [chamadas, setChamadas] = useState([])
  const [loadingChamadas, setLoadingChamadas] = useState(true)

  const segunda = mondayOfThisWeekIso()
  const hoje = todayIso()
  const dias = isoRange(segunda, hoje)

  useEffect(() => {
    if (!profile) return
    if (isAdmin || isCoordenador) { setMyTurmaIds(null); return }
    supabase.from('atribuicoes').select('turma_id').eq('usuario_id', profile.id)
      .not('turma_id', 'is', null)
      .then(({ data }) => setMyTurmaIds((data ?? []).map(a => a.turma_id)))
  }, [profile, isAdmin, isCoordenador])

  const turmas = (() => {
    if (!profile || turmasLoading) return []
    if (isAdmin || isCoordenador) return allTurmas.filter(t => t.status !== 'Inativa')
    if (myTurmaIds === null) return []
    const ids = new Set(myTurmaIds ?? [])
    return allTurmas.filter(t => t.status !== 'Inativa' && (ids.has(t.id) || (isProfessor && t.professor_id === profile.id)))
  })()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingChamadas(true)
      const ids = turmas.map(t => t.id)
      if (!ids.length) { if (!cancelled) { setChamadas([]); setLoadingChamadas(false) }; return }
      const { data } = await supabase.from('chamadas').select('*')
        .in('turma_id', ids).gte('data', segunda).lte('data', hoje)
      if (!cancelled) { setChamadas(data ?? []); setLoadingChamadas(false) }
    }
    if (!turmasLoading && myTurmaIds !== undefined) load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmas.map(t => t.id).join(','), turmasLoading, segunda, hoje])

  const chamadasPorTurma = {}
  for (const c of chamadas) {
    if (!chamadasPorTurma[c.turma_id]) chamadasPorTurma[c.turma_id] = {}
    chamadasPorTurma[c.turma_id][c.data] = c
  }

  const linhas = calcularAdesaoSemana(turmas, chamadasPorTurma, dias)
  const comAula = linhas.filter(l => l.diasEsperados.length > 0)
  const totalEsperado = comAula.reduce((s, l) => s + l.diasEsperados.length, 0)
  const totalFeito = comAula.reduce((s, l) => s + l.diasFeitos.length, 0)
  const pctSemana = totalEsperado > 0 ? Math.round((totalFeito / totalEsperado) * 100) : 100
  const pendencias = comAula.filter(l => l.pendente > 0)
  const turmasHoje = linhas.filter(l => l.diasEsperados.includes(hoje))
  const chamadaHojePendente = turmasHoje.filter(l => !chamadasPorTurma[l.turma.id]?.[hoje])

  return {
    loading: turmasLoading || loadingChamadas,
    turmas, linhas, chamadasPorTurma,
    segunda, hoje, dias,
    totalEsperado, totalFeito, pctSemana, pendencias,
    turmasHoje, chamadaHojePendente,
  }
}

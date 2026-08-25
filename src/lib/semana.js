// src/lib/semana.js
// Helpers de data/semana compartilhados entre Presença, Dashboard (staff) e Supervisão.

export const DIAS_JS = { 'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function mondayOfThisWeekIso() {
  const d = new Date()
  const diff = (d.getDay() + 6) % 7 // 0 = segunda-feira
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

export function isoRange(startIso, endIso) {
  const out = []
  let cur = new Date(startIso + 'T12:00:00')
  const end = new Date(endIso + 'T12:00:00')
  while (cur <= end) { out.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
  return out
}

export function fmtDiaCurto(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
}

// Dado um conjunto de turmas (com campo .dias) e um mapa turma_id -> {data: chamada},
// calcula quantos dias esperados (dentro do range) já tiveram chamada registrada.
export function calcularAdesaoSemana(turmas, chamadasPorTurma, dias) {
  return turmas.map(t => {
    const diasEsperados = dias.filter(d => {
      const dow = new Date(d + 'T12:00:00').getDay()
      return (t.dias ?? []).some(nome => DIAS_JS[nome] === dow)
    })
    const diasFeitos = diasEsperados.filter(d => chamadasPorTurma[t.id]?.[d])
    return {
      turma: t,
      diasEsperados,
      diasFeitos,
      pendente: diasEsperados.length - diasFeitos.length,
    }
  })
}

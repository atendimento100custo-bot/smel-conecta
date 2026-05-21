// src/pdf/RelatorioCompleto.jsx
import { Document, Page, Text, View, StyleSheet, Svg, Rect, G } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const GREEN = '#009640'
const NAVY = '#0f1923'
const SLATE = '#64748b'
const LIGHT = '#f8fafc'
const BORDER = '#e2e8f0'

const PROG_LABELS = { viva_melhor: 'Viva Melhor', viva_mais: 'Viva Mais+', viva_esporte: 'Viva o Esporte', viva_todos: 'Viva para Todos' }
const PROG_FAIXA = { viva_melhor: 'Melhor Idade', viva_mais: 'Adulto', viva_esporte: 'Infantil', viva_todos: 'PCD / Inclusão' }
const PROG_COLORS = { viva_melhor: '#7c3aed', viva_mais: '#0284c7', viva_esporte: '#059669', viva_todos: '#d97706' }

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: NAVY, backgroundColor: '#fff' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  logoBox: { flexDirection: 'column' },
  logoMain: { fontSize: 16, fontWeight: 'bold', color: GREEN, letterSpacing: 1 },
  logoSub: { fontSize: 7, color: SLATE, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  headerLabel: { fontSize: 7, color: SLATE },
  headerValue: { fontSize: 9, fontWeight: 'bold', color: NAVY, marginTop: 1 },
  divider: { height: 2, backgroundColor: GREEN, marginBottom: 14 },

  // Section title
  secTitle: { fontSize: 7, fontWeight: 'bold', color: SLATE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },

  // KPI row
  kpiRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  kpiBox: { flex: 1, borderRadius: 6, padding: 8 },
  kpiLabel: { fontSize: 6, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8, color: '#fff', marginBottom: 3 },
  kpiValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  kpiSub: { fontSize: 6, color: '#fff', opacity: 0.7, marginTop: 2 },

  // Tables
  table: { marginBottom: 14 },
  tHeaderRow: { flexDirection: 'row', backgroundColor: LIGHT, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 0.5, borderColor: BORDER, paddingVertical: 5, paddingHorizontal: 6 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: BORDER, paddingVertical: 5, paddingHorizontal: 6 },
  tRowAlt: { backgroundColor: LIGHT },
  tCell: { flex: 1, fontSize: 8, color: NAVY },
  tCellHdr: { flex: 1, fontSize: 7, fontWeight: 'bold', color: SLATE },
  tCellWide: { flex: 2, fontSize: 8, color: NAVY },
  tCellHdrWide: { flex: 2, fontSize: 7, fontWeight: 'bold', color: SLATE },

  // Demandas
  demandasBox: { borderWidth: 0.5, borderColor: BORDER, borderRadius: 4, padding: 10, marginBottom: 14 },
  demandasText: { fontSize: 8, color: NAVY, lineHeight: 1.6 },

  // Footer
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 6, color: '#94a3b8' },
})

// ─── Bar chart SVG ──────────────────────────────────────────────────────────
function BarChartSvg({ data, width = 380, height = 110 }) {
  if (!data || !data.length) return null
  const padL = 28, padR = 10, padT = 10, padB = 28
  const chartW = width - padL - padR
  const chartH = height - padT - padB
  const maxFreq = Math.max(...data.map(d => d['Freq.%']), 1)
  const barW = Math.floor(chartW / data.length / 2.5)
  const gap = Math.floor(chartW / data.length)

  return (
    <Svg width={width} height={height} style={{ marginBottom: 8 }}>
      {/* Y grid lines */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = padT + chartH - (v / 100) * chartH
        return (
          <G key={v}>
            <Rect x={padL} y={y} width={chartW} height={0.5} fill="#f1f5f9" />
            <Rect x={padL - 18} y={y - 4} width={18} height={8} fill="transparent" />
          </G>
        )
      })}

      {data.map((d, i) => {
        const x = padL + i * gap + gap / 2
        const freqH = Math.max(1, (d['Freq.%'] / 100) * chartH)
        const novosH = Math.max(1, (d['Novos'] / Math.max(...data.map(d2 => d2['Novos']), 1)) * chartH * 0.6)
        const freqY = padT + chartH - freqH
        const novosY = padT + chartH - novosH

        return (
          <G key={i}>
            {/* Freq bar */}
            <Rect x={x - barW - 1} y={freqY} width={barW} height={freqH} fill={GREEN} rx={2} />
            {/* Novos bar */}
            <Rect x={x + 1} y={novosY} width={barW} height={novosH} fill="#0284c7" rx={2} />
            {/* X label */}
            <Rect x={x - 14} y={padT + chartH + 6} width={28} height={10} fill="transparent" />
          </G>
        )
      })}

      {/* X labels via Text workaround - simplified */}
      {data.map((d, i) => {
        const x = padL + i * gap + gap / 2 - 10
        return (
          <G key={'lbl' + i}>
            <Rect x={x} y={padT + chartH + 4} width={20} height={10} fill="transparent" />
          </G>
        )
      })}
    </Svg>
  )
}

// ─── Program stats helper ────────────────────────────────────────────────────
function getProgStats(prog, turmas, alunos, presencas, mesInt, anoInt) {
  const isVivaTodos = prog === 'viva_todos'
  const faixa = PROG_FAIXA[prog]
  const turmasFiltradas = isVivaTodos
    ? turmas.filter(t => t.faixa_etaria?.toLowerCase().includes('pcd') || t.faixa_etaria?.toLowerCase().includes('inclu'))
    : turmas.filter(t => t.faixa === (faixa === 'PCD / Inclusão' ? undefined : faixa))
  const ids = new Set(turmasFiltradas.map(t => t.id))
  const ativos = alunos.filter(a => ids.has(a.turma_id) && a.status === 'Ativo')
  const total = ativos.length
  const homens = ativos.filter(a => a.genero === 'M').length
  const mulheres = ativos.filter(a => a.genero === 'F').length
  const ini = new Date(anoInt, mesInt - 1, 1).toISOString().split('T')[0]
  const fim = new Date(anoInt, mesInt, 0).toISOString().split('T')[0]
  const novos = ativos.filter(a => a.data_matricula >= ini && a.data_matricula <= fim).length
  const pres = presencas.filter(p => ids.has(p.turma_id) && p.data >= ini && p.data <= fim)
  const freq = pres.length ? Math.round(pres.filter(p => p.status === 'presente' || p.status === 'justificado').length / pres.length * 100) : 0
  return { total, homens, mulheres, novos, freq }
}

// ─── Main component ──────────────────────────────────────────────────────────
export function RelatorioCompleto({ polo, turmas = [], alunos = [], presencas = [], mes, ano, freqUltimos6 = [], demandas }) {
  const periodo = format(new Date(ano, mes - 1, 1), 'MMMM / yyyy', { locale: ptBR })
  const nomePolo = polo?.nome ?? 'Todos os Polos'

  // Global KPIs
  const ini = new Date(ano, mes - 1, 1).toISOString().split('T')[0]
  const fim = new Date(ano, mes, 0).toISOString().split('T')[0]
  const totalAtivos = alunos.filter(a => a.status === 'Ativo').length
  const novosNoMes = alunos.filter(a => a.status === 'Ativo' && a.data_matricula >= ini && a.data_matricula <= fim).length
  const presMes = presencas.filter(p => p.data >= ini && p.data <= fim)
  const freqMedia = presMes.length ? Math.round(presMes.filter(p => p.status === 'presente' || p.status === 'justificado').length / presMes.length * 100) : 0
  const turmasAtivas = turmas.filter(t => t.status === 'Ativa').length
  const melhorIdade = alunos.filter(a => a.status === 'Ativo' && a.data_nasc && new Date().getFullYear() - new Date(a.data_nasc).getFullYear() >= 60).length

  // Program rows
  const progKeys = ['viva_melhor', 'viva_mais', 'viva_esporte', 'viva_todos']
  const progStats = progKeys.map(k => ({ key: k, ...getProgStats(k, turmas, alunos, presencas, mes, ano) }))

  // Modalidades
  const modalMap = {}
  turmas.forEach(t => {
    const nome = t.modalidades?.nome ?? 'Outros'
    if (!modalMap[nome]) modalMap[nome] = 0
    modalMap[nome] += alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
  })
  const modalidades = Object.entries(modalMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxMod = Math.max(...modalidades.map(([, v]) => v), 1)

  const emitido = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoMain}>SMEL · CONECTA</Text>
            <Text style={s.logoSub}>Secretaria Municipal de Esporte e Lazer — Volta Redonda</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerLabel}>Polo</Text>
            <Text style={s.headerValue}>{nomePolo}</Text>
            <Text style={[s.headerLabel, { marginTop: 4 }]}>Período</Text>
            <Text style={s.headerValue}>{periodo}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* ── KPI Cards ── */}
        <Text style={s.secTitle}>Indicadores do Período</Text>
        <View style={s.kpiRow}>
          {[
            { label: 'Alunos Ativos', value: totalAtivos, sub: 'total geral', bg: '#1d4ed8' },
            { label: 'Novos no Mês', value: novosNoMes, sub: 'matrículas', bg: '#059669' },
            { label: 'Frequência', value: `${freqMedia}%`, sub: 'média', bg: '#0284c7' },
            { label: 'Turmas Ativas', value: turmasAtivas, sub: 'em funcionamento', bg: '#7c3aed' },
            { label: 'Melhor Idade', value: melhorIdade, sub: 'alunos 60+', bg: '#d97706' },
          ].map((k, i) => (
            <View key={i} style={[s.kpiBox, { backgroundColor: k.bg }]}>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={s.kpiValue}>{k.value}</Text>
              <Text style={s.kpiSub}>{k.sub}</Text>
            </View>
          ))}
        </View>

        {/* ── Por Programa ── */}
        <Text style={s.secTitle}>Por Programa</Text>
        <View style={s.table}>
          <View style={s.tHeaderRow}>
            <Text style={s.tCellHdrWide}>Programa</Text>
            <Text style={s.tCellHdr}>Total</Text>
            <Text style={s.tCellHdr}>Homens</Text>
            <Text style={s.tCellHdr}>Mulheres</Text>
            <Text style={s.tCellHdr}>N/I</Text>
            <Text style={s.tCellHdr}>Novos</Text>
            <Text style={s.tCellHdr}>Freq.%</Text>
          </View>
          {progStats.map((p, i) => (
            <View key={p.key} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, backgroundColor: PROG_COLORS[p.key], borderRadius: 3 }} />
                <Text style={[s.tCell, { flex: 0, fontSize: 8 }]}>{PROG_LABELS[p.key]}</Text>
              </View>
              <Text style={s.tCell}>{p.total}</Text>
              <Text style={s.tCell}>{p.homens}</Text>
              <Text style={s.tCell}>{p.mulheres}</Text>
              <Text style={s.tCell}>{p.total - p.homens - p.mulheres}</Text>
              <Text style={[s.tCell, { color: GREEN, fontWeight: 'bold' }]}>+{p.novos}</Text>
              <Text style={s.tCell}>{p.freq}%</Text>
            </View>
          ))}
          {/* Total row */}
          <View style={[s.tRow, { backgroundColor: '#f0fdf4' }]}>
            <View style={{ flex: 2 }}>
              <Text style={[s.tCell, { fontWeight: 'bold' }]}>TOTAL GERAL</Text>
            </View>
            <Text style={[s.tCell, { fontWeight: 'bold' }]}>{totalAtivos}</Text>
            <Text style={[s.tCell, { fontWeight: 'bold' }]}>{progStats.reduce((s, p) => s + p.homens, 0)}</Text>
            <Text style={[s.tCell, { fontWeight: 'bold' }]}>{progStats.reduce((s, p) => s + p.mulheres, 0)}</Text>
            <Text style={[s.tCell, { fontWeight: 'bold' }]}>{progStats.reduce((s, p) => s + (p.total - p.homens - p.mulheres), 0)}</Text>
            <Text style={[s.tCell, { fontWeight: 'bold', color: GREEN }]}>+{novosNoMes}</Text>
            <Text style={[s.tCell, { fontWeight: 'bold' }]}>{freqMedia}%</Text>
          </View>
        </View>

        {/* ── Freq últimos 6 meses ── */}
        {freqUltimos6.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={s.secTitle}>Frequência e Novos Alunos — Últimos 6 Meses</Text>
            <BarChartSvg data={freqUltimos6} width={524} height={110} />
            {/* Legend */}
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 10, height: 6, backgroundColor: GREEN, borderRadius: 2 }} />
                <Text style={{ fontSize: 7, color: SLATE }}>Freq.%</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 10, height: 6, backgroundColor: '#0284c7', borderRadius: 2 }} />
                <Text style={{ fontSize: 7, color: SLATE }}>Novos</Text>
              </View>
              <View style={{ flex: 1 }} />
              {freqUltimos6.map((d, i) => (
                <Text key={i} style={{ fontSize: 7, color: SLATE }}>{d.mes}: {d['Freq.%']}%</Text>
              ))}
            </View>
          </View>
        )}

        {/* ── Modalidades ── */}
        {modalidades.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={s.secTitle}>Alunos por Modalidade</Text>
            {modalidades.map(([nome, total], i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                <Text style={{ fontSize: 7, color: SLATE, width: 100 }}>{nome}</Text>
                <View style={{ flex: 1, height: 10, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round(total / maxMod * 100)}%`, height: 10, backgroundColor: GREEN, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, width: 24, textAlign: 'right' }}>{total}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Demandas ── */}
        <Text style={s.secTitle}>Demandas do Polo</Text>
        <View style={s.demandasBox}>
          {demandas ? (
            <Text style={s.demandasText}>{demandas}</Text>
          ) : (
            <Text style={[s.demandasText, { color: SLATE, fontStyle: 'italic' }]}>Nenhuma demanda registrada para este período.</Text>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>SMEL Conecta · Volta Redonda</Text>
          <Text style={s.footerText}>Emitido em {emitido}</Text>
          <Text style={s.footerText}>Relatório gerado automaticamente pelo sistema</Text>
        </View>

      </Page>
    </Document>
  )
}

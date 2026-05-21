// src/pdf/RelatorioPresenca.jsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9 },
  header: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#009640', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#64748b' },
  table: { marginTop: 12 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#e2e8f0', paddingVertical: 5 },
  headerRow: { backgroundColor: '#f8fafc' },
  cell: { flex: 1, fontSize: 8 },
  cellBold: { flex: 1, fontSize: 8, fontWeight: 'bold', color: '#0f1923' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 7, color: '#94a3b8' },
})

export function RelatorioPresenca({ turma, alunos, presencas, mes, ano }) {
  const titulo = `Relatório de Presença — ${turma?.modalidades?.nome ?? 'Todas as turmas'} ${turma?.faixa ?? ''}`
  const periodo = format(new Date(ano, mes - 1, 1), 'MMMM / yyyy', { locale: ptBR })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>SMEL Conecta — Volta Redonda</Text>
          <Text style={styles.subtitle}>{titulo}</Text>
          <Text style={styles.subtitle}>Período: {periodo}</Text>
          <Text style={styles.subtitle}>Emitido em: {format(new Date(), 'dd/MM/yyyy')}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={styles.cellBold}>Aluno</Text>
            <Text style={styles.cellBold}>Presenças</Text>
            <Text style={styles.cellBold}>Faltas</Text>
            <Text style={styles.cellBold}>Frequência</Text>
          </View>

          {alunos.map(aluno => {
            const aPresencas = presencas.filter(p => p.aluno_id === aluno.id)
            const presentes = aPresencas.filter(p => p.status === 'presente' || p.status === 'justificado').length
            const faltas = aPresencas.filter(p => p.status === 'falta').length
            const freq = aPresencas.length ? Math.round((presentes / aPresencas.length) * 100) : 0
            return (
              <View key={aluno.id} style={styles.row}>
                <Text style={styles.cell}>{aluno.nome}</Text>
                <Text style={styles.cell}>{presentes}</Text>
                <Text style={styles.cell}>{faltas}</Text>
                <Text style={styles.cell}>{freq}%</Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.footer}>
          SMEL — Secretaria Municipal de Esportes e Lazer — Volta Redonda/RJ
        </Text>
      </Page>
    </Document>
  )
}

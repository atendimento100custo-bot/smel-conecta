// src/pdf/RelatorioAlunos.jsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'

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

export function RelatorioAlunos({ turma, alunos }) {
  const titulo = `Lista de Alunos — ${turma?.modalidades?.nome ?? 'Todas as turmas'}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>SMEL Conecta — Volta Redonda</Text>
          <Text style={styles.subtitle}>{titulo}</Text>
          <Text style={styles.subtitle}>Emitido em: {format(new Date(), 'dd/MM/yyyy')}</Text>
          <Text style={styles.subtitle}>Total: {alunos.length} alunos</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={styles.cellBold}>Nome</Text>
            <Text style={styles.cellBold}>CPF</Text>
            <Text style={styles.cellBold}>Telefone</Text>
            <Text style={styles.cellBold}>Status</Text>
          </View>
          {alunos.map(aluno => (
            <View key={aluno.id} style={styles.row}>
              <Text style={styles.cell}>{aluno.nome}</Text>
              <Text style={styles.cell}>{aluno.cpf ?? '—'}</Text>
              <Text style={styles.cell}>{aluno.telefone ?? '—'}</Text>
              <Text style={styles.cell}>{aluno.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          SMEL — Secretaria Municipal de Esportes e Lazer — Volta Redonda/RJ
        </Text>
      </Page>
    </Document>
  )
}

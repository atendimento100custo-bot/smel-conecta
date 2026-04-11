// src/pages/Relatorios.jsx
import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { RelatorioPresenca } from '../pdf/RelatorioPresenca'
import { RelatorioAlunos } from '../pdf/RelatorioAlunos'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import { FileDown } from 'lucide-react'

export default function Relatorios() {
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome), polos(nome)')
  const { data: alunos } = useSupabaseData('alunos')
  const { data: presencas } = useSupabaseData('presencas')

  const hoje = new Date()
  const [turmaId, setTurmaId] = useState('')
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(hoje.getFullYear()))

  const turmaSel = turmas.find(t => t.id === turmaId)
  const alunosFiltrados = alunos.filter(a => !turmaId || a.turma_id === turmaId)
  const presencasFiltradas = presencas.filter(p => {
    const d = new Date(p.data)
    return (!turmaId || p.turma_id === turmaId) &&
      d.getMonth() + 1 === parseInt(mes) &&
      d.getFullYear() === parseInt(ano)
  })

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Relatórios PDF" />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-lg">
          <p className="text-sm font-bold text-navy-900 mb-4">Filtros</p>

          <div className="space-y-3 mb-5">
            <div>
              <label className={labelCls}>Turma</label>
              <select value={turmaId} onChange={e => setTurmaId(e.target.value)} className={inputCls}>
                <option value="">Todas as turmas</option>
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.modalidades?.nome} — {t.faixa} ({t.polos?.nome})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Mês</label>
                <select value={mes} onChange={e => setMes(e.target.value)} className={inputCls}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                      {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ano</label>
                <input
                  type="number"
                  value={ano}
                  onChange={e => setAno(e.target.value)}
                  min="2020"
                  max="2030"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-navy-900 mb-2">Exportar</p>

            <PDFDownloadLink
              document={
                <RelatorioPresenca
                  turma={turmaSel}
                  alunos={alunosFiltrados}
                  presencas={presencasFiltradas}
                  mes={parseInt(mes)}
                  ano={parseInt(ano)}
                />
              }
              fileName={`smel-presenca-${mes}-${ano}.pdf`}
              className="block"
            >
              {({ loading: l }) => (
                <Button disabled={l} className="w-full justify-center">
                  <FileDown size={14} />
                  {l ? 'Gerando...' : 'Baixar Relatório de Presença'}
                </Button>
              )}
            </PDFDownloadLink>

            <PDFDownloadLink
              document={<RelatorioAlunos turma={turmaSel} alunos={alunosFiltrados} />}
              fileName={`smel-alunos-${mes}-${ano}.pdf`}
              className="block"
            >
              {({ loading: l }) => (
                <Button variant="secondary" disabled={l} className="w-full justify-center">
                  <FileDown size={14} />
                  {l ? 'Gerando...' : 'Baixar Lista de Alunos'}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </div>
    </div>
  )
}

// src/pages/Relatorios.jsx
import { useState, useMemo, useRef } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'
import { FileDown, Save, Upload, X, TrendingUp, Users, BookOpen, Star } from 'lucide-react'
import { RelatorioCompleto } from '../pdf/RelatorioCompleto'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PROG_COLORS = { viva_melhor: '#7c3aed', viva_mais: '#0284c7', viva_esporte: '#059669', viva_todos: '#d97706' }
const PROG_LABELS = { viva_melhor: 'Viva Melhor', viva_mais: 'Viva Mais+', viva_esporte: 'Viva o Esporte', viva_todos: 'Viva para Todos' }
const PROG_EMOJIS = { viva_melhor: '🌿', viva_mais: '💪', viva_esporte: '⚽', viva_todos: '🤝' }
const PROG_FAIXA = { viva_melhor: 'Melhor Idade', viva_mais: 'Adulto', viva_esporte: 'Infantil' }
const KPI_COLORS = { primary: 'from-primary-700 to-primary-500', emerald: 'from-emerald-700 to-emerald-500', sky: 'from-sky-700 to-sky-500', purple: 'from-purple-700 to-purple-500', amber: 'from-amber-600 to-amber-400' }

function KpiCard({ label, value, sub, icon: Icon, color = 'primary' }) {
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${KPI_COLORS[color]} text-white`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</p>
        {Icon && <Icon size={13} className="opacity-60" />}
      </div>
      <p className="text-3xl font-extrabold leading-none">{value}</p>
      {sub && <p className="text-[10px] mt-1 opacity-70">{sub}</p>}
    </div>
  )
}

function ProgramCard({ prog, turmas, alunos, presencas, mesInt, anoInt }) {
  const faixa = PROG_FAIXA[prog]
  const isVivaTodos = prog === 'viva_todos'
  const turmasFiltradas = isVivaTodos
    ? turmas.filter(t => t.faixa_etaria?.toLowerCase().includes('pcd') || t.faixa_etaria?.toLowerCase().includes('inclu'))
    : faixa ? turmas.filter(t => t.faixa === faixa) : []
  const ids = new Set(turmasFiltradas.map(t => t.id))
  const ativos = alunos.filter(a => ids.has(a.turma_id) && a.status === 'Ativo')
  const total = ativos.length
  const homens = ativos.filter(a => a.genero === 'M').length
  const mulheres = ativos.filter(a => a.genero === 'F').length
  const ini = new Date(anoInt, mesInt - 1, 1).toISOString().split('T')[0]
  const fim = new Date(anoInt, mesInt, 0).toISOString().split('T')[0]
  const novos = ativos.filter(a => a.data_matricula >= ini && a.data_matricula <= fim).length
  const pres = presencas.filter(p => ids.has(p.turma_id))
  const freq = pres.length ? Math.round(pres.filter(p => p.presente).length / pres.length * 100) : 0
  const cor = PROG_COLORS[prog]

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{PROG_EMOJIS[prog]}</span>
        <div>
          <p className="text-xs font-bold text-navy-900 dark:text-white">{PROG_LABELS[prog]}</p>
          <p className="text-[9px] text-slate-400">{faixa ?? 'Inclusão/PCD'}</p>
        </div>
      </div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-3xl font-extrabold text-navy-900 dark:text-white">{total}</p>
          <p className="text-[9px] text-slate-400">alunos ativos</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold" style={{ color: cor }}>+{novos}</p>
          <p className="text-[9px] text-slate-400">novos no mês</p>
        </div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between mb-0.5">
          <span className="text-[9px] text-slate-400">Frequência</span>
          <span className="text-[9px] font-bold" style={{ color: cor }}>{freq}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${freq}%`, backgroundColor: cor }} />
        </div>
      </div>
      <div className="flex gap-3 text-[10px]">
        <span>👨 <b>{homens}</b> homens</span>
        <span>👩 <b>{mulheres}</b> mulheres</span>
        {total - homens - mulheres > 0 && <span className="text-slate-400">{total - homens - mulheres} n/i</span>}
      </div>
    </div>
  )
}

function Tooltip2({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg shadow px-3 py-2 text-xs">
      <p className="font-bold mb-1">{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color ?? p.fill }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

export default function Relatorios() {
  const { profile } = useAuth()
  const hoje = new Date()
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome,emoji), polos(nome)')
  const { data: alunos } = useSupabaseData('alunos', 'id,nome,status,turma_id,data_nasc,data_matricula,genero')
  const { data: presencas } = useSupabaseData('presencas', 'id,data,presente,turma_id')
  const { data: modalidades } = useSupabaseData('modalidades', 'id,nome,emoji')
  const { data: polos } = useSupabaseData('polos', 'id,nome')

  const [filtroPoloId, setFiltroPoloId] = useState('')
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(hoje.getFullYear()))
  const [demandas, setDemandas] = useState('')
  const [arquivos, setArquivos] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  const mesInt = parseInt(mes), anoInt = parseInt(ano)
  const ini = new Date(anoInt, mesInt - 1, 1).toISOString().split('T')[0]
  const fim = new Date(anoInt, mesInt, 0).toISOString().split('T')[0]

  const turmasFiltradas = useMemo(() => filtroPoloId ? turmas.filter(t => t.polo_id === filtroPoloId) : turmas, [turmas, filtroPoloId])
  const turmaIds = useMemo(() => new Set(turmasFiltradas.map(t => t.id)), [turmasFiltradas])
  const alunosFiltrados = useMemo(() => alunos.filter(a => turmaIds.has(a.turma_id) && a.status === 'Ativo'), [alunos, turmaIds])
  const presencasFiltradas = useMemo(() => presencas.filter(p => turmaIds.has(p.turma_id)), [presencas, turmaIds])
  const presencasMes = useMemo(() => presencasFiltradas.filter(p => p.data >= ini && p.data <= fim), [presencasFiltradas, ini, fim])

  const totalAtivos = alunosFiltrados.length
  const novosNoMes = alunosFiltrados.filter(a => a.data_matricula >= ini && a.data_matricula <= fim).length
  const freqMedia = presencasMes.length ? Math.round(presencasMes.filter(p => p.presente).length / presencasMes.length * 100) : 0
  const turmasAtivas = turmasFiltradas.filter(t => t.status === 'Ativa').length
  const melhorIdade = alunosFiltrados.filter(a => a.data_nasc && new Date().getFullYear() - new Date(a.data_nasc).getFullYear() >= 60).length

  const freqUltimos6 = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(anoInt, mesInt - 1, 1), 5 - i)
    const i0 = format(startOfMonth(d), 'yyyy-MM-dd'), i1 = format(endOfMonth(d), 'yyyy-MM-dd')
    const pMes = presencasFiltradas.filter(p => p.data >= i0 && p.data <= i1)
    return {
      mes: format(d, 'MMM/yy', { locale: ptBR }),
      'Freq.%': pMes.length ? Math.round(pMes.filter(p => p.presente).length / pMes.length * 100) : 0,
      'Novos': alunos.filter(a => turmaIds.has(a.turma_id) && a.data_matricula >= i0 && a.data_matricula <= i1).length,
    }
  }), [presencasFiltradas, alunos, turmaIds, anoInt, mesInt])

  const porModalidade = useMemo(() => {
    const map = {}
    turmasFiltradas.forEach(t => {
      const nome = t.modalidades?.nome ?? 'Outros'
      if (!map[nome]) map[nome] = { nome, total: 0 }
      map[nome].total += alunosFiltrados.filter(a => a.turma_id === t.id).length
    })
    return Object.values(map).filter(m => m.total > 0).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [turmasFiltradas, alunosFiltrados])

  const pizzaGenero = useMemo(() => {
    const m = alunosFiltrados.filter(a => a.genero === 'M').length
    const f = alunosFiltrados.filter(a => a.genero === 'F').length
    const ni = totalAtivos - m - f
    const data = []
    if (m) data.push({ name: 'Masculino', value: m, color: '#0284c7' })
    if (f) data.push({ name: 'Feminino', value: f, color: '#db2777' })
    if (ni) data.push({ name: 'N/I', value: ni, color: '#94a3b8' })
    return data
  }, [alunosFiltrados, totalAtivos])

  async function handleSaveDemandas() {
    setSaving(true)
    await supabase.from('relatorios_mensais').upsert({ polo_id: filtroPoloId || null, mes: mesInt, ano: anoInt, demandas: demandas || null, arquivos_urls: arquivos, criado_por: profile?.id ?? null }, { onConflict: 'polo_id,mes,ano' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || arquivos.length + files.length > 5) return
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const fn = `demandas/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('registros-aula').upload(fn, file)
      if (!error) { const { data } = supabase.storage.from('registros-aula').getPublicUrl(fn); setArquivos(a => [...a, data.publicUrl]) }
    }
    setUploading(false); e.target.value = ''
  }

  const ic = 'px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'
  const sec = 'text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3'
  const nomePolo = polos.find(p => p.id === filtroPoloId)?.nome ?? 'Todos os Polos'
  const periodoLabel = format(new Date(anoInt, mesInt - 1, 1), 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Relatórios" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-5">

        {/* Filtros */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className={sec}>Polo</label>
              <select value={filtroPoloId} onChange={e => setFiltroPoloId(e.target.value)} className={`w-full ${ic}`}>
                <option value="">Todos os Polos</option>
                {polos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={sec}>Mês</label>
              <select value={mes} onChange={e => setMes(e.target.value)} className={ic}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i+1} value={String(i+1).padStart(2,'0')}>{new Date(2000,i).toLocaleString('pt-BR',{month:'long'})}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={sec}>Ano</label>
              <input type="number" value={ano} onChange={e => setAno(e.target.value)} min="2020" max="2030" className={`w-24 ${ic}`} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">📍 {nomePolo} · 📅 {periodoLabel}</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Alunos Ativos" value={totalAtivos} sub="total geral" icon={Users} color="primary" />
          <KpiCard label="Novos no Mês" value={novosNoMes} sub="matrículas" icon={TrendingUp} color="emerald" />
          <KpiCard label="Frequência" value={`${freqMedia}%`} sub="média no período" icon={TrendingUp} color="sky" />
          <KpiCard label="Turmas Ativas" value={turmasAtivas} sub="em funcionamento" icon={BookOpen} color="purple" />
          <KpiCard label="Melhor Idade" value={melhorIdade} sub="alunos 60+" icon={Star} color="amber" />
        </div>

        {/* Programas */}
        <div>
          <p className={sec}>Por Programa</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {['viva_melhor','viva_mais','viva_esporte','viva_todos'].map(prog => (
              <ProgramCard key={prog} prog={prog} turmas={turmasFiltradas} alunos={alunosFiltrados} presencas={presencasFiltradas} mesInt={mesInt} anoInt={anoInt} />
            ))}
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Frequência e Novos Alunos — Últimos 6 Meses</p>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={freqUltimos6} barSize={12}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<Tooltip2 />} />
                <Bar dataKey="Freq.%" fill="#009640" radius={[3,3,0,0]} />
                <Bar dataKey="Novos" fill="#0284c7" radius={[3,3,0,0]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Distribuição por Gênero</p>
            {pizzaGenero.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={pizzaGenero} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pizzaGenero.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[170px] flex flex-col items-center justify-center gap-2 text-center">
                <p className="text-2xl">📊</p>
                <p className="text-xs text-slate-400">Adicione gênero nos alunos para ver este gráfico.</p>
              </div>
            )}
          </div>
        </div>

        {/* Por modalidade */}
        {porModalidade.length > 0 && (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <p className="text-xs font-bold text-navy-900 dark:text-white mb-3">Alunos por Modalidade</p>
            <ResponsiveContainer width="100%" height={Math.max(120, porModalidade.length * 36)}>
              <BarChart data={porModalidade} layout="vertical" barSize={14}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="nome" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<Tooltip2 />} />
                <Bar dataKey="total" name="Alunos" fill="#009640" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Demandas */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <p className={sec}>📝 Demandas do Polo</p>
          <textarea value={demandas} onChange={e => setDemandas(e.target.value)} rows={4}
            placeholder="Descreva necessidades, observações, solicitações para este polo no período..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-3" />
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Anexos ({arquivos.length}/5)</p>
            {arquivos.length < 5 && (
              <label className={`flex items-center gap-1 text-[11px] font-semibold text-primary-600 cursor-pointer hover:text-primary-700 ${uploading ? 'opacity-50' : ''}`}>
                <Upload size={12}/> {uploading ? 'Enviando...' : 'Adicionar'}
                <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} accept="image/*,.pdf,.doc,.docx" />
              </label>
            )}
          </div>
          {arquivos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {arquivos.map((url, i) => (
                <div key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-navy-700 rounded-lg px-2 py-1">
                  <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-primary-600 hover:underline truncate max-w-[100px]">Arquivo {i+1}</a>
                  <button onClick={() => setArquivos(a => a.filter((_,j) => j !== i))} className="text-slate-400 hover:text-red-500"><X size={11}/></button>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={handleSaveDemandas} disabled={saving}>
            <Save size={13}/> {saved ? '✓ Salvo!' : saving ? 'Salvando...' : 'Salvar Demandas'}
          </Button>
        </div>

        {/* Exportar */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <p className={sec}>Exportar</p>
          <PDFDownloadLink
            document={<RelatorioCompleto polo={polos.find(p => p.id === filtroPoloId) ?? null} turmas={turmasFiltradas} alunos={alunosFiltrados} presencas={presencasFiltradas} mes={mesInt} ano={anoInt} freqUltimos6={freqUltimos6} demandas={demandas} />}
            fileName={`smel-relatorio-${mes}-${ano}${filtroPoloId ? '-' + nomePolo.replace(/\s/g,'-') : ''}.pdf`}
          >
            {({ loading: l }) => (
              <Button disabled={l}><FileDown size={14}/> {l ? 'Gerando PDF...' : 'Exportar Relatório Completo'}</Button>
            )}
          </PDFDownloadLink>
        </div>

      </div>
    </div>
  )
}

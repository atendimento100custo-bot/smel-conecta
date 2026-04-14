// src/pages/Alunos.jsx
import { useState, useRef, useMemo } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Pencil, Trash2, Upload, FileText, CheckCircle2, ArrowLeft, ChevronRight, Search, Filter } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const EMPTY_FORM = {
  nome: '',
  data_nasc: '',
  cpf: '',
  telefone: '',
  telefone_emergencia: '',
  email: '',
  endereco: '',
  foto_url: '',
  status: 'Ativo',
}

function calcIdade(dataNasc) {
  if (!dataNasc) return '—'
  const hoje = new Date()
  const nasc = new Date(dataNasc)
  return hoje.getFullYear() - nasc.getFullYear()
}

function calcTempo(dataMatricula) {
  if (!dataMatricula) return '—'
  const diff = Date.now() - new Date(dataMatricula).getTime()
  const meses = Math.floor(diff / (1000 * 60 * 60 * 24 * 30))
  const anos = Math.floor(meses / 12)
  const mesesRest = meses % 12
  return anos > 0 ? `${anos}a ${mesesRest}m` : `${meses}m`
}

function statusColor(status) {
  if (status === 'Ativo') return 'green'
  if (status === 'Inativo') return 'red'
  if (status === 'Transferido') return 'amber'
  return 'gray'
}

function calcFaixa(dataNasc) {
  if (!dataNasc) return null
  const idade = new Date().getFullYear() - new Date(dataNasc).getFullYear()
  if (idade >= 60) return 'Melhor Idade'
  if (idade >= 18) return 'Adulto'
  return 'Infantil'
}

export default function Alunos() {
  const { isAdmin, isCoordenador, isProfessor, profile } = useAuth()
  const canEdit = isAdmin || isCoordenador || isProfessor
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const turmaIdFilter = searchParams.get('turma_id')

  const { data: alunos, loading, reload } = useSupabaseData('alunos', '*, turmas(*, modalidades(nome), polos(nome)), aluno_turmas(turma_id)')
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome), polos(nome)')
  const { data: modalidades } = useSupabaseData('modalidades', 'id,nome')
  const { data: polos } = useSupabaseData('polos', 'id,nome')
  const { data: presencas } = useSupabaseData('presencas', 'id,data,presente,turma_id,aluno_id')
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')

  // Novo / Editar aluno
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [matriculas, setMatriculas] = useState([{ polo_id: '', turma_id: '' }])
  const [saving, setSaving] = useState(false)

  // Excluir
  const [deletando, setDeletando] = useState(null)

  // Busca por nome
  const [busca, setBusca] = useState('')

  // Filtros
  const [filtroFaixa, setFiltroFaixa] = useState('')
  const [filtroModalidade, setFiltroModalidade] = useState('')
  const [filtroPoloNome, setFiltroPoloNome] = useState('')

  const hoje_str = new Date().toISOString().split('T')[0]

  function calcElegivel(a) {
    const idade = a.data_nasc ? new Date().getFullYear() - new Date(a.data_nasc).getFullYear() : 0
    if (idade < 60 || a.status !== 'Ativo') return null
    const temAtestadoValido = atestados.some(at => at.aluno_id === a.id && at.data_validade >= hoje_str)
    const pAluno = presencas.filter(p => p.aluno_id === a.id)
    const freq = pAluno.length > 0 ? Math.round(pAluno.filter(p => p.presente).length / pAluno.length * 100) : 0
    return temAtestadoValido && freq >= 70
  }

  // Import CSV
  const fileInputRef = useRef(null)
  const [csvPreview, setCsvPreview] = useState(null)   // array of row objects
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)

  // ─── filtro por papel + drill-down ───────────────────────────
  const alunosFiltrados = (() => {
    let list = (isAdmin || isCoordenador)
      ? alunos
      : alunos.filter(a => {
          const turma = turmas.find(t => t.id === a.turma_id)
          return turma?.professor_id === profile?.id
        })
    if (turmaIdFilter) list = list.filter(a => a.turma_id === turmaIdFilter)
    if (filtroFaixa) list = list.filter(a => calcFaixa(a.data_nasc) === filtroFaixa)
    if (filtroModalidade) list = list.filter(a => a.turmas?.modalidades?.nome === filtroModalidade)
    if (filtroPoloNome) list = list.filter(a => a.turmas?.polos?.nome === filtroPoloNome)
    return list
  })()

  const alunosVisiveis = alunosFiltrados.filter(a => !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()))

  // Enriquecer com frequência e ordenar por freq quando dentro de uma turma
  const alunosParaExibir = useMemo(() => {
    const comFreq = alunosVisiveis.map(a => {
      const pAluno = presencas.filter(p => p.aluno_id === a.id)
      const freq = pAluno.length > 0 ? Math.round(pAluno.filter(p => p.presente).length / pAluno.length * 100) : null
      return { ...a, freq }
    })
    if (!turmaIdFilter) return comFreq
    return [...comFreq].sort((a, b) => {
      if (a.freq === null && b.freq === null) return 0
      if (a.freq === null) return 1
      if (b.freq === null) return -1
      return b.freq - a.freq
    })
  }, [alunosVisiveis, presencas, turmaIdFilter])

  const turmaAtual = turmaIdFilter ? turmas.find(t => t.id === turmaIdFilter) : null
  const turmaLabel2 = turmaAtual
    ? [turmaAtual.modalidades?.nome, turmaAtual.polos?.nome].filter(Boolean).join(' · ')
    : null

  // ─── handlers Novo / Editar ───────────────────────────────────
  function openNew() {
    setForm(EMPTY_FORM)
    setMatriculas([{ polo_id: '', turma_id: '' }])
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(a) {
    setForm({
      nome: a.nome ?? '',
      data_nasc: a.data_nasc ?? '',
      cpf: a.cpf ?? '',
      telefone: a.telefone ?? '',
      telefone_emergencia: a.telefone_emergencia ?? '',
      email: a.email ?? '',
      endereco: a.endereco ?? '',
      foto_url: a.foto_url ?? '',
      status: a.status ?? 'Ativo',
    })
    // Load matriculas from aluno_turmas or fallback to turma_id
    const ats = a.aluno_turmas ?? []
    if (ats.length > 0) {
      setMatriculas(ats.map(at => {
        const t = turmas.find(x => x.id === at.turma_id)
        return { polo_id: t?.polo_id ?? '', turma_id: at.turma_id }
      }))
    } else if (a.turma_id) {
      const t = turmas.find(x => x.id === a.turma_id)
      setMatriculas([{ polo_id: t?.polo_id ?? '', turma_id: a.turma_id }])
    } else {
      setMatriculas([{ polo_id: '', turma_id: '' }])
    }
    setEditing(a)
    setModalOpen(true)
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    const primeiraTurmaId = matriculas.find(m => m.turma_id)?.turma_id || null
    const payload = {
      nome: form.nome.trim(),
      data_nasc: form.data_nasc || null,
      cpf: form.cpf || null,
      telefone: form.telefone || null,
      telefone_emergencia: form.telefone_emergencia || null,
      email: form.email || null,
      endereco: form.endereco || null,
      turma_id: primeiraTurmaId, // backward compat
      foto_url: form.foto_url || null,
      status: form.status,
    }
    let alunoId = editing?.id
    if (editing) {
      await supabase.from('alunos').update(payload).eq('id', editing.id)
    } else {
      const { data } = await supabase.from('alunos').insert(payload).select('id').single()
      alunoId = data?.id
    }
    // Save aluno_turmas (junction)
    if (alunoId) {
      await supabase.from('aluno_turmas').delete().eq('aluno_id', alunoId)
      const rows = matriculas.filter(m => m.turma_id).map(m => ({ aluno_id: alunoId, turma_id: m.turma_id }))
      if (rows.length) await supabase.from('aluno_turmas').insert(rows)
    }
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('alunos').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  // ─── handlers CSV ─────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      // skip header row
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',')
        return {
          nome: cols[0]?.trim() ?? '',
          data_nasc: cols[1]?.trim() || null,
          cpf: cols[2]?.trim() || null,
          telefone: cols[3]?.trim() || null,
          turma_id: cols[4]?.trim() || null,
          status: 'Ativo',
        }
      }).filter(r => r.nome)
      setCsvPreview(rows)
      setCsvModalOpen(true)
      setImportDone(false)
    }
    reader.readAsText(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  async function handleConfirmImport() {
    if (!csvPreview?.length) return
    setImporting(true)
    await supabase.from('alunos').insert(csvPreview)
    setImporting(false)
    setImportDone(true)
    reload()
    setTimeout(() => {
      setCsvModalOpen(false)
      setCsvPreview(null)
      setImportDone(false)
    }, 1200)
  }

  // ─── turma label helper ───────────────────────────────────────
  function turmaLabel(turma) {
    if (!turma) return '—'
    const mod = turma.modalidades?.nome ?? ''
    const polo = turma.polos?.nome ?? ''
    return [mod, polo].filter(Boolean).join(' · ') || '—'
  }

  const topbarAction = (
    <div className="flex items-center gap-2">
      {turmaIdFilter && (
        <button
          onClick={() => navigate('/turmas')}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft size={13}/> Turmas
        </button>
      )}
      {canEdit && (
        <>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} />
            <span className="hidden sm:inline">Importar CSV</span>
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus size={13} />
            <span className="hidden sm:inline">Novo Aluno</span>
          </Button>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={turmaLabel2 ? `Alunos — ${turmaLabel2}` : `Alunos · ${alunosVisiveis.length}`}
        action={topbarAction}
      />

      <div className="px-3 md:px-5 pt-3 pb-0 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar aluno por nome..."
            className="w-full pl-8 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        {!turmaIdFilter && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={12} className="text-slate-400 flex-shrink-0" />
            <select
              value={filtroFaixa}
              onChange={e => setFiltroFaixa(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-600"
            >
              <option value="">Todas as faixas</option>
              <option>Infantil</option>
              <option>Adulto</option>
              <option>Melhor Idade</option>
            </select>
            <select
              value={filtroModalidade}
              onChange={e => setFiltroModalidade(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-600"
            >
              <option value="">Todas as modalidades</option>
              {modalidades.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
            <select
              value={filtroPoloNome}
              onChange={e => setFiltroPoloNome(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-600"
            >
              <option value="">Todos os polos</option>
              {polos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
            </select>
            {(filtroFaixa || filtroModalidade || filtroPoloNome) && (
              <button
                onClick={() => { setFiltroFaixa(''); setFiltroModalidade(''); setFiltroPoloNome('') }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : alunosVisiveis.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="Nenhum aluno cadastrado"
            description="Cadastre alunos manualmente ou importe um CSV."
            action={canEdit && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} />
                  Importar CSV
                </Button>
                <Button size="sm" onClick={openNew}>
                  <Plus size={13} />
                  Novo Aluno
                </Button>
              </div>
            )}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {turmaIdFilter && <th className="px-3 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest w-8">#</th>}
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Nome</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Idade</th>
                  {!turmaIdFilter && <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Turma</th>}
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Matrícula</th>
                  {turmaIdFilter && <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Freq.</th>}
                  {canEdit && (
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {alunosParaExibir.map((a, idx) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/alunos/${a.id}`)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {turmaIdFilter && (
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold ${
                          idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-300'
                        }`}>{idx + 1}</span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {a.foto_url ? (
                          <img src={a.foto_url} alt={a.nome} className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[10px] font-bold">{a.nome?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-navy-900 leading-tight">{a.nome}</p>
                          {a.email && <p className="text-[10px] text-slate-400">{a.email}</p>}
                          {(() => {
                            const elegivel = calcElegivel(a)
                            if (elegivel === null) return null
                            return elegivel
                              ? <span className="inline-block text-[9px] font-semibold text-primary-700 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400 px-1.5 py-0.5 rounded-full mt-0.5">✓ Elegível viagem</span>
                              : <span className="inline-block text-[9px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full mt-0.5">⚠ Pendente viagem</span>
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{calcIdade(a.data_nasc)}</td>
                    {!turmaIdFilter && <td className="px-4 py-3 text-xs text-slate-600">{turmaLabel(a.turmas)}</td>}
                    <td className="px-4 py-3">
                      <Badge color={statusColor(a.status)}>{a.status ?? 'Ativo'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{calcTempo(a.data_matricula)}</td>
                    {turmaIdFilter && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${a.freq ?? 0}%`,
                              backgroundColor: a.freq >= 70 ? '#009640' : a.freq >= 50 ? '#f59e0b' : '#ef4444'
                            }} />
                          </div>
                          <span className={`text-[10px] font-bold w-7 ${a.freq >= 70 ? 'text-primary-600' : a.freq >= 50 ? 'text-amber-500' : a.freq > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {a.freq !== null ? `${a.freq}%` : '—'}
                          </span>
                        </div>
                      </td>
                    )}
                    {canEdit && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(a)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          {(isAdmin || isCoordenador) && (
                            <button
                              onClick={() => setDeletando(a)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── Modal Novo / Editar ─────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Aluno' : 'Novo Aluno'}
        size="lg"
      >
        <div className="space-y-3">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={e => setField('nome', e.target.value)}
              placeholder="Nome completo"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Data de Nascimento */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Nascimento</label>
              <input
                type="date"
                value={form.data_nasc}
                onChange={e => setField('data_nasc', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* CPF */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">CPF</label>
              <input
                type="text"
                value={form.cpf}
                onChange={e => setField('cpf', e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={e => setField('telefone', e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Telefone Emergência */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tel. Emergência</label>
              <input
                type="text"
                value={form.telefone_emergencia}
                onChange={e => setField('telefone_emergencia', e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                placeholder="aluno@email.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setField('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option>Ativo</option>
                <option>Inativo</option>
                <option>Transferido</option>
              </select>
            </div>
          </div>

          {/* Matrículas — Polo → Turma */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">Matrículas (Polo → Turma)</label>
              <button
                type="button"
                onClick={() => setMatriculas(ms => [...ms, { polo_id: '', turma_id: '' }])}
                className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
              >
                <Plus size={12}/> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {matriculas.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={m.polo_id}
                    onChange={e => setMatriculas(ms => ms.map((x, j) => j === i ? { polo_id: e.target.value, turma_id: '' } : x))}
                    className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Selecionar polo...</option>
                    {polos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <select
                    value={m.turma_id}
                    onChange={e => setMatriculas(ms => ms.map((x, j) => j === i ? { ...x, turma_id: e.target.value } : x))}
                    disabled={!m.polo_id}
                    className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:bg-slate-50"
                  >
                    <option value="">Selecionar turma...</option>
                    {turmas.filter(t => t.polo_id === m.polo_id).map(t => (
                      <option key={t.id} value={t.id}>
                        {[t.modalidades?.nome, t.faixa, t.dias?.join(','), t.horario?.slice(0, 5)].filter(Boolean).join(' · ')}
                      </option>
                    ))}
                  </select>
                  {matriculas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMatriculas(ms => ms.filter((_, j) => j !== i))}
                      className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Endereço</label>
            <input
              type="text"
              value={form.endereco}
              onChange={e => setField('endereco', e.target.value)}
              placeholder="Rua, número, bairro"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Foto URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">URL da Foto</label>
            <input
              type="text"
              value={form.foto_url}
              onChange={e => setField('foto_url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.nome.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Preview CSV ───────────────────────────────────── */}
      <Modal
        open={csvModalOpen}
        onClose={() => { setCsvModalOpen(false); setCsvPreview(null); setImportDone(false) }}
        title="Importar CSV — Prévia"
        size="xl"
      >
        {importDone ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <CheckCircle2 size={40} className="text-primary-600" />
            <p className="text-sm font-semibold text-slate-700">
              {csvPreview?.length} aluno(s) importado(s) com sucesso!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-slate-400" />
              <p className="text-xs text-slate-500">
                {csvPreview?.length ?? 0} linha(s) encontrada(s). Confirme para inserir no banco.
              </p>
            </div>

            {csvPreview && csvPreview.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 mb-4">
                <table className="w-full text-left min-w-[520px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Nome</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Nasc.</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">CPF</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Telefone</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Turma ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-xs font-medium text-navy-900">{row.nome || <span className="text-red-400 italic">vazio</span>}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.data_nasc ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.cpf ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.telefone ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.turma_id ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setCsvModalOpen(false); setCsvPreview(null) }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={importing || !csvPreview?.length}
              >
                <Upload size={13} />
                {importing ? 'Importando...' : `Importar ${csvPreview?.length ?? 0} aluno(s)`}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Confirm Delete ──────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deletando}
        onClose={() => setDeletando(null)}
        onConfirm={handleDelete}
        title="Excluir Aluno"
        description={`Excluir "${deletando?.nome}" permanentemente? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}

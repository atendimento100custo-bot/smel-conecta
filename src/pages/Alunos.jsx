// src/pages/Alunos.jsx
import { useState, useRef, useMemo } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Pencil, Trash2, Upload, FileText, CheckCircle2, ArrowLeft, ChevronRight, Search, Filter, Circle, Camera, X } from 'lucide-react'
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
  genero: '',
  atestado_validade: '',
  atestado_foto: '',
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
  const { isAdmin, isCoordenador, isProfessor, isEstagiario, profile } = useAuth()
  const { dark } = useTheme()
  const { offline, pending, addToQueue } = useOfflineQueue()
  const canEdit = isAdmin || isCoordenador || isProfessor || isEstagiario
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const turmaIdFilter = searchParams.get('turma_id')

  const { data: alunos, loading, reload } = useSupabaseData('alunos', '*, turmas(*, modalidades(nome), polos(nome)), aluno_turmas(turma_id)')
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome), polos(nome)')
  const { data: modalidades } = useSupabaseData('modalidades', 'id,nome')
  const { data: polos } = useSupabaseData('polos', 'id,nome')
  const { data: presencas } = useSupabaseData('presencas', 'id,data,status,turma_id,aluno_id')
  const { data: atestados } = useSupabaseData('atestados', 'id,data_validade,aluno_id')
  const { data: atribuicoes } = useSupabaseData('atribuicoes', 'id,usuario_id,turma_id,polo_id')

  // Novo / Editar aluno
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [matriculas, setMatriculas] = useState([{ polo_id: '', turma_id: '' }])
  const [saving, setSaving] = useState(false)
  const [uploadingFotoAluno, setUploadingFotoAluno] = useState(false)
  const [uploadingAtestadoFoto, setUploadingAtestadoFoto] = useState(false)
  const [alunoErrors, setAlunoErrors] = useState({})
  const [dupWarningAlunos, setDupWarningAlunos] = useState(null)

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
    const freq = pAluno.length > 0 ? Math.round(pAluno.filter(p => p.status === 'presente' || p.status === 'justificado').length / pAluno.length * 100) : 0
    return temAtestadoValido && freq >= 70
  }

  // Import CSV
  const fileInputRef = useRef(null)
  const [csvPreview, setCsvPreview] = useState(null)   // array of row objects
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)

  // ─── filtro por papel + drill-down ───────────────────────────
  // Turmas acessíveis para professor: via atribuicoes (fonte única) + campo legado professor_id
  const minhasTurmaIds = useMemo(() => {
    if (isAdmin || isCoordenador || isEstagiario || !profile) return null // null = acesso total
    const ids = new Set(
      atribuicoes
        .filter(a => a.usuario_id === profile.id && a.turma_id)
        .map(a => a.turma_id)
    )
    // compatibilidade com campo legado professor_id
    turmas.forEach(t => { if (t.professor_id === profile.id) ids.add(t.id) })
    return ids
  }, [isAdmin, isCoordenador, isEstagiario, profile, atribuicoes, turmas])

  const alunosFiltrados = (() => {
    let list = minhasTurmaIds === null
      ? alunos
      : alunos.filter(a => minhasTurmaIds.has(a.turma_id))
    if (turmaIdFilter) list = list.filter(a => a.turma_id === turmaIdFilter)
    if (filtroFaixa) list = list.filter(a => calcFaixa(a.data_nasc) === filtroFaixa)
    if (filtroModalidade) list = list.filter(a => a.turmas?.modalidades?.nome === filtroModalidade)
    if (filtroPoloNome) list = list.filter(a => a.turmas?.polos?.nome === filtroPoloNome)
    return list
  })()

  function norm(str) {
    return (str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }
  const alunosVisiveis = alunosFiltrados.filter(a => {
    if (!busca.trim()) return true
    const nomeNorm = norm(a.nome)
    const palavras = norm(busca).split(/\s+/).filter(Boolean)
    return palavras.every(p => nomeNorm.includes(p))
  })

  // Enriquecer com frequência e ordenar por freq quando dentro de uma turma
  const alunosParaExibir = useMemo(() => {
    const comFreq = alunosVisiveis.map(a => {
      const pAluno = presencas.filter(p => p.aluno_id === a.id)
      const freq = pAluno.length > 0 ? Math.round(pAluno.filter(p => p.status === 'presente' || p.status === 'justificado').length / pAluno.length * 100) : null
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
      genero: a.genero ?? '',
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

  async function uploadFotoAluno(file) {
    if (!file) return
    setUploadingFotoAluno(true)
    const ext = file.name.split('.').pop()
    const fn = `alunos/foto/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('registros-aula').upload(fn, file)
    if (!error) {
      const { data } = supabase.storage.from('registros-aula').getPublicUrl(fn)
      setField('foto_url', data.publicUrl)
    }
    setUploadingFotoAluno(false)
  }

  async function uploadFotoAtestado(file) {
    if (!file) return
    setUploadingAtestadoFoto(true)
    const ext = file.name.split('.').pop()
    const fn = `atestados/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('atestados').upload(fn, file)
    if (!error) {
      const { data } = supabase.storage.from('atestados').getPublicUrl(fn)
      setField('atestado_foto', data.publicUrl)
    }
    setUploadingAtestadoFoto(false)
  }

  function normNomeAluno(s) {
    return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  }

  function validateAlunoFormAlunos(f) {
    const e = {}
    const nome = (f.nome ?? '').trim()
    if (!nome) {
      e.nome = 'Nome é obrigatório'
    } else if (nome.includes('@')) {
      e.nome = 'Parece que há um e-mail no campo Nome — verifique'
    }
    if (f.email?.trim() && !/\S+@\S+\.\S+/.test(f.email.trim())) {
      e.email = 'E-mail inválido — pode ser um nome inserido por engano'
    }
    if (f.data_nasc) {
      const nasc = new Date(f.data_nasc + 'T12:00:00')
      const hoje = new Date()
      if (nasc > hoje) {
        e.data_nasc = 'Data de nascimento não pode ser no futuro'
      } else if (hoje.getFullYear() - nasc.getFullYear() > 120) {
        e.data_nasc = `Verifique o ano ${nasc.getFullYear()} — parece um erro de digitação`
      }
    }
    return e
  }

  async function handleSave(forcarSalvar = false) {
    const errs = validateAlunoFormAlunos(form)
    if (Object.keys(errs).length > 0) {
      setAlunoErrors(errs)
      return
    }
    // Duplicate detection (only for new students)
    if (!editing && !forcarSalvar) {
      const nomeNorm = normNomeAluno(form.nome)
      const dup = alunos.find(a => normNomeAluno(a.nome) === nomeNorm)
      if (dup) {
        setDupWarningAlunos({ aluno: dup })
        return
      }
    }
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
      genero: form.genero || null,
    }
    const temTurmaMelhorIdade = matriculas.some(m => turmas.find(t => t.id === m.turma_id)?.faixa === 'Melhor Idade')
    try {
      let alunoId = editing?.id
      if (editing) {
        await supabase.from('alunos').update(payload).eq('id', editing.id)
      } else {
        const { data } = await supabase.from('alunos').insert(payload).select('id').single()
        alunoId = data?.id
        // Save atestado for new Melhor Idade student
        if (alunoId && temTurmaMelhorIdade && form.atestado_validade) {
          await supabase.from('atestados').insert({
            aluno_id: alunoId,
            data_validade: form.atestado_validade,
            arquivo_url: form.atestado_foto || null,
          })
        }
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
    } catch (erro) {
      if (offline || !navigator.onLine) {
        addToQueue({ type: 'aluno', data: payload, isEditing: !!editing, matriculas: matriculas.filter(m => m.turma_id) })
        setSaving(false)
        setModalOpen(false)
      } else {
        console.error('Erro ao salvar aluno:', erro)
        setSaving(false)
      }
    }
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
      {(isAdmin || isCoordenador) && (
        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload size={13} />
          <span className="hidden sm:inline">Importar CSV</span>
        </Button>
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

      {offline && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/50 px-3 md:px-5 py-2 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <Circle size={8} className="fill-current" />
          Offline · {pending} registros pendentes
        </div>
      )}

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
            action={(isAdmin || isCoordenador) && (
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} />
                Importar CSV
              </Button>
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
                          {(isAdmin || isCoordenador || isProfessor) && (
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
        onClose={() => { setModalOpen(false); setAlunoErrors({}); setDupWarningAlunos(null) }}
        title="Editar Aluno"
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
              autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')}
              value={form.nome}
              onChange={e => { setField('nome', e.target.value); setAlunoErrors(er => ({ ...er, nome: undefined })) }}
              placeholder="Nome completo"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${alunoErrors.nome ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'}`}
            />
            {alunoErrors.nome && <p className="mt-1 text-xs text-red-500">{alunoErrors.nome}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Data de Nascimento */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Nascimento</label>
              <input
                type="date"
                autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')}
                value={form.data_nasc}
                onChange={e => { setField('data_nasc', e.target.value); setAlunoErrors(er => ({ ...er, data_nasc: undefined })) }}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${alunoErrors.data_nasc ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'}`}
              />
              {alunoErrors.data_nasc && <p className="mt-1 text-xs text-red-500">{alunoErrors.data_nasc}</p>}
            </div>

            {/* CPF */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">CPF</label>
              <input
                type="text"
                autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')}
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
                autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')}
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
                autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')}
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
                type="text"
                autoComplete="new-password" readOnly onFocus={e => e.currentTarget.removeAttribute('readonly')}
                value={form.email}
                onChange={e => { setField('email', e.target.value); setAlunoErrors(er => ({ ...er, email: undefined })) }}
                placeholder="aluno@email.com"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${alunoErrors.email ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'}`}
              />
              {alunoErrors.email && <p className="mt-1 text-xs text-red-500">{alunoErrors.email}</p>}
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
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Gênero</label>
              <select value={form.genero} onChange={e => setField('genero', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Não informado</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
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

          {/* Foto do Aluno */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Foto do Aluno</label>
            <div className="flex items-center gap-4">
              {form.foto_url ? (
                <div className="relative flex-shrink-0">
                  <img src={form.foto_url} alt="foto" className="w-16 h-16 rounded-full object-cover border-2 border-primary-200" />
                  <button type="button" onClick={() => setField('foto_url', '')}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                    <X size={10}/>
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-200 flex-shrink-0">
                  <Camera size={20} className="text-slate-300" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 cursor-pointer hover:text-primary-700 ${uploadingFotoAluno ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Camera size={12}/> Tirar Foto
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => uploadFotoAluno(e.target.files?.[0])} />
                </label>
                <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-700 ${uploadingFotoAluno ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={12}/> Escolher da Galeria
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => uploadFotoAluno(e.target.files?.[0])} />
                </label>
                {uploadingFotoAluno && <p className="text-[10px] text-slate-400 animate-pulse">Enviando...</p>}
              </div>
            </div>
          </div>

          {/* Atestado médico — somente para turmas Melhor Idade */}
          {matriculas.some(m => turmas.find(t => t.id === m.turma_id)?.faixa === 'Melhor Idade') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">🏥 Atestado Médico — Melhor Idade</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Validade do Atestado</label>
                <input type="date" value={form.atestado_validade}
                  onChange={e => setField('atestado_validade', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Foto do Atestado</label>
                {form.atestado_foto ? (
                  <div className="flex items-center gap-2">
                    <a href={form.atestado_foto} target="_blank" rel="noreferrer" className="text-[11px] text-primary-600 hover:underline">✓ Ver atestado enviado</a>
                    <button type="button" onClick={() => setField('atestado_foto', '')} className="text-[10px] text-red-400 hover:text-red-600">Remover</button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 cursor-pointer hover:text-primary-700 ${uploadingAtestadoFoto ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Camera size={12}/> Fotografar
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => uploadFotoAtestado(e.target.files?.[0])} />
                    </label>
                    <label className={`flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-700 ${uploadingAtestadoFoto ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload size={12}/> Galeria / PDF
                      <input type="file" accept="image/*,.pdf" className="hidden"
                        onChange={e => uploadFotoAtestado(e.target.files?.[0])} />
                    </label>
                    {uploadingAtestadoFoto && <p className="text-[10px] text-slate-400 animate-pulse">Enviando...</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setModalOpen(false); setAlunoErrors({}); setDupWarningAlunos(null) }}>Cancelar</Button>
            <Button size="sm" onClick={() => handleSave()} disabled={saving}>
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

      <ConfirmDialog
        open={!!dupWarningAlunos}
        title="Aluno possivelmente duplicado"
        description={`Já existe um aluno chamado "${dupWarningAlunos?.aluno?.nome}" no sistema. Deseja cadastrar mesmo assim?`}
        onConfirm={() => { setDupWarningAlunos(null); handleSave(true) }}
        onClose={() => setDupWarningAlunos(null)}
      />
    </div>
  )
}

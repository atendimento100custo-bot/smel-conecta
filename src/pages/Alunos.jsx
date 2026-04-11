// src/pages/Alunos.jsx
import { useState, useRef } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Pencil, Trash2, Upload, FileText, CheckCircle2 } from 'lucide-react'

const EMPTY_FORM = {
  nome: '',
  data_nasc: '',
  cpf: '',
  telefone: '',
  email: '',
  endereco: '',
  turma_id: '',
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

export default function Alunos() {
  const { isAdmin, isCoordenador, isProfessor, profile } = useAuth()
  const canEdit = isAdmin || isCoordenador || isProfessor

  const { data: alunos, loading, reload } = useSupabaseData('alunos', '*, turmas(*, modalidades(nome), polos(nome))')
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome), polos(nome)')

  // Novo / Editar aluno
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Excluir
  const [deletando, setDeletando] = useState(null)

  // Import CSV
  const fileInputRef = useRef(null)
  const [csvPreview, setCsvPreview] = useState(null)   // array of row objects
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)

  // ─── filtro por papel ─────────────────────────────────────────
  const alunosFiltrados = (isAdmin || isCoordenador)
    ? alunos
    : alunos.filter(a => {
        const turma = turmas.find(t => t.id === a.turma_id)
        return turma?.professor_id === profile?.id
      })

  // ─── handlers Novo / Editar ───────────────────────────────────
  function openNew() {
    setForm(EMPTY_FORM)
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(a) {
    setForm({
      nome: a.nome ?? '',
      data_nasc: a.data_nasc ?? '',
      cpf: a.cpf ?? '',
      telefone: a.telefone ?? '',
      email: a.email ?? '',
      endereco: a.endereco ?? '',
      turma_id: a.turma_id ?? '',
      foto_url: a.foto_url ?? '',
      status: a.status ?? 'Ativo',
    })
    setEditing(a)
    setModalOpen(true)
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      data_nasc: form.data_nasc || null,
      cpf: form.cpf || null,
      telefone: form.telefone || null,
      email: form.email || null,
      endereco: form.endereco || null,
      turma_id: form.turma_id || null,
      foto_url: form.foto_url || null,
      status: form.status,
    }
    if (editing) {
      await supabase.from('alunos').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('alunos').insert(payload)
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

  const topbarAction = canEdit && (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
        <Upload size={13} />
        Importar CSV
      </Button>
      <Button size="sm" onClick={openNew}>
        <Plus size={13} />
        Novo Aluno
      </Button>
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
        title={`Alunos · ${alunosFiltrados.length}`}
        action={topbarAction}
      />

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : alunosFiltrados.length === 0 ? (
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
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Nome</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Idade</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Turma</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest">Matrícula</th>
                  {canEdit && (
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-widest text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {alunosFiltrados.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
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
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{calcIdade(a.data_nasc)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{turmaLabel(a.turmas)}</td>
                    <td className="px-4 py-3">
                      <Badge color={statusColor(a.status)}>{a.status ?? 'Ativo'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{calcTempo(a.data_matricula)}</td>
                    {canEdit && (
                      <td className="px-4 py-3">
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

            {/* Turma */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Turma</label>
              <select
                value={form.turma_id}
                onChange={e => setField('turma_id', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sem turma</option>
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>
                    {[t.modalidades?.nome, t.polos?.nome].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
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

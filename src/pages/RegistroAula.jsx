// src/pages/RegistroAula.jsx
import { useState } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'

const EMPTY_FORM = {
  turma_id: '',
  data: new Date().toISOString().slice(0, 10),
  conteudo: '',
  ocorrencias: '',
  alunos_presentes: 0,
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function truncate(str, max = 60) {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '...' : str
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function RegistroAula() {
  const { isAdmin, isCoordenador, isProfessor, profile } = useAuth()
  const canEdit = isAdmin || isCoordenador || isProfessor

  const { data: registros, loading, reload } = useSupabaseData(
    'registros_aula',
    '*, turmas(*, modalidades(nome), polos(nome)), profiles(nome)',
  )
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome), polos(nome)')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  const [filtroTurma, setFiltroTurma] = useState('')
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1)
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear())

  // Professor only sees their own class registros
  const registrosVisiveis = isAdmin || isCoordenador
    ? registros
    : registros.filter(r => r.turmas?.professor_id === profile?.id)

  const visiveis = registrosVisiveis.filter(r => {
    const d = new Date(r.data)
    return (
      (!filtroTurma || r.turma_id === filtroTurma) &&
      d.getMonth() + 1 === Number(filtroMes) &&
      d.getFullYear() === Number(filtroAno)
    )
  })

  // Turmas available to current user for filter/select
  const turmasDisponiveis = isAdmin || isCoordenador
    ? turmas
    : turmas.filter(t => t.professor_id === profile?.id)

  function openNew() {
    setForm(EMPTY_FORM)
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(r) {
    setForm({
      turma_id: r.turma_id ?? '',
      data: r.data ? r.data.slice(0, 10) : new Date().toISOString().slice(0, 10),
      conteudo: r.conteudo ?? '',
      ocorrencias: r.ocorrencias ?? '',
      alunos_presentes: r.alunos_presentes ?? 0,
    })
    setEditing(r)
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = { ...form, professor_id: profile.id }
    if (editing) {
      await supabase.from('registros_aula').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('registros_aula').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('registros_aula').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  // Generate year options: 3 years back to 1 year ahead
  const currentYear = new Date().getFullYear()
  const anos = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Registro de Aula · ${visiveis.length}`}
        action={
          canEdit && (
            <Button size="sm" onClick={openNew}>
              <Plus size={13} /> Novo Registro
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={filtroTurma}
            onChange={e => setFiltroTurma(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">Todas as turmas</option>
            {turmasDisponiveis.map(t => (
              <option key={t.id} value={t.id}>
                {t.modalidades?.nome ?? '—'} · {t.polos?.nome ?? 'Sem polo'}
              </option>
            ))}
          </select>

          <select
            value={filtroMes}
            onChange={e => setFiltroMes(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>

          <select
            value={filtroAno}
            onChange={e => setFiltroAno(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : visiveis.length === 0 ? (
          <EmptyState
            icon="📖"
            title="Nenhum registro encontrado"
            description="Tente ajustar os filtros ou crie um novo registro de aula."
            action={
              canEdit && (
                <Button size="sm" onClick={openNew}>
                  <Plus size={13} /> Novo Registro
                </Button>
              )
            }
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Data</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Turma</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Professor</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Alunos Presentes</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Conteúdo</th>
                  {canEdit && (
                    <th className="text-right px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiveis.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                      {formatDate(r.data)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-semibold text-navy-900">{r.turmas?.modalidades?.nome ?? '—'}</div>
                      <div className="text-[10px] text-slate-400">{r.turmas?.polos?.nome ?? 'Sem polo'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.profiles?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold text-center">
                      {r.alunos_presentes ?? 0}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs">
                      {truncate(r.conteudo, 60)}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          {(isAdmin || isCoordenador) && (
                            <button
                              onClick={() => setDeletando(r)}
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

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Registro de Aula' : 'Novo Registro de Aula'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Turma</label>
              <select
                value={form.turma_id}
                onChange={e => setForm(f => ({ ...f, turma_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecionar turma</option>
                {turmasDisponiveis.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.modalidades?.nome ?? '—'} · {t.polos?.nome ?? 'Sem polo'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data</label>
              <input
                type="date"
                value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Professor
            </label>
            <input
              type="text"
              value={profile?.nome ?? ''}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Alunos Presentes</label>
            <input
              type="number"
              min="0"
              value={form.alunos_presentes}
              onChange={e => setForm(f => ({ ...f, alunos_presentes: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Conteúdo</label>
            <textarea
              value={form.conteudo}
              onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
              rows={4}
              placeholder="Descreva o conteúdo ministrado na aula..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ocorrências</label>
            <textarea
              value={form.ocorrencias}
              onChange={e => setForm(f => ({ ...f, ocorrencias: e.target.value }))}
              rows={3}
              placeholder="Registre ocorrências relevantes (opcional)..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <BookOpen size={13} />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletando}
        onClose={() => setDeletando(null)}
        onConfirm={handleDelete}
        title="Excluir Registro"
        description={`Excluir o registro de "${formatDate(deletando?.data)}"?`}
      />
    </div>
  )
}

// src/pages/Atestados.jsx
import { useState } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Paperclip, Pencil, Trash2 } from 'lucide-react'

const EMPTY_FORM = { aluno_id: '', data_emissao: '', data_validade: '', observacao: '', arquivo_url: '' }

function getStatus(dataValidade) {
  const hoje = new Date()
  const val = new Date(dataValidade)
  const em30 = new Date(); em30.setDate(hoje.getDate() + 30)
  if (val < hoje) return { label: 'Vencido', color: 'red' }
  if (val <= em30) return { label: 'Vencendo', color: 'amber' }
  return { label: 'Válido', color: 'green' }
}

async function uploadArquivo(file) {
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('atestados').upload(filename, file)
  if (error) throw error
  const { data } = supabase.storage.from('atestados').getPublicUrl(filename)
  return data.publicUrl
}

const FILTROS = ['Todos', 'Válidos', 'Vencendo', 'Vencidos']

export default function Atestados() {
  const { isAdmin, isCoordenador } = useAuth()
  const canEdit = isAdmin || isCoordenador

  const { data: atestados, loading, reload } = useSupabaseData('atestados', '*, alunos(nome, turmas(modalidades(nome)))')
  const { data: alunos } = useSupabaseData('alunos', 'id, nome, turma_id')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [arquivo, setArquivo] = useState(null)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('Todos')

  function openNew() { setForm(EMPTY_FORM); setArquivo(null); setEditing(null); setModalOpen(true) }
  function openEdit(a) {
    setForm({
      aluno_id: a.aluno_id ?? '',
      data_emissao: a.data_emissao ?? '',
      data_validade: a.data_validade ?? '',
      observacao: a.observacao ?? '',
      arquivo_url: a.arquivo_url ?? '',
    })
    setArquivo(null)
    setEditing(a)
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      let arquivoUrl = form.arquivo_url
      if (arquivo) arquivoUrl = await uploadArquivo(arquivo)
      if (editing) {
        await supabase.from('atestados').update({ ...form, arquivo_url: arquivoUrl }).eq('id', editing.id)
      } else {
        await supabase.from('atestados').insert({ ...form, arquivo_url: arquivoUrl })
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      console.error('Erro ao salvar atestado:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await supabase.from('atestados').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  const atestadosFiltrados = atestados.filter(a => {
    if (filtro === 'Todos') return true
    if (!a.data_validade) return false
    const { label } = getStatus(a.data_validade)
    if (filtro === 'Válidos') return label === 'Válido'
    if (filtro === 'Vencendo') return label === 'Vencendo'
    if (filtro === 'Vencidos') return label === 'Vencido'
    return true
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Atestados · ${atestadosFiltrados.length}`}
        action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13} /> Novo Atestado</Button>}
      />
      <div className="flex-1 overflow-y-auto p-5">
        {/* Filter chips */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                filtro === f
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : atestadosFiltrados.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Nenhum atestado encontrado"
            action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13} /> Novo Atestado</Button>}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Aluno</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Emissão</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Validade</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Arquivo</th>
                  {canEdit && <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {atestadosFiltrados.map((a, idx) => {
                  const status = a.data_validade ? getStatus(a.data_validade) : null
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        idx === atestadosFiltrados.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy-900 text-xs">{a.alunos?.nome ?? '—'}</p>
                        {a.alunos?.turmas?.modalidades?.nome && (
                          <p className="text-[10px] text-slate-400">{a.alunos.turmas.modalidades.nome}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {a.data_emissao ? new Date(a.data_emissao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {a.data_validade ? new Date(a.data_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {status ? (
                          <Badge color={status.color}>{status.label}</Badge>
                        ) : (
                          <Badge color="gray">—</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {a.arquivo_url ? (
                          <a
                            href={a.arquivo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <Paperclip size={12} />
                            Ver arquivo
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(a)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeletando(a)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Atestado' : 'Novo Atestado'}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Aluno</label>
            <select
              value={form.aluno_id}
              onChange={e => setForm(f => ({ ...f, aluno_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Selecionar aluno</option>
              {alunos.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Emissão</label>
              <input
                type="date"
                value={form.data_emissao}
                onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Validade</label>
              <input
                type="date"
                value={form.data_validade}
                onChange={e => setForm(f => ({ ...f, data_validade: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Observação</label>
            <textarea
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              rows={3}
              placeholder="Observações sobre o atestado..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Arquivo</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-primary-400 hover:text-primary-600 cursor-pointer transition-colors">
                <Paperclip size={13} />
                {arquivo ? arquivo.name : (form.arquivo_url ? 'Substituir arquivo' : 'Selecionar arquivo')}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => setArquivo(e.target.files[0] ?? null)}
                />
              </label>
              {form.arquivo_url && !arquivo && (
                <a
                  href={form.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Ver atual
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletando}
        onClose={() => setDeletando(null)}
        onConfirm={handleDelete}
        title="Excluir Atestado"
        description={`Excluir atestado de "${deletando?.alunos?.nome}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}

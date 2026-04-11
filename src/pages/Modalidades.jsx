// src/pages/Modalidades.jsx
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
import { Plus, Pencil, Trash2 } from 'lucide-react'

const FAIXAS = ['Infantil', 'Adulto', 'Melhor Idade']
const EMPTY_FORM = { nome: '', categoria: '', emoji: '🏃', faixas: [], status: 'Ativo' }

export default function Modalidades() {
  const { isAdmin, isCoordenador } = useAuth()
  const canEdit = isAdmin || isCoordenador
  const { data: modalidades, loading, reload } = useSupabaseData('modalidades')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  function openNew() { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }
  function openEdit(m) {
    setForm({ nome: m.nome, categoria: m.categoria ?? '', emoji: m.emoji ?? '🏃', faixas: m.faixas ?? [], status: m.status })
    setEditing(m)
    setModalOpen(true)
  }

  function toggleFaixa(f) {
    setForm(prev => ({
      ...prev,
      faixas: prev.faixas.includes(f) ? prev.faixas.filter(x => x !== f) : [...prev.faixas, f]
    }))
  }

  async function handleSave() {
    setSaving(true)
    const payload = { ...form }
    if (editing) {
      await supabase.from('modalidades').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('modalidades').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('modalidades').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Modalidades · ${modalidades.length}`}
        action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13}/> Nova Modalidade</Button>}
      />
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : modalidades.length === 0 ? (
          <EmptyState icon="🎯" title="Nenhuma modalidade cadastrada"
            action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13}/> Nova Modalidade</Button>} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {modalidades.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{m.emoji}</span>
                    <div>
                      <p className="text-xs font-bold text-navy-900">{m.nome}</p>
                      <p className="text-[10px] text-slate-400">{m.categoria}</p>
                    </div>
                  </div>
                  <Badge color={m.status === 'Ativo' ? 'green' : 'gray'}>{m.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(m.faixas ?? []).map(f => (
                    <span key={f} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{f}</span>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => setDeletando(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Modalidade' : 'Nova Modalidade'}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji</label>
              <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria</label>
            <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Faixas etárias</label>
            <div className="flex gap-2">
              {FAIXAS.map(f => (
                <button key={f} type="button" onClick={() => toggleFaixa(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    form.faixas.includes(f) ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{f}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>Ativo</option><option>Inativo</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletando} onClose={() => setDeletando(null)} onConfirm={handleDelete}
        title="Excluir Modalidade" description={`Excluir "${deletando?.nome}"?`} />
    </div>
  )
}

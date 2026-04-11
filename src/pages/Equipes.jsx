// src/pages/Equipes.jsx
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
import { Plus, Pencil, Trash2, Phone } from 'lucide-react'

const CARGOS = ['professor', 'coordenador', 'estagiario', 'admin']
const CARGO_LABELS = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }
const CARGO_COLORS = { professor: 'amber', coordenador: 'blue', estagiario: 'purple', admin: 'green' }
const EMPTY_FORM = { nome: '', cargo: 'professor', telefone: '' }

export default function Equipes() {
  const { isAdmin, isCoordenador } = useAuth()
  const canEdit = isAdmin || isCoordenador
  const { data: membros, loading, reload } = useSupabaseData('profiles', 'id,nome,cargo,telefone,ativo')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  function openEdit(m) {
    setForm({ nome: m.nome, cargo: m.cargo, telefone: m.telefone ?? '' })
    setEditing(m)
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({ nome: form.nome, cargo: form.cargo, telefone: form.telefone }).eq('id', editing.id)
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleToggleAtivo() {
    await supabase.from('profiles').update({ ativo: !deletando.ativo }).eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  const ativos = membros.filter(m => m.ativo !== false)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title={`Equipe · ${ativos.length} membros`} />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-medium mb-4">
          💡 Novos membros são criados via Supabase Auth (convite por email) e aparecem aqui automaticamente.
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : ativos.length === 0 ? (
          <EmptyState icon="👥" title="Nenhum membro na equipe" description="Convide usuários via Supabase Dashboard" />
        ) : (
          <div className="space-y-2">
            {ativos.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {m.nome.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-bold text-navy-900">{m.nome}</p>
                    <Badge color={CARGO_COLORS[m.cargo] ?? 'gray'}>{CARGO_LABELS[m.cargo] ?? m.cargo}</Badge>
                  </div>
                  <div className="flex gap-3">
                    {m.telefone && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Phone size={9}/>{m.telefone}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    {isAdmin && (
                      <button onClick={() => setDeletando(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Editar Membro">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nome</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo</label>
            <select value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {CARGOS.map(c => <option key={c} value={c}>{CARGO_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone</label>
            <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="(24) 99999-0000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletando} onClose={() => setDeletando(null)} onConfirm={handleToggleAtivo}
        title="Desativar Membro"
        description={`Desativar "${deletando?.nome}"? O usuário perderá acesso ao sistema.`} />
    </div>
  )
}

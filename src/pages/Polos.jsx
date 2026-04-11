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
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react'

const TIPOS = ['Ginásio','Arena','Estádio','Complexo','Academia','Parque Aquático','Kartódromo','Museu','Centro','Mini Estádio']
const EMPTY_FORM = { nome:'', tipo:'Ginásio', bairro:'', endereco:'', status:'Ativo' }

export default function Polos() {
  const { isAdmin } = useAuth()
  const { data: polos, loading, reload } = useSupabaseData('polos')
  const [filtro, setFiltro] = useState('Todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  const tipos = ['Todos', ...new Set(polos.map(p => p.tipo))]
  const visiveis = filtro === 'Todos' ? polos : polos.filter(p => p.tipo === filtro)

  function openNew() { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }
  function openEdit(polo) {
    setForm({ nome: polo.nome, tipo: polo.tipo, bairro: polo.bairro ?? '', endereco: polo.endereco ?? '', status: polo.status })
    setEditing(polo)
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    if (editing) {
      await supabase.from('polos').update(form).eq('id', editing.id)
    } else {
      await supabase.from('polos').insert(form)
    }
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('polos').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Polos · ${polos.length}`}
        action={isAdmin && <Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>}
      />
      <div className="flex-1 overflow-y-auto p-5">
        {/* Filtros por tipo */}
        <div className="flex gap-2 flex-wrap mb-4">
          {tipos.map(t => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filtro === t
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : visiveis.length === 0 ? (
          <EmptyState
            icon="🏟️"
            title="Nenhum polo encontrado"
            action={isAdmin && <Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visiveis.map(polo => (
              <div key={polo.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <MapPin size={16} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-navy-900 leading-tight">{polo.nome}</p>
                    <Badge color={polo.status === 'Ativo' ? 'green' : 'gray'}>{polo.status}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{polo.tipo} · {polo.bairro}</p>
                  {polo.endereco && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{polo.endereco}</p>}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(polo)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => setDeletando(polo)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal novo/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Polo' : 'Novo Polo'}>
        <div className="space-y-3">
          {[['Nome *', 'nome'], ['Bairro', 'bairro'], ['Endereço', 'endereco']].map(([label, field]) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.nome.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletando}
        onClose={() => setDeletando(null)}
        onConfirm={handleDelete}
        title="Excluir Polo"
        description={`Tem certeza que deseja excluir "${deletando?.nome}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}

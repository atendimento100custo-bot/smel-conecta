import { useState, useEffect } from 'react'
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
import { useNavigate } from 'react-router-dom'

const TIPOS = ['Ginásio','Arena','Estádio','Complexo','Academia','Parque Aquático','Quadras','Museu','Centro','Mini Estádio']
const EMPTY_FORM = { nome:'', tipo:'Ginásio', bairro:'', endereco:'', status:'Ativo' }

export default function Polos() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const { data: polos, loading, reload } = useSupabaseData('polos')
  const [filtro, setFiltro] = useState('Todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  // NOVO: polo_ids do usuário logado
  const [myPoloIds, setMyPoloIds] = useState(null) // null = carregando

  useEffect(() => {
    if (!profile) return
    if (isAdmin) { setMyPoloIds(null); return } // admin não precisa de split
    supabase
      .from('atribuicoes')
      .select('polo_id')
      .eq('usuario_id', profile.id)
      .not('polo_id', 'is', null)
      .then(({ data }) => {
        const ids = [...new Set((data ?? []).map(a => a.polo_id))]
        setMyPoloIds(ids)
      })
  }, [profile, isAdmin])

  const [outrosExpanded, setOutrosExpanded] = useState(true)

  const meusPolos = isAdmin || myPoloIds === null
    ? []
    : polos.filter(p => myPoloIds.includes(p.id))

  const outrosPolos = isAdmin || myPoloIds === null
    ? polos
    : polos.filter(p => !myPoloIds.includes(p.id))

  // Para o filtro de tipo
  const todosVisiveis = isAdmin ? polos : [...meusPolos, ...outrosPolos]
  const tipos = ['Todos', ...new Set(todosVisiveis.map(p => p.tipo).filter(Boolean))]

  // Aplica filtro de tipo em cada grupo
  const meusVisiveis   = filtro === 'Todos' ? meusPolos  : meusPolos.filter(p => p.tipo === filtro)
  const outrosVisiveis = filtro === 'Todos' ? outrosPolos : outrosPolos.filter(p => p.tipo === filtro)

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

  function PoloCard({ polo }) {
    return (
      <div
        className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-start gap-3 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all group"
        onClick={() => navigate(`/polos/${polo.id}`)}
      >
        <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
          <MapPin size={16} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-navy-900 dark:text-white leading-tight group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{polo.nome}</p>
            <Badge color={polo.status === 'Ativo' ? 'green' : 'gray'}>{polo.status}</Badge>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{polo.tipo} · {polo.bairro}</p>
          {polo.endereco && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{polo.endereco}</p>}
          <p className="text-[10px] text-primary-600 dark:text-primary-400 mt-1.5 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Ver detalhes →
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => openEdit(polo)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400 hover:text-slate-600 transition-colors">
              <Pencil size={13}/>
            </button>
            <button onClick={() => setDeletando(polo)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={13}/>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Polos · ${todosVisiveis.length}`}
        action={isAdmin && <Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>}
      />
      <div className="flex-1 overflow-y-auto p-3 md:p-5">
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
        ) : isAdmin ? (
          /* Admin: grade única sem split */
          outrosVisiveis.length === 0 ? (
            <EmptyState icon="🏟️" title="Nenhum polo encontrado"
              action={<Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outrosVisiveis.map(polo => <PoloCard key={polo.id} polo={polo} />)}
            </div>
          )
        ) : (
          /* Não-admin: split Meus Polos / Outros */
          <div className="space-y-6">

            {/* Seção: Meus Polos */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
                  📍 Meus Polos
                </span>
                <span className="text-[10px] text-slate-400">· {meusVisiveis.length}</span>
              </div>
              {myPoloIds === null ? (
                <p className="text-sm text-slate-400">Carregando...</p>
              ) : meusVisiveis.length === 0 ? (
                <div className="bg-slate-50 dark:bg-navy-900/30 rounded-xl border border-dashed border-slate-200 dark:border-navy-700 p-6 text-center">
                  <p className="text-xs text-slate-400">Você ainda não tem polos atribuídos.</p>
                  <p className="text-xs text-slate-400 mt-1">Peça ao coordenador para te vincular a um polo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {meusVisiveis.map(polo => (
                    <div key={polo.id} className="ring-2 ring-primary-300 dark:ring-primary-700 rounded-xl">
                      <PoloCard polo={polo} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção: Outros Polos */}
            {outrosVisiveis.length > 0 && (
              <div>
                <button
                  onClick={() => setOutrosExpanded(e => !e)}
                  className="flex items-center gap-2 mb-3 group w-full text-left"
                >
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 transition-colors">
                    🏟️ Outros Polos da Rede
                  </span>
                  <span className="text-[10px] text-slate-400">· {outrosVisiveis.length}</span>
                  <span className="ml-auto text-slate-400 text-xs">{outrosExpanded ? '▲' : '▼'}</span>
                </button>
                {outrosExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60 hover:opacity-80 transition-opacity">
                    {outrosVisiveis.map(polo => <PoloCard key={polo.id} polo={polo} />)}
                  </div>
                )}
              </div>
            )}

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

import { useState, useEffect, useRef } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { MapPin, Plus, Pencil, Trash2, List, Map as MapIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { VR_CENTER } from '../lib/voltaRedondaCoords'
import { usePoloCoords } from '../hooks/usePoloCoords'

// Leaflet — CSS global importado em main.jsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix ícones do Leaflet (problema comum com Vite/webpack)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Ícone customizado para polo selecionado (azul mais destacado)
const iconAtivo = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const iconInativo = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const iconMeu = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

// Centraliza o mapa quando clica num polo
function FlyTo({ coords }) {
  const map = useMap()
  useEffect(() => { if (coords) map.flyTo(coords, 15, { duration: 0.8 }) }, [coords])
  return null
}

const TIPOS = ['Ginásio','Arena','Estádio','Complexo','Academia','Parque Aquático','Quadras','Museu','Centro','Mini Estádio']
const EMPTY_FORM = { nome:'', tipo:'Ginásio', bairro:'', endereco:'', status:'Ativo' }

export default function Polos() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const { data: polos, loading, reload } = useSupabaseData('polos')
  const [filtro, setFiltro] = useState('Todos')
  const [view, setView] = useState('lista') // 'lista' | 'mapa'
  const { coords: poloCoords, loading: coordsLoading } = usePoloCoords(view === 'mapa' ? polos : [])
  const [flyTo, setFlyTo] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  const [myPoloIds, setMyPoloIds] = useState(null)
  const [outrosExpanded, setOutrosExpanded] = useState(true)

  useEffect(() => {
    if (!profile) return
    if (isAdmin) { setMyPoloIds(null); return }
    supabase.from('atribuicoes').select('polo_id').eq('usuario_id', profile.id)
      .not('polo_id', 'is', null)
      .then(({ data }) => {
        setMyPoloIds([...new Set((data ?? []).map(a => a.polo_id))])
      })
  }, [profile, isAdmin])

  const meusPolos   = isAdmin || myPoloIds === null ? [] : polos.filter(p => myPoloIds.includes(p.id))
  const outrosPolos = isAdmin || myPoloIds === null ? polos : polos.filter(p => !myPoloIds.includes(p.id))
  const todosVisiveis = isAdmin ? polos : [...meusPolos, ...outrosPolos]
  const tipos = ['Todos', ...new Set(todosVisiveis.map(p => p.tipo).filter(Boolean))]

  const meusVisiveis   = filtro === 'Todos' ? meusPolos   : meusPolos.filter(p => p.tipo === filtro)
  const outrosVisiveis = filtro === 'Todos' ? outrosPolos : outrosPolos.filter(p => p.tipo === filtro)
  const todosListagem  = isAdmin ? outrosVisiveis : [...meusVisiveis, ...outrosPolos.filter(p => filtro === 'Todos' || p.tipo === filtro)]

  function openNew()   { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }
  function openEdit(polo) {
    setForm({ nome: polo.nome, tipo: polo.tipo, bairro: polo.bairro ?? '', endereco: polo.endereco ?? '', status: polo.status })
    setEditing(polo); setModalOpen(true)
  }
  async function handleSave() {
    setSaving(true)
    editing
      ? await supabase.from('polos').update(form).eq('id', editing.id)
      : await supabase.from('polos').insert(form)
    setSaving(false); setModalOpen(false); reload()
  }
  async function handleDelete() {
    await supabase.from('polos').delete().eq('id', deletando.id)
    setDeletando(null); reload()
  }

  // ── Card polo ──────────────────────────────────────────────────────────────
  function PoloCard({ polo, isMeu }) {
    return (
      <div
        className={`bg-white dark:bg-navy-800 rounded-xl border transition-all group cursor-pointer
          hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm
          ${isMeu ? 'border-primary-300 dark:border-primary-700 ring-1 ring-primary-200 dark:ring-primary-800' : 'border-slate-200 dark:border-navy-700'}`}
        onClick={() => navigate(`/polos/${polo.id}`)}
      >
        {/* Linha superior: bairro em destaque + status */}
        <div className={`px-4 py-2 rounded-t-xl flex items-center justify-between gap-2
          ${isMeu ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-slate-50 dark:bg-navy-900/30'}`}>
          <span className={`text-xs font-bold truncate ${isMeu ? 'text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300'}`}>
            📍 {polo.bairro || '—'} — {polo.tipo}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge color={polo.status === 'Ativo' ? 'green' : 'gray'}>{polo.status}</Badge>
            {isMeu && <span className="text-[9px] bg-primary-600 text-white px-1.5 py-0.5 rounded-full font-bold">MEU POLO</span>}
          </div>
        </div>

        {/* Corpo */}
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin size={14} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-navy-900 dark:text-white leading-tight group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
              {polo.nome}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{polo.tipo}</p>
            {polo.endereco && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{polo.endereco}</p>
            )}
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
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Polos · ${todosVisiveis.length}`}
        action={
          <div className="flex items-center gap-2">
            {/* Toggle lista / mapa */}
            <div className="flex rounded-lg border border-slate-200 dark:border-navy-600 overflow-hidden">
              <button onClick={() => setView('lista')}
                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  view === 'lista' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                }`}>
                <List size={13}/> Lista
              </button>
              <button onClick={() => setView('mapa')}
                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-l border-slate-200 dark:border-navy-600 ${
                  view === 'mapa' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                }`}>
                <MapIcon size={13}/> Mapa
              </button>
            </div>
            {isAdmin && <Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5">

        {/* Filtros por tipo */}
        <div className="flex gap-2 flex-wrap mb-4">
          {tipos.map(t => (
            <button key={t} onClick={() => setFiltro(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filtro === t
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>

        ) : view === 'mapa' ? (
          /* ── VISTA MAPA ── */
          <div className="space-y-2">
            {coordsLoading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Localizando polos no mapa… ({Object.keys(poloCoords).length}/{polos.length})
              </div>
            )}
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700" style={{ height: '70vh' }}>
              <MapContainer center={VR_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {flyTo && <FlyTo coords={flyTo} />}
                {todosVisiveis
                  .filter(p => (filtro === 'Todos' || p.tipo === filtro) && poloCoords[p.id])
                  .map(polo => {
                    const coords = poloCoords[polo.id]
                    const isMeu = !isAdmin && myPoloIds?.includes(polo.id)
                    const icon  = polo.status !== 'Ativo' ? iconInativo : isMeu ? iconMeu : iconAtivo
                    return (
                      <Marker key={polo.id} position={coords} icon={icon}>
                        <Popup>
                          <div style={{ minWidth: 200 }}>
                            <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 2 }}>
                              📍 {polo.bairro}
                            </p>
                            <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{polo.nome}</p>
                            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{polo.tipo} · {polo.status}</p>
                            {polo.endereco && <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{polo.endereco}</p>}
                            <button onClick={() => navigate(`/polos/${polo.id}`)}
                              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                              Ver detalhes →
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  })}
              </MapContainer>
            </div>
            {/* Legenda */}
            <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 px-1">
              <span className="flex items-center gap-1">🟢 Meus polos</span>
              <span className="flex items-center gap-1">🔵 Ativos</span>
              <span className="flex items-center gap-1">⚫ Inativos</span>
            </div>
          </div>

        ) : isAdmin ? (
          /* ── LISTA ADMIN ── */
          todosListagem.length === 0 ? (
            <EmptyState icon="🏟️" title="Nenhum polo encontrado"
              action={<Button size="sm" onClick={openNew}><Plus size={13}/> Novo Polo</Button>} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todosListagem.map(polo => <PoloCard key={polo.id} polo={polo} isMeu={false} />)}
            </div>
          )

        ) : (
          /* ── LISTA NÃO-ADMIN: Meus Polos / Outros ── */
          <div className="space-y-6">

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-3">
                📍 Meus Polos · {meusVisiveis.length}
              </p>
              {myPoloIds === null ? (
                <p className="text-sm text-slate-400">Carregando...</p>
              ) : meusVisiveis.length === 0 ? (
                <div className="bg-slate-50 dark:bg-navy-900/30 rounded-xl border border-dashed border-slate-200 dark:border-navy-700 p-6 text-center">
                  <p className="text-xs text-slate-400">Você ainda não tem polos atribuídos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {meusVisiveis.map(polo => <PoloCard key={polo.id} polo={polo} isMeu />)}
                </div>
              )}
            </div>

            {outrosVisiveis.length > 0 && (
              <div>
                <button onClick={() => setOutrosExpanded(e => !e)}
                  className="flex items-center gap-2 mb-3 w-full text-left group">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 transition-colors">
                    🏟️ Outros Polos da Rede · {outrosVisiveis.length}
                  </span>
                  <span className="ml-auto text-slate-400 text-xs">{outrosExpanded ? '▲' : '▼'}</span>
                </button>
                {outrosExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60 hover:opacity-80 transition-opacity">
                    {outrosVisiveis.map(polo => <PoloCard key={polo.id} polo={polo} isMeu={false} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal novo/editar polo */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Polo' : 'Novo Polo'}>
        <div className="space-y-3">
          {[['Nome *', 'nome'], ['Bairro', 'bairro'], ['Endereço', 'endereco']].map(([label, field]) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
              <input type="text" value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-navy-700 text-navy-900 dark:text-white" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-navy-700 text-navy-900 dark:text-white">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-navy-700 text-navy-900 dark:text-white">
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletando} onClose={() => setDeletando(null)} onConfirm={handleDelete}
        title="Excluir Polo" description={`Excluir "${deletando?.nome}"? Esta ação não pode ser desfeita.`} />
    </div>
  )
}

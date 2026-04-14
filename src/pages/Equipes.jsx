// src/pages/Equipes.jsx
import { useState, useMemo } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { X, Phone, MapPin, BookOpen, Pencil, Trash2 } from 'lucide-react'

const CARGOS = ['professor', 'coordenador', 'estagiario', 'admin']
const CARGO_LABELS = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }
const CARGO_COLORS = { professor: 'amber', coordenador: 'blue', estagiario: 'purple', admin: 'green' }
const EMPTY_FORM = { nome: '', cargo: 'professor', telefone: '' }

function getInitials(nome = '') {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
}

export default function Equipes() {
  const { isAdmin, isCoordenador } = useAuth()
  const canEdit = isAdmin || isCoordenador

  const { data: membros, loading: loadingMembros, reload } = useSupabaseData('profiles', 'id,nome,cargo,telefone,ativo')
  const { data: turmas, loading: loadingTurmas } = useSupabaseData('turmas', 'id,polo_id,professor_id,modalidades(nome,emoji),dias,horario')
  const { data: polos, loading: loadingPolos } = useSupabaseData('polos', 'id,nome')

  const [selectedMembro, setSelectedMembro] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  const loading = loadingMembros || loadingTurmas || loadingPolos

  const ativos = useMemo(() => membros.filter(m => m.ativo !== false), [membros])

  const lideranca = useMemo(
    () => ativos.filter(m => m.cargo === 'admin' || m.cargo === 'eduardo'),
    [ativos]
  )

  // Liderança = admin ou coordenador
  const liderancaFiltrada = useMemo(
    () => ativos.filter(m => m.cargo === 'admin' || m.cargo === 'coordenador'),
    [ativos]
  )

  // Para cada polo, lista membros que têm turmas nesse polo
  const polosComMembros = useMemo(() => {
    return polos.map(polo => {
      const turmasDoPolo = turmas.filter(t => t.polo_id === polo.id)
      const professorIds = new Set(turmasDoPolo.map(t => t.professor_id).filter(Boolean))
      const membrosNoPolo = ativos.filter(m => professorIds.has(m.id))
      return { polo, membros: membrosNoPolo }
    }).filter(({ membros }) => membros.length > 0)
  }, [polos, turmas, ativos])

  // Turmas de um membro específico
  function turmasDeMembro(membroId) {
    return turmas.filter(t => t.professor_id === membroId)
  }

  function getNomePolo(poloId) {
    return polos.find(p => p.id === poloId)?.nome ?? '—'
  }

  function openEdit(m, e) {
    e?.stopPropagation()
    setForm({ nome: m.nome, cargo: m.cargo, telefone: m.telefone ?? '' })
    setEditing(m)
    setEditModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({ nome: form.nome, cargo: form.cargo, telefone: form.telefone }).eq('id', editing.id)
    setSaving(false)
    setEditModalOpen(false)
    // atualiza o selectedMembro se for o mesmo
    if (selectedMembro?.id === editing.id) {
      setSelectedMembro(prev => ({ ...prev, ...form }))
    }
    reload()
  }

  async function handleToggleAtivo() {
    await supabase.from('profiles').update({ ativo: !deletando.ativo }).eq('id', deletando.id)
    setDeletando(null)
    if (selectedMembro?.id === deletando.id) setSelectedMembro(null)
    reload()
  }

  function MemberCard({ m }) {
    const minhasTurmas = turmasDeMembro(m.id)
    return (
      <div
        key={m.id}
        onClick={() => setSelectedMembro(m)}
        className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-3 flex items-center gap-3 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all group"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {getInitials(m.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-xs font-bold text-navy-900 dark:text-white">{m.nome}</p>
            <Badge color={CARGO_COLORS[m.cargo] ?? 'gray'}>{CARGO_LABELS[m.cargo] ?? m.cargo}</Badge>
          </div>
          <div className="flex gap-3 flex-wrap">
            {m.telefone && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Phone size={9}/>{m.telefone}
              </span>
            )}
            {minhasTurmas.length > 0 && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <BookOpen size={9}/>{minhasTurmas.length} turma{minhasTurmas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={e => openEdit(m, e)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400 hover:text-slate-600 transition-colors">
              <Pencil size={13}/>
            </button>
            {isAdmin && (
              <button onClick={e => { e.stopPropagation(); setDeletando(m) }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title={`Equipe · ${ativos.length} membros`} />

      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : ativos.length === 0 ? (
          <EmptyState icon="👥" title="Nenhum membro na equipe" description="Convide usuários via Supabase Dashboard" />
        ) : (
          <div className="space-y-6">
            {/* Seção: Liderança */}
            {liderancaFiltrada.length > 0 && (
              <section>
                <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Liderança</h2>
                <div className="space-y-2">
                  {liderancaFiltrada.map(m => <MemberCard key={m.id} m={m} />)}
                </div>
              </section>
            )}

            {/* Seção: Por Polo */}
            {polosComMembros.map(({ polo, membros: mPolo }) => (
              <section key={polo.id}>
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin size={11} className="text-primary-500 flex-shrink-0" />
                  <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{polo.nome}</h2>
                </div>
                <div className="space-y-2">
                  {mPolo.map(m => <MemberCard key={m.id} m={m} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Slide-over: Detalhes do membro */}
      {selectedMembro && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSelectedMembro(null)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-navy-800 shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
              <span className="text-xs font-bold text-navy-900 dark:text-white">Perfil</span>
              <button
                onClick={() => setSelectedMembro(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={15}/>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-5">
              {/* Avatar + nome */}
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white text-xl font-bold">
                  {getInitials(selectedMembro.nome)}
                </div>
                <div>
                  <p className="text-sm font-bold text-navy-900 dark:text-white">{selectedMembro.nome}</p>
                  <div className="mt-1">
                    <Badge color={CARGO_COLORS[selectedMembro.cargo] ?? 'gray'}>
                      {CARGO_LABELS[selectedMembro.cargo] ?? selectedMembro.cargo}
                    </Badge>
                  </div>
                </div>
                {selectedMembro.telefone && (
                  <a
                    href={`tel:${selectedMembro.telefone}`}
                    className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-primary-600 transition-colors"
                  >
                    <Phone size={11}/>{selectedMembro.telefone}
                  </a>
                )}
              </div>

              {/* Turmas */}
              {(() => {
                const minhasTurmas = turmasDeMembro(selectedMembro.id)
                return (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                      {minhasTurmas.length} turma{minhasTurmas.length !== 1 ? 's' : ''} ativa{minhasTurmas.length !== 1 ? 's' : ''}
                    </p>
                    {minhasTurmas.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhuma turma atribuída.</p>
                    ) : (
                      <div className="space-y-2">
                        {minhasTurmas.map(t => (
                          <div key={t.id} className="bg-slate-50 dark:bg-navy-900 rounded-lg px-3 py-2.5 text-xs">
                            <div className="font-semibold text-navy-900 dark:text-white mb-0.5">
                              {t.modalidades?.emoji ?? '📚'} {t.modalidades?.nome ?? 'Turma'}
                            </div>
                            <div className="text-[10px] text-slate-400 flex flex-col gap-0.5">
                              <span className="flex items-center gap-1"><MapPin size={9}/>{getNomePolo(t.polo_id)}</span>
                              {t.dias && <span>{t.dias}</span>}
                              {t.horario && <span>{t.horario}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Footer actions */}
            {canEdit && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => openEdit(selectedMembro)}>
                  <Pencil size={12}/> Editar
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="secondary" onClick={() => setDeletando(selectedMembro)}>
                    <Trash2 size={12}/>
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal editar membro */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar Membro">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome</label>
            <input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cargo</label>
            <select
              value={form.cargo}
              onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {CARGOS.map(c => <option key={c} value={c}>{CARGO_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Telefone</label>
            <input
              value={form.telefone}
              onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="(24) 99999-0000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletando}
        onClose={() => setDeletando(null)}
        onConfirm={handleToggleAtivo}
        title="Desativar Membro"
        description={`Desativar "${deletando?.nome}"? O usuário perderá acesso ao sistema.`}
      />
    </div>
  )
}

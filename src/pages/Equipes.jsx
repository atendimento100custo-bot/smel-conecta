// src/pages/Equipes.jsx
import { useState, useMemo } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { X, Phone, MapPin, BookOpen, Pencil, Trash2, UserPlus, Filter } from 'lucide-react'

const poloLabel = (p) => [p.tipo, p.bairro].filter(Boolean).join(' ') || p.nome || ''

const CARGOS = ['professor', 'coordenador', 'estagiario', 'admin']
const CARGO_LABELS = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }
const CARGO_COLORS = { professor: 'amber', coordenador: 'blue', estagiario: 'purple', admin: 'green' }
const EMPTY_FORM = { nome: '', cargo: 'professor', telefone: '', email: '' }

function getInitials(nome = '') {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
}

const EMPTY_CREATE_FORM = { nome: '', email: '', senha: '', cargo: 'professor', telefone: '', vinculos: [] }

export default function Equipes() {
  const { isAdmin, isCoordenador, profile } = useAuth()
  const canEdit = isAdmin || isCoordenador

  const { data: membros, loading: loadingMembros, reload } = useSupabaseData('profiles', 'id,nome,cargo,telefone,ativo')
  const { data: turmas, loading: loadingTurmas } = useSupabaseData('turmas', 'id,polo_id,professor_id,modalidades(nome,emoji),dias,horario')
  const { data: polos, loading: loadingPolos } = useSupabaseData('polos', 'id,nome,tipo,bairro')
  const { data: atribuicoes } = useSupabaseData('atribuicoes', 'usuario_id,polo_id,cargo')

  const [filtroCargoEq, setFiltroCargoEq] = useState('')
  const [filtroPoloEq, setFiltroPoloEq] = useState('')
  const [selectedMembro, setSelectedMembro] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  // Novo funcionário
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

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

  // Para cada polo, lista membros via atribuições com hierarquia
  const polosComMembros = useMemo(() => {
    return polos.map(polo => {
      const membrosNoPolo = ativos.filter(m =>
        atribuicoes.some(a => a.usuario_id === m.id && a.polo_id === polo.id)
      )
      // Group by cargo hierarchy
      const coordenadores = membrosNoPolo.filter(m => m.cargo === 'coordenador')
      const professores = membrosNoPolo.filter(m => m.cargo === 'professor')
      const estagiarios = membrosNoPolo.filter(m => m.cargo === 'estagiario')
      return { polo, membros: membrosNoPolo, coordenadores, professores, estagiarios }
    }).filter(({ membros }) => membros.length > 0)
  }, [polos, atribuicoes, ativos])

  // Turmas de um membro específico
  function turmasDeMembro(membroId) {
    return turmas.filter(t => t.professor_id === membroId)
  }

  function getNomePolo(poloId) {
    const p = polos.find(p => p.id === poloId)
    return p ? poloLabel(p) : '—'
  }

  const secoesCargo = useMemo(() => {
    const ordem = ['admin', 'coordenador', 'professor', 'estagiario']
    let lista = ativos
    if (filtroPoloEq) lista = lista.filter(m => atribuicoes.some(a => a.usuario_id === m.id && a.polo_id === filtroPoloEq))
    if (filtroCargoEq) lista = lista.filter(m => m.cargo === filtroCargoEq)
    return ordem
      .map(cargo => ({
        cargo,
        label: CARGO_LABELS[cargo],
        color: CARGO_COLORS[cargo],
        membros: lista.filter(m => m.cargo === cargo).sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')),
      }))
      .filter(s => s.membros.length > 0)
  }, [ativos, filtroPoloEq, filtroCargoEq, atribuicoes])

  function openEdit(m, e) {
    e?.stopPropagation()
    setForm({ nome: m.nome, cargo: m.cargo, telefone: m.telefone ?? '', email: m.email ?? '' })
    setEditing(m)
    setEditModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({ nome: form.nome, cargo: form.cargo, telefone: form.telefone || null }).eq('id', editing.id)
    if (form.email && supabaseAdmin) {
      await supabaseAdmin.auth.admin.updateUserById(editing.id, { email: form.email })
    }
    setSaving(false)
    setEditModalOpen(false)
    if (selectedMembro?.id === editing.id) setSelectedMembro(prev => ({ ...prev, ...form }))
    reload()
  }

  // Cargo options based on current user role
  function getAllowedCargos() {
    const cargo = profile?.cargo
    if (cargo === 'admin') return ['admin', 'coordenador', 'professor', 'estagiario']
    if (cargo === 'coordenador') return ['coordenador', 'professor', 'estagiario']
    if (cargo === 'professor') return ['professor', 'estagiario']
    return ['professor']
  }

  function openCreate() {
    setCreateForm({ ...EMPTY_CREATE_FORM, vinculos: [] })
    setCreateError('')
    setCreateSuccess(false)
    setCreateOpen(true)
  }

  async function handleCreate() {
    if (!createForm.nome || !createForm.email || !createForm.senha) return
    setCreating(true)
    setCreateError('')

    if (!supabaseAdmin) {
      setCreateError('Configuração admin não disponível.')
      setCreating(false)
      return
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: createForm.email,
      password: createForm.senha,
      email_confirm: true,
    })

    if (error || !data?.user) {
      setCreateError(
        error?.message?.includes('already been registered')
          ? 'Este e-mail já está cadastrado.'
          : (error?.message ?? 'Erro ao criar usuário')
      )
      setCreating(false)
      return
    }

    const userId = data.user.id

    await supabase.from('profiles').upsert({
      id: userId,
      nome: createForm.nome,
      cargo: createForm.cargo,
      telefone: createForm.telefone || null,
      ativo: true,
    }, { onConflict: 'id' })

    // Salvar atribuições por polo (suporta múltiplos vínculos com cargos diferentes)
    for (const v of (createForm.vinculos ?? [])) {
      if (!v.polo_id) continue
      await supabase.from('atribuicoes').insert({
        usuario_id: userId,
        polo_id: v.polo_id,
        turma_id: (v.cargo !== 'coordenador' && v.turma_id) ? v.turma_id : null,
        cargo: v.cargo ?? 'professor',
      })
      if (v.cargo === 'professor' && v.turma_id) {
        await supabase.from('turmas').update({ professor_id: userId }).eq('id', v.turma_id)
      }
    }

    setCreating(false)
    setCreateSuccess(true)
    setTimeout(() => {
      setCreateOpen(false)
      setCreateSuccess(false)
      reload()
    }, 1500)
  }

  async function handleDelete() {
    if (!deletando || !supabaseAdmin) return
    // Limpar atribuições e referências antes de deletar
    await supabase.from('atribuicoes').delete().eq('usuario_id', deletando.id)
    await supabase.from('turmas').update({ professor_id: null }).eq('professor_id', deletando.id)
    // Deletar auth user (cascata deleta o profile)
    await supabaseAdmin.auth.admin.deleteUser(deletando.id)
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
      <Topbar
        title={`Equipe · ${ativos.length} membros`}
        action={canEdit && (
          <Button size="sm" onClick={() => openCreate()}>
            <UserPlus size={13} />
            <span className="hidden sm:inline">Novo Funcionário</span>
          </Button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5">

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-2 py-1.5">
            <Filter size={11} className="text-slate-400" />
            <select value={filtroCargoEq} onChange={e => setFiltroCargoEq(e.target.value)}
              className="text-xs bg-transparent text-navy-900 dark:text-white focus:outline-none">
              <option value="">Todos os cargos</option>
              {['admin','coordenador','professor','estagiario'].map(c => (
                <option key={c} value={c}>{CARGO_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-2 py-1.5">
            <MapPin size={11} className="text-slate-400" />
            <select value={filtroPoloEq} onChange={e => setFiltroPoloEq(e.target.value)}
              className="text-xs bg-transparent text-navy-900 dark:text-white focus:outline-none">
              <option value="">Todos os polos</option>
              {polos.map(p => <option key={p.id} value={p.id}>{poloLabel(p)}</option>)}
            </select>
          </div>
          {(filtroCargoEq || filtroPoloEq) && (
            <button onClick={() => { setFiltroCargoEq(''); setFiltroPoloEq('') }}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1">
              <X size={11}/> Limpar filtros
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : ativos.length === 0 ? (
          <EmptyState icon="👥" title="Nenhum membro na equipe" description="Convide usuários via Supabase Dashboard" />
        ) : secoesCargo.length === 0 ? (
          <EmptyState icon="🔍" title="Nenhum resultado" description="Tente ajustar os filtros" />
        ) : (
          <div className="space-y-6">
            {secoesCargo.map(({ cargo, label, color, membros }) => (
              <section key={cargo}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full bg-${color}-500`} />
                  <span className="text-slate-400 dark:text-slate-500">{label}s · {membros.length}</span>
                </h2>
                <div className="space-y-2">
                  {membros.map(m => <MemberCard key={m.id} m={m} />)}
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
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@exemplo.com"
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
        onConfirm={handleDelete}
        title="Excluir Funcionário"
        description={`Excluir "${deletando?.nome}" permanentemente? O acesso será removido e não poderá ser recuperado.`}
      />

      {/* Modal: Novo Funcionário */}
      <NovoFuncionarioModal
        open={createOpen}
        onClose={() => { if (!creating) setCreateOpen(false) }}
        form={createForm}
        setForm={setCreateForm}
        onSave={handleCreate}
        creating={creating}
        error={createError}
        success={createSuccess}
        cargos={getAllowedCargos()}
        polos={polos}
        turmas={turmas}
      />
    </div>
  )
}

// ─── Shared modal for creating a new employee ────────────────────────────────
const CARGO_LABELS_MODAL = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }
const ATRIB_CARGOS = ['coordenador', 'professor', 'estagiario']

export function NovoFuncionarioModal({ open, onClose, form, setForm, onSave, creating, error, success, cargos, polos, turmas, prePoloId }) {
  const ic = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-navy-900 dark:text-white'
  const poloLocked = !!prePoloId
  const vinculos = form.vinculos ?? []
  const showVinculos = form.cargo !== 'admin'

  function addVinculo() {
    setForm(f => ({ ...f, vinculos: [...(f.vinculos ?? []), { polo_id: prePoloId || '', cargo: 'professor', turma_id: '' }] }))
  }

  function updateVinculo(idx, field, value) {
    setForm(f => ({
      ...f,
      vinculos: (f.vinculos ?? []).map((v, i) =>
        i === idx ? { ...v, [field]: value, ...(field === 'polo_id' ? { turma_id: '' } : {}), ...(field === 'cargo' ? { turma_id: '' } : {}) } : v
      )
    }))
  }

  function removeVinculo(idx) {
    setForm(f => ({ ...f, vinculos: (f.vinculos ?? []).filter((_, i) => i !== idx) }))
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Funcionário" size="md">
      <div className="space-y-3">

        {/* Nome */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome completo <span className="text-red-400">*</span></label>
          <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Maria Oliveira" className={ic} />
        </div>

        {/* Email + Senha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">E-mail <span className="text-red-400">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className={ic} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Senha inicial <span className="text-red-400">*</span></label>
            <input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mín. 6 caracteres" className={ic} />
          </div>
        </div>

        {/* Cargo global + Telefone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nível de acesso <span className="text-red-400">*</span></label>
            <select
              value={form.cargo}
              onChange={e => setForm(f => ({ ...f, cargo: e.target.value, vinculos: e.target.value === 'admin' ? [] : (f.vinculos ?? []) }))}
              className={ic}
            >
              {cargos.map(c => <option key={c} value={c}>{CARGO_LABELS_MODAL[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Telefone <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input type="tel" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(24) 99999-0000" className={ic} />
          </div>
        </div>

        {/* ── Atribuições por polo ─────────────────────────────────── */}
        {showVinculos && (
          <div className="border border-slate-200 dark:border-navy-600 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Atribuições por polo <span className="text-slate-400 font-normal">(opcional)</span></p>
              <button type="button" onClick={addVinculo} className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
                + Adicionar
              </button>
            </div>

            {vinculos.length === 0 && (
              <p className="text-[11px] text-slate-400 italic">Nenhuma atribuição adicionada.</p>
            )}

            {vinculos.map((v, idx) => (
              <div key={idx} className="flex gap-1.5 items-center bg-slate-50 dark:bg-navy-800 rounded-lg p-2 flex-wrap">
                {/* Polo */}
                {poloLocked ? (
                  <span className="text-xs font-medium text-navy-800 dark:text-slate-200 px-1 flex-shrink-0">
                    📍 {polos.find(p => p.id === prePoloId)?.nome ?? '—'}
                  </span>
                ) : (
                  <select value={v.polo_id} onChange={e => updateVinculo(idx, 'polo_id', e.target.value)} className={`${ic} text-[11px] py-1.5 flex-1 min-w-[110px]`}>
                    <option value="">— Polo —</option>
                    {polos.map(p => <option key={p.id} value={p.id}>{poloLabel(p)}</option>)}
                  </select>
                )}

                {/* Cargo no polo */}
                <select value={v.cargo ?? 'professor'} onChange={e => updateVinculo(idx, 'cargo', e.target.value)} className={`${ic} text-[11px] py-1.5 flex-1 min-w-[110px]`}>
                  {ATRIB_CARGOS.map(c => <option key={c} value={c}>{CARGO_LABELS_MODAL[c]}</option>)}
                </select>

                {/* Turma (só para professor e estagiário) */}
                {v.cargo !== 'coordenador' && v.polo_id && (
                  <select value={v.turma_id ?? ''} onChange={e => updateVinculo(idx, 'turma_id', e.target.value)} className={`${ic} text-[11px] py-1.5 flex-1 min-w-[120px]`}>
                    <option value="">— Turma —</option>
                    {turmas.filter(t => t.polo_id === v.polo_id).map(t => (
                      <option key={t.id} value={t.id}>
                        {t.modalidades?.emoji ?? '📚'} {t.modalidades?.nome ?? 'Turma'}{t.horario ? ` · ${t.horario.slice(0,5)}` : ''}
                      </option>
                    ))}
                  </select>
                )}

                <button type="button" onClick={() => removeVinculo(idx)} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">✓ Funcionário criado com sucesso!</p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={creating}>Cancelar</Button>
          <Button size="sm" onClick={onSave} disabled={creating || !form.nome || !form.email || !form.senha}>
            {creating ? 'Criando...' : 'Criar Funcionário'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// src/pages/Equipes.jsx
import { useState, useMemo } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { criarFuncionario, atualizarEmailFuncionario, excluirFuncionario } from '../lib/adminUsers'
import { useAuth } from '../hooks/useAuth'
import { logAcao } from '../lib/auditLog'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { X, Phone, MapPin, BookOpen, Pencil, Trash2, UserPlus, Filter, Check, Plus } from 'lucide-react'

const poloLabel = (p) => [p.tipo, p.bairro].filter(Boolean).join(' ') || p.nome || ''

// Salva atribuições a partir da estrutura [{ polo_id, turma_ids: [] }]
export async function salvarVinculos(userId, cargoGlobal, vinculos) {
  for (const v of vinculos) {
    if (!v.polo_id) continue
    // 1 linha por polo (marca presença no polo, sem turma específica)
    await supabase.from('atribuicoes').insert({
      usuario_id: userId, polo_id: v.polo_id, cargo: cargoGlobal, turma_id: null,
    })
    // 1 linha por turma selecionada
    for (const turmaId of (v.turma_ids ?? [])) {
      await supabase.from('atribuicoes').insert({
        usuario_id: userId, polo_id: v.polo_id, cargo: cargoGlobal, turma_id: turmaId,
      })
      // Atribui professor_id na turma (para professor e coordenador que leciona)
      if (cargoGlobal !== 'admin') {
        await supabase.from('turmas').update({ professor_id: userId }).eq('id', turmaId)
      }
    }
  }
}

const CARGOS = ['professor', 'coordenador', 'estagiario', 'admin']
const CARGO_LABELS = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }
const CARGO_COLORS = { professor: 'amber', coordenador: 'blue', estagiario: 'purple', admin: 'green' }
const EMPTY_FORM = { nome: '', cargo: 'professor', telefone: '', email: '', vinculos: [] }

function getInitials(nome = '') {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
}

const EMPTY_CREATE_FORM = { nome: '', email: '', senha: '', cargo: 'professor', telefone: '', vinculos: [] }

export default function Equipes() {
  const { isAdmin, isCoordenador, profile } = useAuth()
  const canEdit = isAdmin || isCoordenador

  const { data: membros, loading: loadingMembros, reload } = useSupabaseData('profiles', 'id,nome,cargo,telefone,email,ativo')
  const { data: turmas, loading: loadingTurmas } = useSupabaseData('turmas', 'id,polo_id,professor_id,faixa,modalidades(nome,emoji),dias,horario')
  const { data: polos, loading: loadingPolos } = useSupabaseData('polos', 'id,nome,tipo,bairro')
  const { data: atribuicoes, reload: reloadAtribuicoes } = useSupabaseData('atribuicoes', 'id,usuario_id,polo_id,cargo,turma_id')

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

  // Turmas de um membro específico — via professor_id (professores) OU atribuicoes (estagiários/coordenadores)
  function turmasDeMembro(membroId) {
    const turmaIdsViaAtrib = new Set(
      atribuicoes
        .filter(a => a.usuario_id === membroId && a.turma_id)
        .map(a => a.turma_id)
    )
    return turmas.filter(t => t.professor_id === membroId || turmaIdsViaAtrib.has(t.id))
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
    // Agrupa atribuições por polo → { polo_id, turma_ids: [] }
    const poloMap = {}
    for (const a of atribuicoes.filter(a => a.usuario_id === m.id)) {
      if (!poloMap[a.polo_id]) poloMap[a.polo_id] = { polo_id: a.polo_id, turma_ids: [] }
      if (a.turma_id) poloMap[a.polo_id].turma_ids.push(a.turma_id)
    }
    setForm({
      nome: m.nome ?? '',
      cargo: m.cargo ?? 'professor',
      telefone: m.telefone ?? '',
      email: m.email ?? '',
      vinculos: Object.values(poloMap),
    })
    setEditing(m)
    setEditModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({
      nome: form.nome,
      cargo: form.cargo,
      telefone: form.telefone || null,
      email: form.email || null,
    }).eq('id', editing.id)

    if (form.email) {
      const { error } = await atualizarEmailFuncionario(editing.id, form.email)
      if (error) console.warn('[atualizarEmailFuncionario]', error)
    }

    await supabase.from('turmas').update({ professor_id: null }).eq('professor_id', editing.id)
    await supabase.from('atribuicoes').delete().eq('usuario_id', editing.id)

    await salvarVinculos(editing.id, form.cargo, form.vinculos ?? [])

    logAcao({
      acao: 'edicao_funcionario',
      perfil: profile,
      detalhes: `${form.nome} (${form.cargo})`,
    })

    setSaving(false)
    setEditModalOpen(false)
    if (selectedMembro?.id === editing.id) setSelectedMembro(prev => ({ ...prev, nome: form.nome, cargo: form.cargo, telefone: form.telefone }))
    reload()
    reloadAtribuicoes()
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

    const { data, error } = await criarFuncionario({
      nome: createForm.nome,
      email: createForm.email,
      senha: createForm.senha,
      cargo: createForm.cargo,
      telefone: createForm.telefone,
    })

    if (error || !data?.userId) {
      setCreateError(error ?? 'Erro ao criar usuário')
      setCreating(false)
      return
    }

    const userId = data.userId

    await salvarVinculos(userId, createForm.cargo, createForm.vinculos ?? [])

    logAcao({
      acao: 'cadastro_funcionario',
      perfil: profile,
      detalhes: `${createForm.nome} (${createForm.cargo}) — ${createForm.email}`,
    })

    setCreating(false)
    setCreateSuccess(true)
    setTimeout(() => {
      setCreateOpen(false)
      setCreateSuccess(false)
      reload()
    }, 1500)
  }

  async function handleDelete() {
    if (!deletando) return
    // A Edge Function já limpa atribuições/turmas antes de excluir a conta.
    const { error } = await excluirFuncionario(deletando.id)
    if (error) { console.warn('[excluirFuncionario]', error); setDeletando(null); return }
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

      {/* Modal editar membro — completo com atribuições */}
      <EditarFuncionarioModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        form={form}
        setForm={setForm}
        onSave={handleSave}
        saving={saving}
        cargos={getAllowedCargos()}
        polos={polos}
        turmas={turmas}
      />

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

const CARGO_LABELS_ALL = { professor: 'Professor', coordenador: 'Coordenador', estagiario: 'Estagiário', admin: 'Administrador' }

// ─── Card de um polo com seleção de turmas ────────────────────────────────────
const FAIXA_ORDER = { 'Infantil': 0, 'Adulto': 1, 'Melhor Idade': 2 }

function PoloCard({ v, idx, polos, turmas, cargoGlobal, onChange, onRemove, poloLocked, prePoloId }) {
  const ic = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-navy-900 dark:text-white'
  const polo_id = poloLocked ? prePoloId : v.polo_id
  const turmasPolo = turmas
    .filter(t => t.polo_id === polo_id)
    .sort((a, b) => {
      const modA = a.modalidades?.nome ?? ''
      const modB = b.modalidades?.nome ?? ''
      const modCmp = modA.localeCompare(modB, 'pt-BR')
      if (modCmp !== 0) return modCmp
      const fa = FAIXA_ORDER[a.faixa] ?? 99
      const fb = FAIXA_ORDER[b.faixa] ?? 99
      if (fa !== fb) return fa - fb
      return (a.horario ?? '').localeCompare(b.horario ?? '')
    })
  const isCoord = cargoGlobal === 'coordenador'

  function toggleTurma(turmaId) {
    const ids = v.turma_ids ?? []
    const next = ids.includes(turmaId) ? ids.filter(id => id !== turmaId) : [...ids, turmaId]
    onChange({ ...v, polo_id: polo_id, turma_ids: next })
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-navy-800 px-4 py-2.5 border-b border-slate-200 dark:border-navy-700">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Polo {idx + 1}
        </span>
        <button type="button" onClick={onRemove}
          className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Seletor de polo */}
        {poloLocked ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg">
            <MapPin size={13} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-navy-800 dark:text-slate-200">
              {polos.find(p => p.id === prePoloId)?.nome ?? '—'}
            </span>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Polo</label>
            <select value={v.polo_id ?? ''} onChange={e => onChange({ ...v, polo_id: e.target.value, turma_ids: [] })} className={ic}>
              <option value="">Selecionar polo...</option>
              {polos.map(p => <option key={p.id} value={p.id}>{poloLabel(p)}</option>)}
            </select>
          </div>
        )}

        {/* Coordenador: badge informativo */}
        {isCoord && polo_id && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-lg">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Coordenador deste polo</span>
            <span className="text-[10px] text-blue-500 dark:text-blue-400">· pode também lecionar turmas abaixo</span>
          </div>
        )}

        {/* Turmas — checkboxes */}
        {polo_id && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
              {isCoord ? 'Turmas que também leciona' : 'Turmas'}
            </label>
            {turmasPolo.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhuma turma cadastrada neste polo.</p>
            ) : (
              <div className="space-y-1.5">
                {turmasPolo.map(t => {
                  const selected = (v.turma_ids ?? []).includes(t.id)
                  const dias = Array.isArray(t.dias) ? t.dias.join(', ') : (t.dias ?? '')
                  return (
                    <button key={t.id} type="button" onClick={() => toggleTurma(t.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        selected
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700'
                          : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-600 hover:border-slate-300 dark:hover:border-navy-500'
                      }`}>
                      {/* Checkbox visual */}
                      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                        selected ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-navy-500'
                      }`}>
                        {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      {/* Info da turma */}
                      <span className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold block ${selected ? 'text-primary-800 dark:text-primary-200' : 'text-navy-900 dark:text-white'}`}>
                          {t.modalidades?.emoji ?? '📚'} {t.modalidades?.nome ?? 'Turma'}
                        </span>
                        {(dias || t.horario) && (
                          <span className={`text-[10px] ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}>
                            {dias}{dias && t.horario ? ' · ' : ''}{t.horario?.slice(0, 5)}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Seção de atribuições ─────────────────────────────────────────────────────
function AtribuicoesSection({ vinculos, setVinculos, polos, turmas, cargoGlobal, poloLocked, prePoloId }) {
  const list = vinculos ?? []

  function addPolo() {
    setVinculos([...list, { polo_id: prePoloId ?? '', turma_ids: [] }])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Polos e Turmas</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Onde este funcionário atua</p>
        </div>
        {!poloLocked && (
          <button type="button" onClick={addPolo}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 px-2.5 py-1.5 rounded-lg transition-colors">
            <Plus size={12} /> Adicionar polo
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-600 py-6 flex flex-col items-center gap-2 text-slate-400">
          <MapPin size={18} className="opacity-40" />
          <p className="text-xs">Nenhum polo atribuído</p>
          {!poloLocked && (
            <button type="button" onClick={addPolo} className="text-[11px] text-primary-600 hover:underline font-semibold">
              + Adicionar polo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((v, idx) => (
            <PoloCard
              key={idx}
              v={v}
              idx={idx}
              polos={polos}
              turmas={turmas}
              cargoGlobal={cargoGlobal}
              onChange={updated => setVinculos(list.map((x, i) => i === idx ? updated : x))}
              onRemove={() => setVinculos(list.filter((_, i) => i !== idx))}
              poloLocked={poloLocked}
              prePoloId={prePoloId}
            />
          ))}
          {poloLocked && (
            <button type="button" onClick={addPolo}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 px-2.5 py-2 rounded-lg transition-colors border border-dashed border-primary-200 dark:border-primary-800">
              <Plus size={12} /> Adicionar outro polo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal editar funcionário ─────────────────────────────────────────────────
export function EditarFuncionarioModal({ open, onClose, form, setForm, onSave, saving, cargos, polos, turmas }) {
  const ic = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-navy-900 dark:text-white'
  const noAuto = { autoComplete: 'new-password', readOnly: true, onFocus: e => e.currentTarget.removeAttribute('readonly') }

  return (
    <Modal open={open} onClose={onClose} title="Editar Funcionário" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome completo</label>
          <input type="text" {...noAuto} value={form.nome ?? ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={ic} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">E-mail</label>
            <input type="text" {...noAuto} value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className={ic} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Telefone</label>
            <input type="text" {...noAuto} value={form.telefone ?? ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(24) 99999-0000" className={ic} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nível de acesso</label>
          <select value={form.cargo ?? 'professor'}
            onChange={e => setForm(f => ({ ...f, cargo: e.target.value, vinculos: e.target.value === 'admin' ? [] : (f.vinculos ?? []) }))}
            className={ic}>
            {cargos.map(c => <option key={c} value={c}>{CARGO_LABELS_ALL[c]}</option>)}
          </select>
        </div>

        {form.cargo !== 'admin' && (
          <>
            <div className="border-t border-slate-100 dark:border-navy-700" />
            <AtribuicoesSection
              vinculos={form.vinculos ?? []}
              setVinculos={vs => setForm(f => ({ ...f, vinculos: vs }))}
              polos={polos}
              turmas={turmas}
              cargoGlobal={form.cargo ?? 'professor'}
            />
          </>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={onSave} disabled={saving || !form.nome}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal criar novo funcionário ─────────────────────────────────────────────
export function NovoFuncionarioModal({ open, onClose, form, setForm, onSave, creating, error, success, cargos, polos, turmas, prePoloId }) {
  const ic = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-navy-900 dark:text-white'
  const noAuto = { autoComplete: 'new-password', readOnly: true, onFocus: e => e.currentTarget.removeAttribute('readonly') }

  return (
    <Modal open={open} onClose={onClose} title="Novo Funcionário" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome completo <span className="text-red-400">*</span></label>
          <input type="text" {...noAuto} value={form.nome ?? ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Maria Oliveira" className={ic} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">E-mail <span className="text-red-400">*</span></label>
            <input type="text" {...noAuto} value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className={ic} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Senha inicial <span className="text-red-400">*</span></label>
            <input type="password" autoComplete="new-password" value={form.senha ?? ''} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mín. 6 caracteres" className={ic} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nível de acesso <span className="text-red-400">*</span></label>
            <select value={form.cargo ?? 'professor'}
              onChange={e => setForm(f => ({ ...f, cargo: e.target.value, vinculos: e.target.value === 'admin' ? [] : (f.vinculos ?? []) }))}
              className={ic}>
              {cargos.map(c => <option key={c} value={c}>{CARGO_LABELS_ALL[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Telefone <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input type="text" {...noAuto} value={form.telefone ?? ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(24) 99999-0000" className={ic} />
          </div>
        </div>

        {form.cargo !== 'admin' && (
          <>
            <div className="border-t border-slate-100 dark:border-navy-700" />
            <AtribuicoesSection
              vinculos={form.vinculos ?? []}
              setVinculos={vs => setForm(f => ({ ...f, vinculos: vs }))}
              polos={polos}
              turmas={turmas}
              cargoGlobal={form.cargo ?? 'professor'}
              poloLocked={!!prePoloId}
              prePoloId={prePoloId}
            />
          </>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">✓ Funcionário criado com sucesso!</p>}

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

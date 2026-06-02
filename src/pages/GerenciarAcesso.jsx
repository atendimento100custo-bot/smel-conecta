// src/pages/GerenciarAcesso.jsx
import { useState, useCallback } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase, supabaseAdmin } from '../lib/supabase'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Search, Pencil, Link2, X, Trash2, KeyRound, Copy, Check } from 'lucide-react'

const CARGO_COLORS = { admin: 'purple', coordenador: 'blue', professor: 'green', estagiario: 'amber' }
const CARGO_LABELS = { admin: 'Administrador', coordenador: 'Coordenador', professor: 'Professor', estagiario: 'Estagiário' }
const CARGO_ORDER = ['admin', 'coordenador', 'professor', 'estagiario']
const poloLabelAcesso = (p) => [p.tipo, p.bairro].filter(Boolean).join(' ') || p.nome || ''
const ATRIB_CARGOS = ['coordenador', 'professor', 'estagiario']
const EMPTY_FORM = { cargo: 'professor', ativo: true, telefone: '' }

export default function GerenciarAcesso() {
  const { data: profiles, loading, reload } = useSupabaseData('profiles', '*')
  const { data: polos } = useSupabaseData('polos', 'id,nome,tipo,bairro')
  const { data: turmas } = useSupabaseData('turmas', 'id, polo_id, horario, modalidades(nome)')

  const [search, setSearch] = useState('')

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Excluir usuário
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Modal credenciais (email + senha)
  const DEFAULT_SENHA = 'smel2026'
  const [resetTarget, setResetTarget] = useState(null)
  const [novoEmail, setNovoEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailDone, setEmailDone] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [copied, setCopied] = useState(false)

  function openCredenciais(p) {
    setResetTarget(p)
    setNovoEmail(p.email ?? '')
    setSavingEmail(false)
    setEmailDone(false)
    setEmailError('')
    setResetting(false)
    setResetDone(false)
    setCopied(false)
  }

  async function handleSalvarEmail() {
    if (!resetTarget || !supabaseAdmin) return
    const email = novoEmail.trim()
    if (!email || email === resetTarget.email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Email inválido'); return }
    setSavingEmail(true)
    setEmailError('')
    const { error } = await supabaseAdmin.auth.admin.updateUserById(resetTarget.id, { email })
    if (error) {
      setEmailError(error.message || 'Erro ao atualizar email')
    } else {
      // Atualiza também o profile
      await supabase.from('profiles').update({ email }).eq('id', resetTarget.id)
      setEmailDone(true)
      setResetTarget(prev => ({ ...prev, email }))
      reload()
    }
    setSavingEmail(false)
  }

  async function handleResetSenha() {
    if (!resetTarget || !supabaseAdmin) return
    setResetting(true)
    await supabaseAdmin.auth.admin.updateUserById(resetTarget.id, { password: DEFAULT_SENHA })
    setResetting(false)
    setResetDone(true)
  }

  function handleCopySenha() {
    navigator.clipboard.writeText(DEFAULT_SENHA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function closeReset() {
    setResetTarget(null)
    setEmailDone(false)
    setEmailError('')
    setResetDone(false)
    setCopied(false)
  }

  async function handleDelete() {
    if (!deleteTarget || !supabaseAdmin) return
    setDeleting(true)
    // Limpar atribuições e vínculos antes
    await supabase.from('atribuicoes').delete().eq('usuario_id', deleteTarget.id)
    await supabase.from('turmas').update({ professor_id: null }).eq('professor_id', deleteTarget.id)
    // Deletar auth user (cascata deleta o profile)
    await supabaseAdmin.auth.admin.deleteUser(deleteTarget.id)
    setDeleteTarget(null)
    setDeleting(false)
    reload()
  }

  // Atribuições modal
  const [vinculosOpen, setVinculosOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [vinculos, setVinculos] = useState([])
  const [vinculosLoading, setVinculosLoading] = useState(false)
  const [newAtrib, setNewAtrib] = useState({ polo_id: '', cargo: 'professor', turma_id: '' })
  const [addingAtrib, setAddingAtrib] = useState(false)

  const secoesPorCargo = CARGO_ORDER.map(cargo => ({
    cargo,
    label: CARGO_LABELS[cargo],
    membros: profiles
      .filter(p => {
        if (p.cargo !== cargo) return false
        if (!search.trim()) return true
        const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        return norm(search).split(/\s+/).filter(Boolean).every(w => norm(p.nome).includes(w))
      })
      .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')),
  })).filter(s => s.membros.length > 0)

  const semCargo = profiles.filter(p => {
    if (CARGO_ORDER.includes(p.cargo)) return false
    if (!search.trim()) return true
    const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return norm(search).split(/\s+/).filter(Boolean).every(w => norm(p.nome).includes(w))
  }).sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))

  function openEdit(p) {
    setEditing(p)
    setForm({ cargo: p.cargo ?? 'professor', ativo: p.ativo ?? true, telefone: p.telefone ?? '' })
    setEditOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({ cargo: form.cargo, ativo: form.ativo, telefone: form.telefone }).eq('id', editing.id)
    setSaving(false)
    setEditOpen(false)
    reload()
  }

  const openVinculos = useCallback(async (p) => {
    setSelectedUser(p)
    setVinculosOpen(true)
    setVinculos([])
    setVinculosLoading(true)
    setNewAtrib({ polo_id: '', cargo: 'professor', turma_id: '' })
    const { data } = await supabase.from('atribuicoes').select('id, polo_id, turma_id, cargo').eq('usuario_id', p.id)
    setVinculos(data ?? [])
    setVinculosLoading(false)
  }, [])

  async function addAtribuicao() {
    if (!newAtrib.polo_id) return
    setAddingAtrib(true)
    const payload = {
      usuario_id: selectedUser.id,
      polo_id: newAtrib.polo_id,
      turma_id: (newAtrib.cargo !== 'coordenador' && newAtrib.turma_id) ? newAtrib.turma_id : null,
      cargo: newAtrib.cargo,
    }
    const { data } = await supabase.from('atribuicoes').insert(payload).select('id, polo_id, turma_id, cargo').single()
    if (data) setVinculos(prev => [...prev, data])
    setNewAtrib({ polo_id: '', cargo: 'professor', turma_id: '' })
    setAddingAtrib(false)
  }

  async function removeAtribuicao(id) {
    await supabase.from('atribuicoes').delete().eq('id', id)
    setVinculos(prev => prev.filter(v => v.id !== id))
  }

  const ic = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Gerenciar Acesso" />

      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-navy-700 dark:text-white"
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : secoesPorCargo.length === 0 && semCargo.length === 0 ? (
          <EmptyState icon="👤" title="Nenhum usuário encontrado" description={search ? 'Tente outro termo.' : 'Nenhum perfil cadastrado.'} />
        ) : (
          <div className="space-y-6">
            {secoesPorCargo.map(({ cargo, label, membros }) => (
              <section key={cargo}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <Badge color={CARGO_COLORS[cargo] ?? 'gray'}>{label}</Badge>
                  <span className="font-normal">· {membros.length}</span>
                </h2>
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {membros.map((p, i) => (
                        <tr key={p.id} className={`border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50/60 dark:hover:bg-navy-700/40 transition-colors`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400">
                                  {(p.nome || p.email || '?')[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-navy-900 dark:text-white leading-tight">
                                  {p.nome || <span className="italic text-slate-400">Sem nome</span>}
                                </p>
                                {p.email && <p className="text-[10px] text-slate-400 leading-tight">{p.email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <span className="text-xs text-slate-600 dark:text-slate-300">{p.telefone || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge color={p.ativo ? 'green' : 'gray'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Editar acesso">
                                <Pencil size={13} />
                              </button>
                              {p.cargo !== 'admin' && (
                                <button onClick={() => openVinculos(p)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-500 transition-colors" title="Gerenciar atribuições">
                                  <Link2 size={13} />
                                </button>
                              )}
                              <button onClick={() => openCredenciais(p)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-400 hover:text-amber-500 transition-colors" title="Redefinir senha">
                                <KeyRound size={13} />
                              </button>
                              <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors" title="Excluir usuário">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            {semCargo.length > 0 && (
              <section>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400 dark:text-slate-500">Sem cargo definido · {semCargo.length}</h2>
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {semCargo.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50/60 dark:hover:bg-navy-700/40 transition-colors">
                          <td className="py-3 px-4">
                            <p className="text-xs font-semibold text-navy-900 dark:text-white">{p.nome || <span className="italic text-slate-400">Sem nome</span>}</p>
                            {p.email && <p className="text-[10px] text-slate-400">{p.email}</p>}
                          </td>
                          <td className="py-3 px-4"><Badge color="gray">{p.cargo ?? '—'}</Badge></td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-400 hover:text-slate-600 transition-colors"><Pencil size={13}/></button>
                              <button onClick={() => openCredenciais(p)} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-500 transition-colors" title="Redefinir senha"><KeyRound size={13}/></button>
                              <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Modal: Editar Acesso */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Acesso">
        <div className="space-y-4">
          {editing && (
            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-navy-700 rounded-lg px-3 py-2.5 border border-slate-100 dark:border-navy-600">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-700 dark:text-primary-400">{(editing.nome || editing.email || '?')[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-navy-900 dark:text-white">{editing.nome || 'Sem nome'}</p>
                {editing.email && <p className="text-[10px] text-slate-400">{editing.email}</p>}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Cargo global</label>
            <select value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} className={ic}>
              <option value="admin">Administrador</option>
              <option value="coordenador">Coordenador</option>
              <option value="professor">Professor</option>
              <option value="estagiario">Estagiário</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Telefone</label>
            <input type="tel" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" className={ic} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Status</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              className={`relative inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${form.ativo ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-navy-700 dark:border-navy-600 dark:text-slate-400'}`}>
              <span className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${form.ativo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-500'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
              {form.ativo ? 'Ativo' : 'Inativo'}
            </button>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Atribuições por polo */}
      <Modal open={vinculosOpen} onClose={() => setVinculosOpen(false)} title={`Atribuições · ${selectedUser?.nome || selectedUser?.email || ''}`} size="lg">
        {vinculosLoading ? (
          <p className="text-sm text-slate-400 py-4">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {/* Atribuições existentes */}
            {vinculos.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Nenhuma atribuição cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {vinculos.map(v => {
                  const polo = polos.find(p => p.id === v.polo_id)
                  const turma = turmas.find(t => t.id === v.turma_id)
                  return (
                    <div key={v.id} className="flex items-center gap-2 bg-slate-50 dark:bg-navy-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-navy-700">
                      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                        <Badge color={v.cargo === 'coordenador' ? 'blue' : v.cargo === 'professor' ? 'amber' : 'purple'}>
                          {CARGO_LABELS[v.cargo] ?? v.cargo}
                        </Badge>
                        <span className="text-xs font-medium text-navy-800 dark:text-slate-200">{polo?.nome ?? '—'}</span>
                        {turma && <span className="text-[10px] text-slate-400">· {turma.modalidades?.nome ?? 'Turma'}{turma.horario ? ` ${turma.horario.slice(0,5)}` : ''}</span>}
                      </div>
                      <button onClick={() => removeAtribuicao(v.id)} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Adicionar nova atribuição */}
            <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Adicionar atribuição</p>
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Polo</label>
                  <select value={newAtrib.polo_id} onChange={e => setNewAtrib(a => ({ ...a, polo_id: e.target.value, turma_id: '' }))} className={ic}>
                    <option value="">— Polo —</option>
                    {polos.map(p => <option key={p.id} value={p.id}>{poloLabelAcesso(p)}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Cargo no polo</label>
                  <select value={newAtrib.cargo} onChange={e => setNewAtrib(a => ({ ...a, cargo: e.target.value, turma_id: '' }))} className={ic}>
                    {ATRIB_CARGOS.map(c => <option key={c} value={c}>{CARGO_LABELS[c]}</option>)}
                  </select>
                </div>
                {newAtrib.cargo !== 'coordenador' && newAtrib.polo_id && (
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Turma (opcional)</label>
                    <select value={newAtrib.turma_id} onChange={e => setNewAtrib(a => ({ ...a, turma_id: e.target.value }))} className={ic}>
                      <option value="">— Turma —</option>
                      {turmas.filter(t => t.polo_id === newAtrib.polo_id).map(t => (
                        <option key={t.id} value={t.id}>{t.modalidades?.nome ?? 'Turma'}{t.horario ? ` · ${t.horario.slice(0,5)}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Button size="sm" onClick={addAtribuicao} disabled={addingAtrib || !newAtrib.polo_id}>
                  {addingAtrib ? '...' : '+ Adicionar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Modal: Credenciais (email + senha) */}
      <Modal open={!!resetTarget} onClose={closeReset} title="Credenciais de Acesso">
        <div className="space-y-5">
          {/* Cabeçalho usuário */}
          {resetTarget && (
            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-navy-700 rounded-lg px-3 py-2.5 border border-slate-100 dark:border-navy-600">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-700 dark:text-primary-400">{(resetTarget.nome || resetTarget.email || '?')[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-navy-900 dark:text-white">{resetTarget.nome || 'Sem nome'}</p>
                {resetTarget.email && <p className="text-[10px] text-slate-400">{resetTarget.email}</p>}
              </div>
            </div>
          )}

          {/* Seção: Email */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              📧 Email de acesso
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={novoEmail}
                onChange={e => { setNovoEmail(e.target.value); setEmailDone(false); setEmailError('') }}
                className={ic + ' flex-1'}
                placeholder="novo@email.com"
              />
              <Button
                size="sm"
                variant={emailDone ? 'secondary' : 'primary'}
                onClick={handleSalvarEmail}
                disabled={savingEmail || !novoEmail.trim() || novoEmail.trim() === resetTarget?.email}
              >
                {savingEmail ? '...' : emailDone ? <><Check size={13} className="inline mr-1 text-emerald-500" />Salvo</> : 'Salvar'}
              </Button>
            </div>
            {emailError && <p className="text-[11px] text-red-500">{emailError}</p>}
            {emailDone && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ Email atualizado com sucesso!</p>}
          </div>

          {/* Divisor */}
          <div className="border-t border-slate-200 dark:border-navy-700" />

          {/* Seção: Senha */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              🔑 Redefinir senha
            </p>
            {!resetDone ? (
              <>
                <div className="flex items-center justify-between bg-slate-100 dark:bg-navy-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-navy-700">
                  <code className="text-sm font-mono font-bold text-navy-900 dark:text-white tracking-wider">{DEFAULT_SENHA}</code>
                  <span className="text-[10px] text-slate-400">senha padrão</span>
                </div>
                <Button size="sm" onClick={handleResetSenha} disabled={resetting} className="w-full">
                  {resetting ? 'Redefinindo...' : 'Redefinir para senha padrão'}
                </Button>
              </>
            ) : (
              <>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Senha redefinida! Envie as credenciais abaixo para o usuário.
                </div>
                <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-3 border border-slate-200 dark:border-navy-700 text-xs space-y-1">
                  <p className="text-slate-500">📧 <span className="font-medium text-navy-900 dark:text-white">{resetTarget?.email}</span></p>
                  <p className="text-slate-500">🔑 <span className="font-medium text-navy-900 dark:text-white">{DEFAULT_SENHA}</span></p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleCopySenha} className="w-full flex items-center justify-center gap-1.5">
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {copied ? 'Copiado!' : 'Copiar senha'}
                </Button>
              </>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={closeReset}>Fechar</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Usuário"
        description={`Excluir "${deleteTarget?.nome || deleteTarget?.email}" permanentemente? O acesso será removido e não poderá ser recuperado.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir'}
        confirmVariant="danger"
      />
    </div>
  )
}

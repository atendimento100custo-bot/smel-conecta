// src/pages/GerenciarAcesso.jsx
import { useState, useCallback } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { Search, Pencil, Link2, UserPlus } from 'lucide-react'

const CARGO_COLORS = {
  admin: 'purple',
  coordenador: 'blue',
  professor: 'green',
  estagiario: 'amber',
}

const CARGO_LABELS = {
  admin: 'Administrador',
  coordenador: 'Coordenador',
  professor: 'Professor',
  estagiario: 'Estagiário',
}

const EMPTY_FORM = { cargo: 'professor', ativo: true, telefone: '' }

export default function GerenciarAcesso() {
  const { profile, isAdmin } = useAuth()
  const { data: profiles, loading, reload } = useSupabaseData('profiles', '*')
  const { data: polos } = useSupabaseData('polos', 'id, nome')
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome), polos(nome)')

  const [search, setSearch] = useState('')

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Vinculos modal
  const [vinculosOpen, setVinculosOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [vinculos, setVinculos] = useState([])
  const [vinculosLoading, setVinculosLoading] = useState(false)
  const [toggling, setToggling] = useState(null)

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ nome: '', email: '', senha: '', cargo: 'professor', telefone: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

  // Role hierarchy
  function getAllowedCargos() {
    const cargo = profile?.cargo
    if (cargo === 'admin') return ['admin', 'coordenador', 'professor', 'estagiario']
    if (cargo === 'coordenador') return ['coordenador', 'professor', 'estagiario']
    if (cargo === 'professor') return ['professor', 'estagiario']
    return []
  }
  const allowedCargos = getAllowedCargos()
  const canCreateUsers = allowedCargos.length > 0

  // Filtered profiles
  const filtered = profiles.filter(p =>
    (p.nome || '').toLowerCase().includes(search.toLowerCase())
  )

  // Open edit modal
  function openEdit(profile) {
    setEditing(profile)
    setForm({
      cargo: profile.cargo ?? 'professor',
      ativo: profile.ativo ?? true,
      telefone: profile.telefone ?? '',
    })
    setEditOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ cargo: form.cargo, ativo: form.ativo, telefone: form.telefone })
      .eq('id', editing.id)
    setSaving(false)
    setEditOpen(false)
    reload()
  }

  // Open vinculos modal
  const openVinculos = useCallback(async (profile) => {
    setSelectedUser(profile)
    setVinculosOpen(true)
    setVinculos([])
    setVinculosLoading(true)

    if (profile.cargo === 'coordenador') {
      const { data } = await supabase
        .from('vinculos_usuario_polo')
        .select('polo_id')
        .eq('usuario_id', profile.id)
      setVinculos(data ?? [])
    } else if (profile.cargo === 'estagiario') {
      const { data } = await supabase
        .from('vinculos_estagiario_turma')
        .select('turma_id')
        .eq('estagiario_id', profile.id)
      setVinculos(data ?? [])
    }

    setVinculosLoading(false)
  }, [])

  async function togglePoloPolo(polo) {
    const jaVinculado = vinculos.some(v => v.polo_id === polo.id)
    setToggling(polo.id)
    if (jaVinculado) {
      await supabase
        .from('vinculos_usuario_polo')
        .delete()
        .eq('usuario_id', selectedUser.id)
        .eq('polo_id', polo.id)
      setVinculos(prev => prev.filter(v => v.polo_id !== polo.id))
    } else {
      await supabase
        .from('vinculos_usuario_polo')
        .insert({ usuario_id: selectedUser.id, polo_id: polo.id })
      setVinculos(prev => [...prev, { polo_id: polo.id }])
    }
    setToggling(null)
  }

  async function toggleTurma(turma) {
    const jaVinculado = vinculos.some(v => v.turma_id === turma.id)
    setToggling(turma.id)
    if (jaVinculado) {
      await supabase
        .from('vinculos_estagiario_turma')
        .delete()
        .eq('estagiario_id', selectedUser.id)
        .eq('turma_id', turma.id)
      setVinculos(prev => prev.filter(v => v.turma_id !== turma.id))
    } else {
      await supabase
        .from('vinculos_estagiario_turma')
        .insert({ estagiario_id: selectedUser.id, turma_id: turma.id })
      setVinculos(prev => [...prev, { turma_id: turma.id }])
    }
    setToggling(null)
  }

  // Create user handler — usa Admin API para não deslogar o admin atual
  async function handleCreate() {
    if (!createForm.nome || !createForm.email || !createForm.senha) return
    setCreating(true)
    setCreateError('')
    setCreateSuccess(false)

    if (!supabaseAdmin) {
      setCreateError('Configuração admin não disponível. Contate o administrador do sistema.')
      setCreating(false)
      return
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: createForm.email,
      password: createForm.senha,
      email_confirm: true,
    })

    if (error || !data.user) {
      setCreateError(
        error?.message?.includes('already been registered')
          ? 'Este e-mail já está cadastrado no sistema.'
          : (error?.message ?? 'Erro ao criar usuário')
      )
      setCreating(false)
      return
    }

    await supabase.from('profiles').upsert({
      id: data.user.id,
      nome: createForm.nome,
      cargo: createForm.cargo,
      telefone: createForm.telefone || null,
      ativo: true,
    }, { onConflict: 'id' })

    setCreating(false)
    setCreateSuccess(true)
    setTimeout(() => {
      setCreateOpen(false)
      setCreateSuccess(false)
      reload()
    }, 1500)
  }

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 text-sm bg-white dark:bg-navy-700 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Gerenciar Acesso"
        action={canCreateUsers ? (
          <Button
            size="sm"
            onClick={() => {
              setCreateForm({ nome: '', email: '', senha: '', cargo: allowedCargos[0], telefone: '' })
              setCreateError('')
              setCreateSuccess(false)
              setCreateOpen(true)
            }}
          >
            <UserPlus size={13} /> Criar Usuário
          </Button>
        ) : null}
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        {/* Search bar */}
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

        {/* Table */}
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="👤"
            title="Nenhum usuário encontrado"
            description={search ? 'Tente outro termo de busca.' : 'Nenhum perfil cadastrado ainda.'}
          />
        ) : (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-700/50">
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nome</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cargo</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Telefone</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile, idx) => (
                  <tr
                    key={profile.id}
                    className="border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50/60 dark:hover:bg-navy-700/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400">
                            {(profile.nome || profile.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-navy-900 dark:text-white leading-tight">
                            {profile.nome || <span className="italic text-slate-400">Sem nome</span>}
                          </p>
                          {profile.email && (
                            <p className="text-[10px] text-slate-400 leading-tight">{profile.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge color={CARGO_COLORS[profile.cargo] ?? 'gray'}>
                        {CARGO_LABELS[profile.cargo] ?? profile.cargo ?? '—'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-600 dark:text-slate-300">{profile.telefone || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge color={profile.ativo ? 'green' : 'gray'}>
                        {profile.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(profile)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                          title="Editar acesso"
                        >
                          <Pencil size={13} />
                        </button>
                        {(profile.cargo === 'coordenador' || profile.cargo === 'estagiario') && (
                          <button
                            onClick={() => openVinculos(profile)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-500 transition-colors"
                            title="Gerenciar vínculos"
                          >
                            <Link2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar Acesso"
      >
        <div className="space-y-4">
          {editing && (
            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-navy-700 rounded-lg px-3 py-2.5 border border-slate-100 dark:border-navy-600">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-700 dark:text-primary-400">
                  {(editing.nome || editing.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-navy-900 dark:text-white">{editing.nome || 'Sem nome'}</p>
                {editing.email && <p className="text-[10px] text-slate-400">{editing.email}</p>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Cargo</label>
            <select
              value={form.cargo}
              onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
              className={inputClass}
            >
              <option value="admin">Administrador</option>
              <option value="coordenador">Coordenador</option>
              <option value="professor">Professor</option>
              <option value="estagiario">Estagiário</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Telefone</label>
            <input
              type="tel"
              value={form.telefone}
              onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Status</label>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              className={`relative inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                form.ativo
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-navy-700 dark:border-navy-600 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${
                  form.ativo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-500'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    form.ativo ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
              {form.ativo ? 'Ativo' : 'Inativo'}
            </button>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal
        open={createOpen}
        onClose={() => { if (!creating) setCreateOpen(false) }}
        title="Criar Usuário"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Nome completo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={createForm.nome}
              onChange={e => setCreateForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Maria Oliveira"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              E-mail <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={createForm.email}
              onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@exemplo.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Senha <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={createForm.senha}
              onChange={e => setCreateForm(f => ({ ...f, senha: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Cargo <span className="text-red-400">*</span>
            </label>
            <select
              value={createForm.cargo}
              onChange={e => setCreateForm(f => ({ ...f, cargo: e.target.value }))}
              className={inputClass}
            >
              {allowedCargos.map(c => (
                <option key={c} value={c}>{CARGO_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Telefone <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="tel"
              value={createForm.telefone}
              onChange={e => setCreateForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>

          {createError && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {createError}
            </p>
          )}

          {createSuccess && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              Usuário criado com sucesso!
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !createForm.nome || !createForm.email || !createForm.senha}
            >
              {creating ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Vinculos Modal */}
      <Modal
        open={vinculosOpen}
        onClose={() => setVinculosOpen(false)}
        title={selectedUser ? `Vínculos · ${selectedUser.nome || selectedUser.email || 'Usuário'}` : 'Vínculos'}
        size="lg"
      >
        {vinculosLoading ? (
          <p className="text-sm text-slate-400 py-4">Carregando vínculos...</p>
        ) : selectedUser?.cargo === 'coordenador' ? (
          <div>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              Selecione os polos que este coordenador gerencia:
            </p>
            <div className="space-y-2">
              {polos.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum polo cadastrado.</p>
              ) : (
                polos.map(polo => {
                  const vinculado = vinculos.some(v => v.polo_id === polo.id)
                  const isToggling = toggling === polo.id
                  return (
                    <div
                      key={polo.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                        vinculado
                          ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                          : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-navy-700 dark:border-navy-600 dark:hover:bg-navy-600'
                      }`}
                    >
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{polo.nome}</span>
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => togglePoloPolo(polo)}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                          vinculado ? 'bg-blue-500' : 'bg-slate-300 dark:bg-navy-500'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            vinculado ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : selectedUser?.cargo === 'estagiario' ? (
          <div>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              Selecione as turmas que este estagiário acompanha:
            </p>
            <div className="space-y-2">
              {turmas.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma turma cadastrada.</p>
              ) : (
                turmas.map(turma => {
                  const vinculado = vinculos.some(v => v.turma_id === turma.id)
                  const isToggling = toggling === turma.id
                  return (
                    <div
                      key={turma.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                        vinculado
                          ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700'
                          : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-navy-700 dark:border-navy-600 dark:hover:bg-navy-600'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{turma.nome || `Turma ${turma.id}`}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {turma.modalidades?.nome && <span>{turma.modalidades.nome}</span>}
                          {turma.polos?.nome && <span> · {turma.polos.nome}</span>}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => toggleTurma(turma)}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                          vinculado ? 'bg-amber-500' : 'bg-slate-300 dark:bg-navy-500'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            vinculado ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-3xl mb-2">🔗</div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Sem vínculos manuais</p>
            <p className="text-xs text-slate-400">Este cargo não requer vínculos manuais.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

// src/pages/GerenciarAcesso.jsx
import { useState, useCallback } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { Search, Pencil, Link2, Info } from 'lucide-react'

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
  const { isAdmin } = useAuth()
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Gerenciar Acesso" />

      <div className="flex-1 overflow-y-auto p-5">
        {/* Info Banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
          <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-semibold">Criação de usuários:</span> Novos usuários devem ser criados diretamente pelo{' '}
            <span className="font-semibold">Supabase Dashboard</span> (Authentication → Users). Após o primeiro login, o perfil aparecerá aqui para configuração de cargo e vínculos.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Cargo</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Telefone</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile, idx) => (
                  <tr
                    key={profile.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? '' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-primary-700">
                            {(profile.nome || profile.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-navy-900 leading-tight">
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
                      <span className="text-xs text-slate-600">{profile.telefone || <span className="text-slate-300">—</span>}</span>
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
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Editar acesso"
                        >
                          <Pencil size={13} />
                        </button>
                        {(profile.cargo === 'coordenador' || profile.cargo === 'estagiario') && (
                          <button
                            onClick={() => openVinculos(profile)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-500 transition-colors"
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
            <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-700">
                  {(editing.nome || editing.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-navy-900">{editing.nome || 'Sem nome'}</p>
                {editing.email && <p className="text-[10px] text-slate-400">{editing.email}</p>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo</label>
            <select
              value={form.cargo}
              onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="admin">Administrador</option>
              <option value="coordenador">Coordenador</option>
              <option value="professor">Professor</option>
              <option value="estagiario">Estagiário</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone</label>
            <input
              type="tel"
              value={form.telefone}
              onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="(00) 00000-0000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Status</label>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              className={`relative inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                form.ativo
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span
                className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${
                  form.ativo ? 'bg-emerald-500' : 'bg-slate-300'
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
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-medium text-slate-700">{polo.nome}</span>
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => togglePoloPolo(polo)}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                          vinculado ? 'bg-blue-500' : 'bg-slate-300'
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
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-700">{turma.nome || `Turma ${turma.id}`}</p>
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
                          vinculado ? 'bg-amber-500' : 'bg-slate-300'
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
            <p className="text-sm font-semibold text-slate-600 mb-1">Sem vínculos manuais</p>
            <p className="text-xs text-slate-400">Este cargo não requer vínculos manuais.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

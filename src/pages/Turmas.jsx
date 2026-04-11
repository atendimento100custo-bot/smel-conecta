// src/pages/Turmas.jsx
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
import { Plus, Pencil, Trash2, Clock, Users } from 'lucide-react'

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']
const FAIXAS = ['Infantil','Adulto','Melhor Idade']
const EMPTY_FORM = { polo_id: '', modalidade_id: '', professor_id: '', faixa: 'Adulto', dias: [], horario: '', capacidade: 20, status: 'Ativa' }

export default function Turmas() {
  const { isAdmin, isCoordenador, isProfessor, profile } = useAuth()
  const canEdit = isAdmin || isCoordenador || isProfessor

  const { data: turmas, loading, reload } = useSupabaseData('turmas', '*, polos(nome), modalidades(nome,emoji), profiles(nome)')
  const { data: polos } = useSupabaseData('polos', 'id,nome')
  const { data: modalidades } = useSupabaseData('modalidades', 'id,nome,emoji')
  const { data: professores } = useSupabaseData('profiles', 'id,nome,cargo')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  function openNew() { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }
  function openEdit(t) {
    setForm({
      polo_id: t.polo_id ?? '',
      modalidade_id: t.modalidade_id ?? '',
      professor_id: t.professor_id ?? '',
      faixa: t.faixa,
      dias: t.dias ?? [],
      horario: t.horario ?? '',
      capacidade: t.capacidade,
      status: t.status,
    })
    setEditing(t)
    setModalOpen(true)
  }

  function toggleDia(d) {
    setForm(prev => ({
      ...prev,
      dias: prev.dias.includes(d) ? prev.dias.filter(x => x !== d) : [...prev.dias, d]
    }))
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      polo_id: form.polo_id || null,
      modalidade_id: form.modalidade_id || null,
      professor_id: form.professor_id || null,
      faixa: form.faixa,
      dias: form.dias,
      horario: form.horario || null,
      capacidade: Number(form.capacidade),
      status: form.status,
    }
    if (editing) {
      await supabase.from('turmas').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('turmas').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('turmas').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  const turmasFiltradas = isAdmin || isCoordenador
    ? turmas
    : turmas.filter(t => t.professor_id === profile?.id)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Turmas · ${turmasFiltradas.length}`}
        action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13}/> Nova Turma</Button>}
      />
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : turmasFiltradas.length === 0 ? (
          <EmptyState icon="📚" title="Nenhuma turma cadastrada"
            action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13}/> Nova Turma</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {turmasFiltradas.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.modalidades?.emoji ?? '📚'}</span>
                    <div>
                      <p className="text-xs font-bold text-navy-900">{t.modalidades?.nome ?? '—'}</p>
                      <p className="text-[10px] text-slate-400">{t.polos?.nome ?? 'Sem polo'}</p>
                    </div>
                  </div>
                  <Badge color={t.status === 'Ativa' ? 'green' : 'gray'}>{t.status}</Badge>
                </div>
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Clock size={10}/>{t.dias?.join(', ')} {t.horario ? `· ${t.horario.slice(0,5)}` : ''}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Users size={10}/>{t.profiles?.nome ?? '—'} · {t.faixa}
                  </div>
                  <div className="text-[10px] text-slate-400">Capacidade: {t.capacidade}</div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    {(isAdmin || isCoordenador) && (
                      <button onClick={() => setDeletando(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Turma' : 'Nova Turma'} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Polo</label>
              <select value={form.polo_id} onChange={e => setForm(f => ({ ...f, polo_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Sem polo</option>
                {polos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Modalidade</label>
              <select value={form.modalidade_id} onChange={e => setForm(f => ({ ...f, modalidade_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Selecionar</option>
                {modalidades.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Professor</label>
              <select value={form.professor_id} onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Selecionar</option>
                {professores.filter(p => ['professor','coordenador','admin'].includes(p.cargo)).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Faixa Etária</label>
              <select value={form.faixa} onChange={e => setForm(f => ({ ...f, faixa: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {FAIXAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Horário</label>
              <input type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Capacidade</label>
              <input type="number" min="1" value={form.capacidade} onChange={e => setForm(f => ({ ...f, capacidade: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Dias da semana</label>
            <div className="flex gap-1.5 flex-wrap">
              {DIAS.map(d => (
                <button key={d} type="button" onClick={() => toggleDia(d)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    form.dias.includes(d) ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>Ativa</option><option>Inativa</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletando} onClose={() => setDeletando(null)} onConfirm={handleDelete}
        title="Excluir Turma" description={`Excluir turma de "${deletando?.modalidades?.nome}"?`} />
    </div>
  )
}

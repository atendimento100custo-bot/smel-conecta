// src/pages/Modalidades.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Pencil, Trash2, Users, LayoutGrid, TrendingUp, MapPin, ChevronRight } from 'lucide-react'

const FAIXAS = ['Infantil', 'Adulto', 'Melhor Idade']
const EMPTY_FORM = { nome: '', categoria: '', emoji: '🏃', faixas: [], status: 'Ativo' }

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, colorClass }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 flex flex-col gap-1">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 ${colorClass}`}>
        <Icon size={14} className="text-white" />
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{value}</p>
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
    </div>
  )
}

// ─── Detalhe Modal ────────────────────────────────────────────────────────────
function DetalheModal({ modalidade, turmas, alunos, presencas, open, onClose }) {
  const navigate = useNavigate()
  if (!modalidade) return null

  // Turmas desta modalidade
  const turmasDaModal = turmas.filter(t => t.modalidade_id === modalidade.id || t.modalidades?.nome === modalidade.nome)
  const turmaIds = turmasDaModal.map(t => t.id)

  // Turmas ativas
  const turmasAtivas = turmasDaModal.filter(t => t.status === 'Ativa')

  // Alunos ativos nessa modalidade
  const alunosDaModal = alunos.filter(a => turmaIds.includes(a.turma_id) && a.status === 'Ativo')

  // Frequência média
  const presencasDaModal = presencas.filter(p => turmaIds.includes(p.turma_id))
  const freqMedia = presencasDaModal.length > 0
    ? Math.round((presencasDaModal.filter(p => p.presente).length / presencasDaModal.length) * 100)
    : 0

  // Polos distintos
  const polosDistintos = [...new Set(turmasDaModal.map(t => t.polos?.nome).filter(Boolean))]

  // Agrupar turmas por polo
  const turmasPorPolo = polosDistintos.reduce((acc, polo) => {
    acc[polo] = turmasDaModal.filter(t => t.polos?.nome === polo)
    return acc
  }, {})
  // Turmas sem polo definido
  const turmasSemPolo = turmasDaModal.filter(t => !t.polos?.nome)
  if (turmasSemPolo.length > 0) {
    turmasPorPolo['Sem polo'] = turmasSemPolo
  }

  const grupos = Object.entries(turmasPorPolo)

  return (
    <Modal open={open} onClose={onClose} title="" size="xl">
      {/* Header personalizado */}
      <div className="flex items-start gap-4 mb-6">
        <div className="text-5xl leading-none select-none">{modalidade.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{modalidade.nome}</h2>
            <Badge color={modalidade.status === 'Ativo' ? 'green' : 'gray'}>{modalidade.status}</Badge>
          </div>
          {modalidade.categoria && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{modalidade.categoria}</p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KpiCard icon={LayoutGrid} label="Turmas Ativas" value={turmasAtivas.length} colorClass="bg-primary-600" />
        <KpiCard icon={Users} label="Alunos Ativos" value={alunosDaModal.length} colorClass="bg-emerald-500" />
        <KpiCard icon={TrendingUp} label="Freq. Média" value={`${freqMedia}%`} colorClass="bg-amber-500" />
        <KpiCard icon={MapPin} label="Polos" value={polosDistintos.length} colorClass="bg-purple-500" />
      </div>


      {/* Turmas agrupadas por polo */}
      {grupos.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Turmas por Polo</p>
          <div className="space-y-4">
            {grupos.map(([polo, ts]) => (
              <div key={polo}>
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin size={11} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{polo}</span>
                </div>
                <div className="space-y-1.5 pl-4">
                  {ts.map(t => {
                    const nAlunos = alunos.filter(a => a.turma_id === t.id && a.status === 'Ativo').length
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-100 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {t.dias ?? '—'} {t.horario ? `· ${t.horario}` : ''}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {t.faixa && (
                                <span className="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-medium">
                                  {t.faixa}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500">
                                <Users size={9} className="inline mr-0.5" />{nAlunos} aluno{nAlunos !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge color={t.status === 'Ativa' ? 'green' : 'gray'}>{t.status ?? '—'}</Badge>
                          <button
                            onClick={() => { onClose(); navigate(`/alunos?turma_id=${t.id}`) }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-primary-600 hover:text-primary-700 transition-colors whitespace-nowrap"
                          >
                            Ver Alunos <ChevronRight size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400 text-center py-6">Nenhuma turma cadastrada para esta modalidade.</p>
      )}
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Modalidades() {
  const { isAdmin, isCoordenador } = useAuth()
  const canEdit = isAdmin || isCoordenador

  const { data: modalidades, loading, reload } = useSupabaseData('modalidades')
  const { data: turmas } = useSupabaseData('turmas', '*, polos(nome), modalidades(nome,emoji)')
  const { data: alunos } = useSupabaseData('alunos', 'id,status,turma_id')
  const { data: presencas } = useSupabaseData('presencas', 'id,presente,turma_id')

  // Detalhe
  const [detalhe, setDetalhe] = useState(null)

  // Editar / Novo
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletando, setDeletando] = useState(null)
  const [saving, setSaving] = useState(false)

  function openNew() { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }

  function openEdit(e, m) {
    e.stopPropagation()
    setForm({ nome: m.nome, categoria: m.categoria ?? '', emoji: m.emoji ?? '🏃', faixas: m.faixas ?? [], status: m.status })
    setEditing(m)
    setModalOpen(true)
  }

  function openDelete(e, m) {
    e.stopPropagation()
    setDeletando(m)
  }

  function toggleFaixa(f) {
    setForm(prev => ({
      ...prev,
      faixas: prev.faixas.includes(f) ? prev.faixas.filter(x => x !== f) : [...prev.faixas, f]
    }))
  }

  async function handleSave() {
    setSaving(true)
    const payload = { ...form }
    if (editing) {
      await supabase.from('modalidades').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('modalidades').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('modalidades').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  // Mini-estatísticas por card
  function statsForModal(m) {
    const ts = turmas.filter(t => t.modalidade_id === m.id || t.modalidades?.nome === m.nome)
    const tIds = ts.map(t => t.id)
    const turmasAtivas = ts.filter(t => t.status === 'Ativa').length
    const alunosAtivos = alunos.filter(a => tIds.includes(a.turma_id) && a.status === 'Ativo').length
    return { turmasAtivas, alunosAtivos }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Modalidades · ${modalidades.length}`}
        action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13}/> Nova Modalidade</Button>}
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : modalidades.length === 0 ? (
          <EmptyState icon="🎯" title="Nenhuma modalidade cadastrada"
            action={canEdit && <Button size="sm" onClick={openNew}><Plus size={13}/> Nova Modalidade</Button>} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {modalidades.map(m => {
              const { turmasAtivas, alunosAtivos } = statsForModal(m)
              return (
                <div
                  key={m.id}
                  onClick={() => setDetalhe(m)}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{m.emoji}</span>
                      <div>
                        <p className="text-xs font-bold text-navy-900 dark:text-white group-hover:text-primary-700 transition-colors">{m.nome}</p>
                        <p className="text-[10px] text-slate-400">{m.categoria}</p>
                      </div>
                    </div>
                    <Badge color={m.status === 'Ativo' ? 'green' : 'gray'}>{m.status}</Badge>
                  </div>

                  {/* Mini stats */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <LayoutGrid size={9} /> {turmasAtivas} turma{turmasAtivas !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Users size={9} /> {alunosAtivos} aluno{alunosAtivos !== 1 ? 's' : ''}
                    </span>
                  </div>


                  {canEdit && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => openEdit(e, m)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Pencil size={13}/>
                      </button>
                      <button
                        onClick={e => openDelete(e, m)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal de Detalhe ─────────────────────────────────────── */}
      <DetalheModal
        modalidade={detalhe}
        turmas={turmas}
        alunos={alunos}
        presencas={presencas}
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
      />

      {/* ── Modal Editar / Novo ──────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Modalidade' : 'Nova Modalidade'}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji</label>
              <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria</label>
            <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>Ativo</option><option>Inativo</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletando} onClose={() => setDeletando(null)} onConfirm={handleDelete}
        title="Excluir Modalidade" description={`Excluir "${deletando?.nome}"?`} />
    </div>
  )
}

// src/pages/Viagens.jsx
import { useState, useEffect, useCallback } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Trash2, Bus, Users, MapPin, Calendar, CheckCircle2, Circle, UserPlus, X } from 'lucide-react'

const EMPTY_FORM = { destino: '', data: '', polo_id: '', turma_id: '', vagas: 20, observacoes: '' }

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function Viagens() {
  const { isAdmin, isCoordenador } = useAuth()
  const canEdit = isAdmin || isCoordenador

  const { data: viagens, loading, reload } = useSupabaseData('viagens', '*, polos(nome), turmas(*, modalidades(nome))')
  const { data: polos } = useSupabaseData('polos', 'id, nome')
  const { data: turmas } = useSupabaseData('turmas', '*, modalidades(nome), polos(nome)')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletando, setDeletando] = useState(null)
  const [detalheViagem, setDetalheViagem] = useState(null)

  // Detail panel state
  const [participantes, setParticipantes] = useState([])
  const [alunosTurma, setAlunosTurma] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selectedAluno, setSelectedAluno] = useState('')
  const [addingAluno, setAddingAluno] = useState(false)

  function openNew() { setForm(EMPTY_FORM); setModalOpen(true) }

  async function handleSave() {
    if (!form.destino || !form.data) return
    setSaving(true)
    const payload = {
      destino: form.destino,
      data: form.data,
      polo_id: form.polo_id || null,
      turma_id: form.turma_id || null,
      vagas: Number(form.vagas),
      observacoes: form.observacoes || null,
    }
    await supabase.from('viagens').insert(payload)
    setSaving(false)
    setModalOpen(false)
    reload()
  }

  async function handleDelete() {
    await supabase.from('viagens').delete().eq('id', deletando.id)
    setDeletando(null)
    reload()
  }

  const loadDetail = useCallback(async (viagem) => {
    setLoadingDetail(true)
    setParticipantes([])
    setAlunosTurma([])
    setSelectedAluno('')

    const { data: parts } = await supabase
      .from('participantes_viagem')
      .select('*, alunos(id, nome)')
      .eq('viagem_id', viagem.id)

    setParticipantes(parts ?? [])

    if (viagem.turma_id) {
      const { data: alunos } = await supabase
        .from('alunos')
        .select('id, nome')
        .eq('turma_id', viagem.turma_id)
        .eq('status', 'Ativo')

      setAlunosTurma(alunos ?? [])
    }

    setLoadingDetail(false)
  }, [])

  function openDetail(viagem) {
    setDetalheViagem(viagem)
    loadDetail(viagem)
  }

  async function handleToggleConfirmado(p) {
    await supabase
      .from('participantes_viagem')
      .update({ confirmado: !p.confirmado })
      .eq('id', p.id)
    setParticipantes(prev =>
      prev.map(x => x.id === p.id ? { ...x, confirmado: !x.confirmado } : x)
    )
  }

  async function handleRemoveParticipante(p) {
    await supabase.from('participantes_viagem').delete().eq('id', p.id)
    setParticipantes(prev => prev.filter(x => x.id !== p.id))
  }

  async function handleAddAluno() {
    if (!selectedAluno) return
    setAddingAluno(true)
    const { data: inserted } = await supabase
      .from('participantes_viagem')
      .insert({ viagem_id: detalheViagem.id, aluno_id: selectedAluno, confirmado: false })
      .select('*, alunos(id, nome)')
      .single()

    if (inserted) {
      setParticipantes(prev => [...prev, inserted])
    }
    setSelectedAluno('')
    setAddingAluno(false)
  }

  const participanteIds = new Set(participantes.map(p => p.aluno_id))
  const alunosDisponiveis = alunosTurma.filter(a => !participanteIds.has(a.id))
  const confirmadosCount = participantes.filter(p => p.confirmado).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title={`Viagens · ${viagens.length}`}
        action={canEdit && (
          <Button size="sm" onClick={openNew}>
            <Plus size={13} /> Nova Viagem
          </Button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : viagens.length === 0 ? (
          <EmptyState
            icon="🚌"
            title="Nenhuma viagem cadastrada"
            description="Cadastre viagens e gerencie os participantes."
            action={canEdit && (
              <Button size="sm" onClick={openNew}>
                <Plus size={13} /> Nova Viagem
              </Button>
            )}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {viagens.map(v => {
              const confirmados = v.confirmados_count ?? 0
              return (
                <div
                  key={v.id}
                  onClick={() => openDetail(v)}
                  className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                        <Bus size={16} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-navy-900 leading-tight">{v.destino}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar size={10} className="text-slate-400" />
                          <p className="text-[10px] text-slate-400">{formatDate(v.data)}</p>
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeletando(v) }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {(v.polos?.nome || v.turmas?.modalidades?.nome) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                        <p className="text-[10px] text-slate-500">
                          {[v.polos?.nome, v.turmas?.modalidades?.nome].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users size={10} className="text-slate-400 flex-shrink-0" />
                      <p className="text-[10px] text-slate-500">
                        {participantes.length ?? 0} inscritos · {v.vagas} vagas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((participantes.length ?? 0) / v.vagas) * 100)}%` }}
                      />
                    </div>
                    <Badge color={confirmadosCount > 0 ? 'green' : 'gray'}>
                      {confirmadosCount} confirmados
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Nova Viagem Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Viagem" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Destino <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.destino}
              onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
              placeholder="Ex: Praia de Copacabana"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Data <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Polo</label>
              <select
                value={form.polo_id}
                onChange={e => setForm(f => ({ ...f, polo_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todos os polos</option>
                {polos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Turma (opcional)</label>
              <select
                value={form.turma_id}
                onChange={e => setForm(f => ({ ...f, turma_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sem turma</option>
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.modalidades?.nome ?? 'Turma'}{t.polos?.nome ? ` · ${t.polos.nome}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Vagas</label>
            <input
              type="number"
              min="1"
              value={form.vagas}
              onChange={e => setForm(f => ({ ...f, vagas: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={3}
              placeholder="Informações adicionais sobre a viagem..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !form.destino || !form.data}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={!!detalheViagem}
        onClose={() => setDetalheViagem(null)}
        title={detalheViagem ? `${detalheViagem.destino} · ${formatDate(detalheViagem.data)}` : ''}
        size="lg"
      >
        {detalheViagem && (
          <div className="flex gap-5">
            {/* Left: Viagem Info */}
            <div className="w-56 flex-shrink-0 space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Informações</p>
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">Destino</p>
                      <p className="text-xs font-semibold text-navy-900">{detalheViagem.destino}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">Data</p>
                      <p className="text-xs font-semibold text-navy-900">{formatDate(detalheViagem.data)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bus size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">Vagas</p>
                      <p className="text-xs font-semibold text-navy-900">{participantes.length} / {detalheViagem.vagas}</p>
                    </div>
                  </div>
                  {detalheViagem.polos?.nome && (
                    <div>
                      <p className="text-[10px] text-slate-400">Polo</p>
                      <p className="text-xs font-semibold text-navy-900">{detalheViagem.polos.nome}</p>
                    </div>
                  )}
                  {detalheViagem.turmas?.modalidades?.nome && (
                    <div>
                      <p className="text-[10px] text-slate-400">Turma</p>
                      <p className="text-xs font-semibold text-navy-900">{detalheViagem.turmas.modalidades.nome}</p>
                    </div>
                  )}
                </div>
              </div>

              {detalheViagem.observacoes && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Observações</p>
                  <p className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    {detalheViagem.observacoes}
                  </p>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
                  <span>Confirmados</span>
                  <span className="font-semibold text-emerald-600">{confirmadosCount}</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (confirmadosCount / Math.max(participantes.length, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Participants */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Participantes ({participantes.length})
              </p>

              {loadingDetail ? (
                <p className="text-sm text-slate-400 py-4 text-center">Carregando...</p>
              ) : (
                <>
                  {participantes.length === 0 ? (
                    <div className="text-center py-6">
                      <Users size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Nenhum participante ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto pr-1">
                      {participantes.map(p => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 group"
                        >
                          <button
                            onClick={() => handleToggleConfirmado(p)}
                            className="flex-shrink-0 transition-colors"
                            title={p.confirmado ? 'Remover confirmação' : 'Confirmar presença'}
                          >
                            {p.confirmado
                              ? <CheckCircle2 size={16} className="text-emerald-500" />
                              : <Circle size={16} className="text-slate-300 hover:text-slate-400" />
                            }
                          </button>
                          <span className="text-xs flex-1 truncate text-navy-900">
                            {p.alunos?.nome ?? '—'}
                          </span>
                          {p.confirmado && (
                            <Badge color="green">Confirmado</Badge>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleRemoveParticipante(p)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add participant */}
                  {canEdit && detalheViagem.turma_id && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Adicionar aluno
                      </p>
                      {alunosDisponiveis.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">
                          Todos os alunos ativos da turma já foram adicionados.
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            value={selectedAluno}
                            onChange={e => setSelectedAluno(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Selecionar aluno...</option>
                            {alunosDisponiveis.map(a => (
                              <option key={a.id} value={a.id}>{a.nome}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={handleAddAluno}
                            disabled={!selectedAluno || addingAluno}
                          >
                            <UserPlus size={13} />
                            {addingAluno ? 'Adicionando...' : 'Adicionar'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {canEdit && !detalheViagem.turma_id && (
                    <p className="text-[11px] text-slate-400 italic mt-2">
                      Associe uma turma à viagem para gerenciar participantes elegíveis.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletando}
        onClose={() => setDeletando(null)}
        onConfirm={handleDelete}
        title="Excluir Viagem"
        description={`Deseja excluir a viagem para "${deletando?.destino}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}

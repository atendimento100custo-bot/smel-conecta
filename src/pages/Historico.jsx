// src/pages/Historico.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSupabaseData } from '../hooks/useSupabaseData'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'
import { Trash2, Copy, Check, Filter, X, ClipboardList, UserPlus, AlertTriangle } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── SQL para criar a tabela ──────────────────────────────────────────────────
const SETUP_SQL = `-- Cole este SQL no Supabase → SQL Editor e execute uma única vez
create table if not exists historico_acoes (
  id              uuid        default gen_random_uuid() primary key,
  acao            text        not null,
  usuario_id      uuid,
  usuario_nome    text,
  polo_id         uuid,
  polo_nome       text,
  modalidade_nome text,
  turma_id        uuid,
  turma_info      text,
  aluno_id        uuid,
  aluno_nome      text,
  detalhes        text,
  created_at      timestamptz default now()
);

alter table historico_acoes enable row level security;

create policy "authenticated insert"
  on historico_acoes for insert to authenticated with check (true);

create policy "authenticated select"
  on historico_acoes for select to authenticated using (true);

create policy "authenticated delete"
  on historico_acoes for delete to authenticated using (true);`

// ─── helpers ──────────────────────────────────────────────────────────────────
const ACAO_META = {
  cadastro_aluno:    { label: 'Cadastro de Aluno',      icon: <UserPlus  size={13} />, bg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  registro_presenca: { label: 'Registro de Presença',   icon: <ClipboardList size={13} />, bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
}

const LIMPAR_OPCOES = [
  { label: 'Mais de 30 dias', days: 30 },
  { label: 'Mais de 3 meses', days: 90 },
  { label: 'Mais de 6 meses', days: 180 },
  { label: 'Mais de 1 ano',   days: 365 },
]

function fmtTs(ts) {
  if (!ts) return '—'
  try {
    return format(new Date(ts), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch { return ts }
}

function AcaoBadge({ acao }) {
  const meta = ACAO_META[acao] ?? { label: acao, icon: null, bg: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.bg}`}>
      {meta.icon}{meta.label}
    </span>
  )
}

// ─── Setup banner ─────────────────────────────────────────────────────────────
function SetupBanner() {
  const [copied, setCopied] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(SETUP_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Tabela de histórico não encontrada</p>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Para ativar o histórico de ações, execute o SQL abaixo no <strong>Supabase → SQL Editor</strong> uma única vez.
        Após criar a tabela, os logs passarão a ser registrados automaticamente.
      </p>
      <div className="relative">
        <pre className="bg-slate-900 text-emerald-400 text-[10px] rounded-lg p-4 overflow-x-auto leading-relaxed">
          {SETUP_SQL}
        </pre>
        <button
          onClick={copiar}
          className="absolute top-2 right-2 flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
        >
          {copied ? <><Check size={11} /> Copiado!</> : <><Copy size={11} /> Copiar SQL</>}
        </button>
      </div>
    </div>
  )
}

// ─── Confirm limpar ───────────────────────────────────────────────────────────
function ConfirmLimpar({ onConfirm, onClose, limpando }) {
  const [dias, setDias] = useState(90)
  const corte = format(subDays(new Date(), dias), 'dd/MM/yyyy')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-navy-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-900 dark:text-white">Limpar Histórico Antigo</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-700">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Remove apenas os <strong>logs de auditoria</strong> — os dados reais (alunos, presenças) são preservados.
        </p>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Apagar registros de</label>
          <div className="space-y-1.5">
            {LIMPAR_OPCOES.map(o => (
              <label key={o.days} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dias"
                  value={o.days}
                  checked={dias === o.days}
                  onChange={() => setDias(o.days)}
                  className="accent-primary-600"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          ⚠️ Serão apagados todos os logs anteriores a {corte}. Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="flex-1" onClick={onClose} disabled={limpando}>Cancelar</Button>
          <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => onConfirm(dias)} disabled={limpando}>
            {limpando ? 'Limpando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Historico() {
  const { data: polos } = useSupabaseData('polos', 'id,nome')

  const [registros, setRegistros]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [tableError, setTableError]   = useState(false)

  // Filtros
  const [filtroPolo,       setFiltroPolo]       = useState('')
  const [filtroModalidade, setFiltroModalidade] = useState('')
  const [filtroAcao,       setFiltroAcao]       = useState('')
  const [filtroDataDe,     setFiltroDataDe]     = useState('')
  const [filtroDataAte,    setFiltroDataAte]    = useState('')

  // Limpar
  const [limparOpen, setLimparOpen] = useState(false)
  const [limpando,   setLimpando]   = useState(false)

  // Modalidades derivadas dos registros carregados
  const [modalidades, setModalidades] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('historico_acoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (filtroPolo)       q = q.eq('polo_id', filtroPolo)
    if (filtroModalidade) q = q.eq('modalidade_nome', filtroModalidade)
    if (filtroAcao)       q = q.eq('acao', filtroAcao)
    if (filtroDataDe)     q = q.gte('created_at', filtroDataDe + 'T00:00:00')
    if (filtroDataAte)    q = q.lte('created_at', filtroDataAte + 'T23:59:59')

    const { data, error } = await q

    if (error) {
      const isNotFound =
        error.code === '42P01' ||
        error.code === 'PGRST116' ||
        (error.message ?? '').toLowerCase().includes('does not exist') ||
        (error.message ?? '').toLowerCase().includes('não existe')
      setTableError(isNotFound)
      setLoading(false)
      return
    }

    setTableError(false)
    const rows = data ?? []
    setRegistros(rows)
    // Extrai modalidades únicas para filtro
    setModalidades([...new Set(rows.map(r => r.modalidade_nome).filter(Boolean))].sort())
    setLoading(false)
  }, [filtroPolo, filtroModalidade, filtroAcao, filtroDataDe, filtroDataAte])

  useEffect(() => { load() }, [load])

  async function handleLimpar(dias) {
    setLimpando(true)
    const cutoff = subDays(new Date(), dias).toISOString()
    await supabase.from('historico_acoes').delete().lt('created_at', cutoff)
    setLimpando(false)
    setLimparOpen(false)
    load()
  }

  const temFiltro = filtroPolo || filtroModalidade || filtroAcao || filtroDataDe || filtroDataAte
  function limparFiltros() {
    setFiltroPolo(''); setFiltroModalidade(''); setFiltroAcao('')
    setFiltroDataDe(''); setFiltroDataAte('')
  }

  const inputCls = 'text-xs border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 text-navy-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Histórico de Ações"
        action={
          !tableError && (
            <Button size="sm" variant="secondary" onClick={() => setLimparOpen(true)}>
              <Trash2 size={13} /> Limpar antigos
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">

        {/* Setup banner */}
        {tableError && <SetupBanner />}

        {!tableError && (
          <>
            {/* Filtros */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Filter size={12} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Filtros</span>
                {temFiltro && (
                  <button onClick={limparFiltros} className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X size={10} /> Limpar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <select value={filtroPolo} onChange={e => setFiltroPolo(e.target.value)} className={inputCls}>
                  <option value="">Todos os polos</option>
                  {polos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>

                <select value={filtroModalidade} onChange={e => setFiltroModalidade(e.target.value)} className={inputCls}>
                  <option value="">Todas as modalidades</option>
                  {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)} className={inputCls}>
                  <option value="">Todas as ações</option>
                  <option value="cadastro_aluno">Cadastro de Aluno</option>
                  <option value="registro_presenca">Registro de Presença</option>
                </select>

                <input type="date" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)}
                  className={inputCls} title="De" />
                <input type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)}
                  className={inputCls} title="Até" />
              </div>
            </div>

            {/* Tabela */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700 flex items-center justify-between">
                <p className="text-xs font-bold text-navy-900 dark:text-white">
                  {loading ? 'Carregando…' : `${registros.length} registro${registros.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {loading ? (
                <div className="p-10 text-center text-sm text-slate-400">Carregando…</div>
              ) : registros.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="text-2xl">📋</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {temFiltro ? 'Nenhum registro para os filtros selecionados.' : 'Nenhuma ação registrada ainda.'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Os logs aparecerão aqui conforme os usuários cadastrarem alunos e registrarem presenças.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-navy-900/50 border-b border-slate-100 dark:border-navy-700">
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-36">Quando</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-32">Quem</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-36">Ação</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Onde</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Detalhe / Alvo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                        {registros.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-navy-700/40 transition-colors">
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtTs(r.created_at)}</td>
                            <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">{r.usuario_nome ?? '—'}</td>
                            <td className="px-4 py-3"><AcaoBadge acao={r.acao} /></td>
                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                {r.polo_nome && (
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                    📍 {r.polo_nome}
                                  </p>
                                )}
                                {r.turma_info && (
                                  <p className="font-medium text-navy-900 dark:text-white">{r.turma_info}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              {r.aluno_nome
                                ? <span className="font-medium text-navy-900 dark:text-white">👤 {r.aluno_nome}</span>
                                : r.detalhes ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-navy-700">
                    {registros.map(r => (
                      <div key={r.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <AcaoBadge acao={r.acao} />
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{fmtTs(r.created_at)}</span>
                        </div>
                        <p className="text-xs font-semibold text-navy-900 dark:text-white">{r.usuario_nome ?? '—'}</p>
                        {r.polo_nome && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">📍 {r.polo_nome}</p>
                        )}
                        {r.turma_info && (
                          <p className="text-xs text-navy-900 dark:text-white">{r.turma_info}</p>
                        )}
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {r.aluno_nome ? `👤 ${r.aluno_nome}` : (r.detalhes ?? '')}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {limparOpen && (
        <ConfirmLimpar
          onConfirm={handleLimpar}
          onClose={() => setLimparOpen(false)}
          limpando={limpando}
        />
      )}
    </div>
  )
}

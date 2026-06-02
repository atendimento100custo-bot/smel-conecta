// src/pages/Infra.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  Database, Users, Server, ExternalLink, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, Activity, Table2,
  HardDrive, Globe
} from 'lucide-react'

const SUPABASE_LIMITS = {
  db_size_bytes: 524_288_000,       // 500 MB
  auth_users: 50_000,               // 50k MAU
  bandwidth_gb: 2,                  // 2 GB/mês
  storage_gb: 1,                    // 1 GB
}

const VERCEL_LIMITS = {
  bandwidth_gb: 100,                // 100 GB/mês
  build_hours: 100,                 // 100h/mês
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function pct(value, limit) {
  return Math.min(100, Math.round((value / limit) * 100))
}

function StatusIcon({ p }) {
  if (p >= 90) return <XCircle className="w-5 h-5 text-red-500" />
  if (p >= 70) return <AlertTriangle className="w-5 h-5 text-amber-500" />
  return <CheckCircle className="w-5 h-5 text-emerald-500" />
}

function BarRow({ label, value, limit, formatValue, formatLimit, icon: Icon }) {
  const p = pct(value, limit)
  const barColor = p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
  const textColor = p >= 90 ? 'text-red-600' : p >= 70 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          {Icon && <Icon className="w-4 h-4 opacity-60" />}
          {label}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${textColor}`}>{p}%</span>
          <StatusIcon p={p} />
        </div>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
        <div className={`${barColor} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${p}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
        <span>{formatValue(value)}</span>
        <span>limite: {formatLimit(limit)}</span>
      </div>
    </div>
  )
}

function Card({ title, icon: Icon, children, accent }) {
  const border = accent === 'green' ? 'border-emerald-400' : accent === 'blue' ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'
  return (
    <div className={`bg-white dark:bg-navy-800 rounded-xl shadow-sm border-l-4 ${border} p-5 mb-4`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-5 h-5 text-slate-500" />}
        <h2 className="text-base font-semibold text-slate-800 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function CountGrid({ counts }) {
  const labels = {
    alunos: '🧑 Alunos',
    turmas: '📋 Turmas',
    polos: '📍 Polos',
    profiles: '👤 Funcionários',
    presencas: '✅ Presenças',
    atestados: '📄 Atestados',
    viagens: '🚌 Viagens',
    auth_users: '🔑 Usuários auth',
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Object.entries(counts).map(([k, v]) => (
        <div key={k} className="bg-slate-50 dark:bg-navy-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-slate-800 dark:text-white">{Number(v).toLocaleString('pt-BR')}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{labels[k] ?? k}</div>
        </div>
      ))}
    </div>
  )
}

function TableSizes({ sizes }) {
  const sorted = Object.entries(sizes)
    .map(([name, bytes]) => ({ name, bytes: Number(bytes) }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)
  const max = sorted[0]?.bytes ?? 1

  return (
    <div className="space-y-2">
      {sorted.map(({ name, bytes }) => (
        <div key={name} className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-600 dark:text-slate-300 w-40 truncate">{name}</span>
          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
            <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(bytes / max) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 w-16 text-right">{formatBytes(bytes)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Infra() {
  const { isAdmin } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_infra_metrics')
    if (err) { setError(err.message); setLoading(false); return }
    setMetrics(data)
    setLastUpdate(new Date())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      Acesso restrito a administradores.
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            Infraestrutura
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Monitoramento dos limites do plano gratuito
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">
          Erro ao carregar métricas: {error}
        </div>
      )}

      {loading && !metrics && (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Carregando métricas...
        </div>
      )}

      {metrics && (
        <>
          {/* ── SUPABASE ─────────────────────────────────────── */}
          <Card title="Supabase — Plano Free ($0/mês)" icon={Database} accent="green">
            <BarRow
              label="Banco de dados"
              icon={HardDrive}
              value={Number(metrics.db_size_bytes)}
              limit={SUPABASE_LIMITS.db_size_bytes}
              formatValue={formatBytes}
              formatLimit={formatBytes}
            />
            <BarRow
              label="Usuários autenticados (MAU)"
              icon={Users}
              value={Number(metrics.counts.auth_users)}
              limit={SUPABASE_LIMITS.auth_users}
              formatValue={v => v.toLocaleString('pt-BR')}
              formatLimit={v => v.toLocaleString('pt-BR')}
            />

            {/* Bandwidth e Storage — só via dashboard */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://supabase.com/dashboard/project/pgkyvgmlfmgptxyhovqk/reports"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-slate-50 dark:bg-navy-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 hover:bg-slate-100 dark:hover:bg-navy-600 transition-colors"
              >
                <Globe className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Bandwidth</div>
                  <div className="text-xs text-slate-500">Limite: 2 GB/mês · Ver no dashboard →</div>
                </div>
              </a>
              <a
                href="https://supabase.com/dashboard/project/pgkyvgmlfmgptxyhovqk/storage"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-slate-50 dark:bg-navy-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 hover:bg-slate-100 dark:hover:bg-navy-600 transition-colors"
              >
                <Server className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Storage</div>
                  <div className="text-xs text-slate-500">Limite: 1 GB · Ver no dashboard →</div>
                </div>
              </a>
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <a
                href="https://supabase.com/dashboard/project/pgkyvgmlfmgptxyhovqk/reports"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir Supabase Dashboard
              </a>
            </div>
          </Card>

          {/* ── VERCEL ───────────────────────────────────────── */}
          <Card title="Vercel — Plano Free ($0/mês)" icon={Globe} accent="blue">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <a
                href="https://vercel.com/atendimento100custo-9900s-projects/smel-conecta/analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-slate-50 dark:bg-navy-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 hover:bg-slate-100 dark:hover:bg-navy-600 transition-colors"
              >
                <Globe className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Bandwidth</div>
                  <div className="text-xs text-slate-500">Limite: 100 GB/mês · Ver no dashboard →</div>
                </div>
              </a>
              <a
                href="https://vercel.com/atendimento100custo-9900s-projects/smel-conecta/deployments"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-slate-50 dark:bg-navy-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 hover:bg-slate-100 dark:hover:bg-navy-600 transition-colors"
              >
                <Activity className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Deploys</div>
                  <div className="text-xs text-slate-500">Ilimitado no free · Ver histórico →</div>
                </div>
              </a>
            </div>
            <a
              href="https://vercel.com/atendimento100custo-9900s-projects/smel-conecta"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Abrir Vercel Dashboard
            </a>
          </Card>

          {/* ── DADOS DO SISTEMA ─────────────────────────────── */}
          <Card title="Registros do sistema" icon={Table2}>
            <CountGrid counts={metrics.counts} />

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Tamanho por tabela (top 10)
              </div>
              <TableSizes sizes={metrics.table_sizes} />
            </div>
          </Card>

          {/* ── POSTGREST ────────────────────────────────────── */}
          <Card title="Configuração PostgREST" icon={Server}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-navy-700 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {Number(metrics.max_rows_config).toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">max_rows atual</div>
              </div>
              <div className="bg-slate-50 dark:bg-navy-700 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {Number(metrics.counts.alunos).toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">alunos no sistema</div>
              </div>
              <div className="bg-slate-50 dark:bg-navy-700 rounded-lg p-3 text-center">
                <div className={`text-xl font-bold ${Number(metrics.counts.alunos) / Number(metrics.max_rows_config) > 0.7 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {Math.round((Number(metrics.counts.alunos) / Number(metrics.max_rows_config)) * 100)}%
                </div>
                <div className="text-xs text-slate-500 mt-0.5">uso do limite</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
              Quando alunos passar de 7.000, aumentar max_rows no painel do Supabase em API → Settings.
            </p>
          </Card>

          {/* ── ALERTAS ──────────────────────────────────────── */}
          {(() => {
            const dbPct = pct(Number(metrics.db_size_bytes), SUPABASE_LIMITS.db_size_bytes)
            const mauPct = pct(Number(metrics.counts.auth_users), SUPABASE_LIMITS.auth_users)
            const alerts = []
            if (dbPct >= 70) alerts.push({ level: dbPct >= 90 ? 'error' : 'warn', msg: `Banco de dados em ${dbPct}% — considere limpar dados antigos ou migrar para plano pago.` })
            if (mauPct >= 70) alerts.push({ level: mauPct >= 90 ? 'error' : 'warn', msg: `Usuários autenticados em ${mauPct}% do limite de 50.000.` })
            if (!alerts.length) return (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mt-2">
                <CheckCircle className="w-4 h-4" />
                Tudo dentro dos limites do plano gratuito. Nenhuma ação necessária.
              </div>
            )
            return alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 text-sm p-3 rounded-lg mt-2 ${a.level === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {a.msg}
              </div>
            ))
          })()}

          {lastUpdate && (
            <p className="text-xs text-slate-400 text-center mt-4">
              Atualizado em {lastUpdate.toLocaleString('pt-BR')}
            </p>
          )}
        </>
      )}
    </div>
  )
}

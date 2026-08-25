// src/pages/PermissoesAcesso.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePermissoesTela, TELAS_CONFIGURAVEIS, DEFAULTS } from '../contexts/PermissoesContext'
import Topbar from '../components/Topbar'
import { Check, X, Lock } from 'lucide-react'

const CARGOS = [
  { id: 'estagiario',  label: 'Estagiário' },
  { id: 'professor',   label: 'Professor' },
  { id: 'coordenador', label: 'Coordenador' },
]

export default function PermissoesAcesso() {
  const { overrides, reload, loading } = usePermissoesTela()
  const [saving, setSaving] = useState(null) // `${tela}-${cargo}` em andamento

  function valorAtual(tela, cargo) {
    const over = overrides[tela]?.[cargo]
    if (over !== undefined) return over
    return DEFAULTS[tela]?.[cargo] ?? false
  }

  async function toggle(tela, cargo) {
    const key = `${tela}-${cargo}`
    const atual = valorAtual(tela, cargo)
    setSaving(key)
    await supabase.from('permissoes_tela').upsert({ tela, cargo, habilitado: !atual }, { onConflict: 'tela,cargo' })
    await reload()
    setSaving(null)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Permissões de Acesso" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <Lock size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            Escolha quais telas cada cargo enxerga no menu. Telas de administração
            (Supervisão, Acessos, Histórico, Infraestrutura e esta própria tela)
            ficam sempre restritas ao admin — não aparecem aqui e nunca podem ser desligadas.
          </span>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-900/40 border-b border-slate-100 dark:border-navy-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Tela</th>
                  {CARGOS.map(c => (
                    <th key={c.id} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {TELAS_CONFIGURAVEIS.map(({ tela, label }) => (
                  <tr key={tela}>
                    <td className="px-4 py-3 text-xs font-semibold text-navy-900 dark:text-white whitespace-nowrap">{label}</td>
                    {CARGOS.map(c => {
                      const habilitado = valorAtual(tela, c.id)
                      const key = `${tela}-${c.id}`
                      return (
                        <td key={c.id} className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggle(tela, c.id)}
                            disabled={saving === key || loading}
                            title={habilitado ? 'Clique para ocultar' : 'Clique para liberar'}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40 ${
                              habilitado
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                : 'bg-slate-100 dark:bg-navy-700 text-slate-300 dark:text-slate-600 hover:bg-slate-200 dark:hover:bg-navy-600'
                            }`}
                          >
                            {habilitado ? <Check size={15} /> : <X size={15} />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

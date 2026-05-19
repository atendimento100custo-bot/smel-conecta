// src/pages/Configuracoes.jsx
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import Button from '../components/ui/Button'

export default function Configuracoes() {
  const { profile } = useAuth()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showNova, setShowNova] = useState(false)
  const [showConfirma, setShowConfirma] = useState(false)

  async function handleSenha(e) {
    e.preventDefault()
    if (novaSenha !== confirmaSenha) {
      setMsg({ type: 'error', text: 'As senhas não coincidem.' })
      return
    }
    if (novaSenha.length < 6) {
      setMsg({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: 'Senha alterada com sucesso!' })
      setNovaSenha('')
      setConfirmaSenha('')
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

  const INFO = [
    ['Sistema', 'SMEL Conecta'],
    ['Versão', '1.0.0'],
    ['Prefeitura', 'Volta Redonda / RJ'],
    ['Secretaria', 'SMEL — Secretaria Municipal de Esportes e Lazer'],
    ['Usuário logado', profile?.nome ?? '—'],
    ['Cargo', profile?.cargo ?? '—'],
  ]

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Configurações" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 max-w-lg">

        {/* Alterar Senha */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-bold text-navy-900 mb-4">Alterar Senha</p>
          <form onSubmit={handleSenha} className="space-y-3">
            <div>
              <label className={labelCls}>Nova Senha</label>
              <div className="relative">
                <input
                  type={showNova ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  required
                  minLength={6}
                  className={`${inputCls} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNova(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showNova ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Confirmar Senha</label>
              <div className="relative">
                <input
                  type={showConfirma ? 'text' : 'password'}
                  value={confirmaSenha}
                  onChange={e => setConfirmaSenha(e.target.value)}
                  required
                  className={`${inputCls} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirma(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirma ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {msg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {msg.text}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Alterar Senha'}
            </Button>
          </form>
        </div>

        {/* Sobre */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-bold text-navy-900 mb-3">Sobre o Sistema</p>
          <dl className="space-y-2 text-xs">
            {INFO.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-slate-400 w-28 flex-shrink-0">{k}</dt>
                <dd className="font-medium text-navy-900 capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

      </div>
    </div>
  )
}

// src/pages/Configuracoes.jsx
import { useState } from 'react'
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
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                required
                minLength={6}
                className={inputCls}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className={labelCls}>Confirmar Senha</label>
              <input
                type="password"
                value={confirmaSenha}
                onChange={e => setConfirmaSenha(e.target.value)}
                required
                className={inputCls}
                placeholder="••••••••"
              />
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

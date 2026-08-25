// supabase/functions/admin-users/index.ts
//
// Substitui o uso de supabaseAdmin (service role) diretamente no navegador.
// A service role key nunca sai do servidor — só existe aqui, como secret
// da função. O frontend chama isto via supabase.functions.invoke('admin-users', ...)
// autenticado com o próprio login do usuário.
//
// Além de esconder a chave, esta função IMPÕE uma regra que hoje não existe
// em lugar nenhum: um coordenador não pode criar/editar um admin, nem outro
// coordenador virar admin por acidente — cada cargo só gerencia os cargos
// abaixo dele. Isso é verificado aqui, no servidor, não no botão da tela.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CARGO_TIERS: Record<string, string[]> = {
  admin: ['admin', 'coordenador', 'professor', 'estagiario'],
  coordenador: ['coordenador', 'professor', 'estagiario'],
  professor: ['professor', 'estagiario'],
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, n => chars[n % chars.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente do chamador — só pra confirmar quem está logado, via o próprio JWT dele.
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: callerUser }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !callerUser) return json({ error: 'Não autenticado.' })

    // Cliente com service role — só existe aqui dentro, nunca no navegador.
    const admin = createClient(url, serviceKey)

    const { data: callerProfile } = await admin.from('profiles').select('cargo').eq('id', callerUser.id).single()
    const callerCargo = callerProfile?.cargo as string | undefined
    const allowedTargets = CARGO_TIERS[callerCargo ?? ''] ?? []
    if (!allowedTargets.length) return json({ error: 'Sem permissão para gerenciar usuários.' })

    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { nome, email, senha, cargo, telefone } = body
      if (!nome || !email || !cargo) return json({ error: 'Nome, e-mail e cargo são obrigatórios.' })
      if (!allowedTargets.includes(cargo)) return json({ error: `Você não tem permissão para criar um usuário com cargo "${cargo}".` })

      const senhaFinal = senha || randomPassword()
      const { data, error } = await admin.auth.admin.createUser({
        email, password: senhaFinal, email_confirm: true, user_metadata: { nome },
      })
      if (error || !data?.user) {
        const msg = error?.message?.includes('already been registered')
          ? 'Este e-mail já está cadastrado.'
          : (error?.message ?? 'Erro ao criar usuário')
        return json({ error: msg })
      }
      await admin.from('profiles').upsert({ id: data.user.id, nome, cargo, telefone: telefone || null, email })
      return json({ userId: data.user.id, senhaGerada: senha ? null : senhaFinal })
    }

    if (['update_profile', 'update_email', 'reset_password', 'delete'].includes(action)) {
      const { targetId } = body
      if (!targetId) return json({ error: 'targetId é obrigatório.' })

      const { data: targetProfile } = await admin.from('profiles').select('cargo').eq('id', targetId).single()
      const targetCargoAtual = targetProfile?.cargo as string | undefined

      // Quem não é admin só mexe em alvos cujo cargo atual esteja no seu teto
      // (impede coordenador de editar/apagar admin ou outro coordenador).
      if (callerCargo !== 'admin') {
        if (!targetCargoAtual || !allowedTargets.includes(targetCargoAtual)) {
          return json({ error: 'Você não tem permissão para gerenciar este usuário.' })
        }
      }

      if (action === 'update_profile') {
        const { nome, cargo, telefone, email } = body
        if (cargo && !allowedTargets.includes(cargo)) {
          return json({ error: `Você não tem permissão para definir o cargo "${cargo}".` })
        }
        const patch: Record<string, unknown> = {}
        if (nome !== undefined) patch.nome = nome
        if (cargo !== undefined) patch.cargo = cargo
        if (telefone !== undefined) patch.telefone = telefone || null
        if (email !== undefined) patch.email = email || null
        if (Object.keys(patch).length) await admin.from('profiles').update(patch).eq('id', targetId)
        if (email) {
          const { error } = await admin.auth.admin.updateUserById(targetId, { email })
          if (error) return json({ error: error.message })
        }
        return json({ ok: true })
      }

      if (action === 'update_email') {
        const { email } = body
        if (!email) return json({ error: 'E-mail é obrigatório.' })
        const { error } = await admin.auth.admin.updateUserById(targetId, { email })
        if (error) return json({ error: error.message })
        await admin.from('profiles').update({ email }).eq('id', targetId)
        return json({ ok: true })
      }

      if (action === 'reset_password') {
        const novaSenha = randomPassword()
        const { error } = await admin.auth.admin.updateUserById(targetId, { password: novaSenha })
        if (error) return json({ error: error.message })
        return json({ senhaGerada: novaSenha })
      }

      if (action === 'delete') {
        await admin.from('atribuicoes').delete().eq('usuario_id', targetId)
        await admin.from('turmas').update({ professor_id: null }).eq('professor_id', targetId)
        const { error } = await admin.auth.admin.deleteUser(targetId)
        if (error) return json({ error: error.message })
        return json({ ok: true })
      }
    }

    return json({ error: 'Ação desconhecida.' })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro interno.' }, 500)
  }
})

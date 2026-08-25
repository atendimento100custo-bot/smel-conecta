// src/lib/adminUsers.js
// Wrapper para a Edge Function "admin-users" — substitui o uso direto de
// supabaseAdmin (service role) no navegador. A chave nunca sai do servidor;
// aqui só enviamos o pedido autenticado com o login do próprio usuário, e a
// função decide (no servidor) se ele tem permissão pra fazer aquilo.
import { supabase } from './supabase'

async function callAdminUsers(payload) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload })
  if (error) return { data: null, error: error.message ?? 'Erro ao chamar o servidor.' }
  if (data?.error) return { data: null, error: data.error }
  return { data, error: null }
}

export function criarFuncionario({ nome, email, senha, cargo, telefone }) {
  return callAdminUsers({ action: 'create', nome, email, senha, cargo, telefone })
}

// nome/cargo/telefone/email — só envia os campos que quer atualizar (undefined = não mexe)
export function atualizarPerfilFuncionario(targetId, { nome, cargo, telefone, email } = {}) {
  return callAdminUsers({ action: 'update_profile', targetId, nome, cargo, telefone, email })
}

export function atualizarEmailFuncionario(targetId, email) {
  return callAdminUsers({ action: 'update_email', targetId, email })
}

// Retorna { data: { senhaGerada }, error } — a senha nova é gerada no servidor.
export function resetarSenhaFuncionario(targetId) {
  return callAdminUsers({ action: 'reset_password', targetId })
}

export function excluirFuncionario(targetId) {
  return callAdminUsers({ action: 'delete', targetId })
}

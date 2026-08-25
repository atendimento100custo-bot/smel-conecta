import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Operações que exigiam a service role (criar/editar/excluir usuário, resetar
// senha) agora passam pela Edge Function "admin-users" — ver src/lib/adminUsers.js.
// A service role key nunca é lida nem embutida no bundle do navegador.

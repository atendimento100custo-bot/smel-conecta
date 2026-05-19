// src/lib/auditLog.js
// Grava uma ação no log de auditoria (historico_acoes).
// Falha silenciosamente se a tabela ainda não foi criada no Supabase.
import { supabase } from './supabase'

/**
 * @param {object} opts
 * @param {'cadastro_aluno'|'registro_presenca'} opts.acao
 * @param {object} opts.perfil  — profile do usuário logado { id, nome }
 * @param {object} [opts.polo]  — { id, nome }
 * @param {object} [opts.turma] — { id, polo_id, modalidades:{nome}, faixa, horario, polos:{nome} }
 * @param {object} [opts.aluno] — { id, nome }
 * @param {string} [opts.detalhes]
 */
export async function logAcao({ acao, perfil, polo, turma, aluno, detalhes }) {
  try {
    const poloNome = polo?.nome ?? turma?.polos?.nome ?? null
    const poloId   = polo?.id   ?? turma?.polo_id   ?? null
    const modNome  = turma?.modalidades?.nome ?? null
    const turmaInfo = [modNome, turma?.faixa, turma?.horario?.slice(0, 5)]
      .filter(Boolean).join(' · ') || null

    await supabase.from('historico_acoes').insert({
      acao,
      usuario_id:      perfil?.id   ?? null,
      usuario_nome:    perfil?.nome ?? null,
      polo_id:         poloId,
      polo_nome:       poloNome,
      modalidade_nome: modNome,
      turma_id:        turma?.id ?? null,
      turma_info:      turmaInfo,
      aluno_id:        aluno?.id   ?? null,
      aluno_nome:      aluno?.nome ?? null,
      detalhes:        detalhes    ?? null,
    })
  } catch (e) {
    // Tabela ainda não criada — não bloqueia o fluxo principal
    console.warn('[auditLog] historico_acoes indisponível:', e?.message)
  }
}

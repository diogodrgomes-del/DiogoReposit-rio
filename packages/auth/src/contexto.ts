import { and, eq } from "drizzle-orm";
import type { Contexto } from "@mark/core";
import {
  comContexto,
  membroEscopos,
  membros,
  organizacoes,
  papelPermissoes,
} from "@mark/db";
import type { DadosSessao } from "./sessao.js";

/**
 * Monta o `Contexto` a partir da sessão.
 *
 * Roda uma vez por requisição. As três consultas acontecem dentro da mesma
 * transação com RLS já ligada — ou seja, mesmo a montagem do contexto está
 * sujeita ao isolamento que ela própria vai passar a impor.
 *
 * Devolve `null` quando o usuário não é membro ativo da organização: sessão
 * válida de alguém que foi removido não vira acesso.
 */
export async function carregarContexto(sessao: DadosSessao): Promise<Contexto | null> {
  return comContexto(sessao, async (tx) => {
    const vinculo = await tx
      .select({ membroId: membros.id, papelId: membros.papelId })
      .from(membros)
      .where(
        and(
          eq(membros.organizacaoId, sessao.organizacaoId),
          eq(membros.usuarioId, sessao.usuarioId),
          eq(membros.ativo, true),
        ),
      )
      .limit(1);

    const m = vinculo[0];
    if (!m) return null;

    const [permissoes, escopos, org] = await Promise.all([
      tx
        .select({ permissao: papelPermissoes.permissao })
        .from(papelPermissoes)
        .where(eq(papelPermissoes.papelId, m.papelId)),
      tx
        .select({ clienteId: membroEscopos.clienteId })
        .from(membroEscopos)
        .where(eq(membroEscopos.membroId, m.membroId)),
      tx
        .select({ proprietarioId: organizacoes.proprietarioId })
        .from(organizacoes)
        .where(eq(organizacoes.id, sessao.organizacaoId))
        .limit(1),
    ]);

    return {
      organizacaoId: sessao.organizacaoId,
      usuarioId: sessao.usuarioId,
      permissoes: new Set(permissoes.map((p) => p.permissao)),
      // Sem nenhuma linha de escopo, o membro enxerga todos os clientes que o
      // papel permitir. Uma linha já restringe à lista.
      clientesPermitidos: escopos.length === 0 ? null : new Set(escopos.map((e) => e.clienteId)),
      // A origem única do acesso ao financeiro pessoal. Não vem de papel.
      ehProprietario: org[0]?.proprietarioId === sessao.usuarioId,
    };
  });
}

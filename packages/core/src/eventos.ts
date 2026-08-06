import { desc, eq, and } from "drizzle-orm";
import { eventos, novoId, type Transacao } from "@mark/db";
import type { Contexto } from "./contexto.js";

/**
 * Linha do tempo automática.
 *
 * O briefing pede que o histórico apareça sozinho — "o usuário não deverá
 * precisar escrever manualmente todo o histórico". A forma de garantir isso não
 * é lembrar de chamar esta função: é chamá-la **dentro da mesma transação** da
 * escrita que ela descreve. Ou os dois acontecem, ou nenhum.
 *
 * Por isso `registrar` recebe a transação em vez de abrir a própria. Uma
 * função que abrisse conexão nova poderia gravar o evento de uma alteração que
 * acabou revertida.
 */

export type TipoEntidade =
  | "cliente"
  | "contato"
  | "lead"
  | "demanda"
  | "proposta"
  | "credencial";

export type Evento = {
  tipo: string;
  entidade: TipoEntidade;
  entidadeId: string;
  dados?: Record<string, unknown>;
};

export async function registrar(tx: Transacao, ctx: Contexto, evento: Evento): Promise<void> {
  await tx.insert(eventos).values({
    id: novoId(),
    organizacaoId: ctx.organizacaoId,
    tipoEntidade: evento.entidade,
    entidadeId: evento.entidadeId,
    tipo: evento.tipo,
    atorId: ctx.usuarioId,
    dados: evento.dados ?? {},
  });
}

/**
 * Diferença entre dois estados, para o evento dizer o que mudou em vez de só
 * dizer que mudou. "Status: ativo → pausado" vale muito mais na tela do que
 * "cliente editado".
 *
 * Campos não citados em `campos` ficam de fora — é o que impede um valor
 * financeiro ou um segredo entrar na linha do tempo, que é lida por quem talvez
 * não possa vê-lo.
 */
export function diferenca<T extends Record<string, unknown>>(
  antes: T,
  depois: Partial<T>,
  campos: readonly (keyof T & string)[],
): Record<string, { de: unknown; para: unknown }> {
  const mudou: Record<string, { de: unknown; para: unknown }> = {};
  for (const campo of campos) {
    if (!(campo in depois)) continue;
    const de = antes[campo] ?? null;
    const para = depois[campo] ?? null;
    if (de !== para) mudou[campo] = { de, para };
  }
  return mudou;
}

export type EventoLido = {
  id: string;
  tipo: string;
  atorId: string | null;
  dados: Record<string, unknown>;
  criadoEm: Date;
};

/** Linha do tempo de uma entidade, da mais recente para a mais antiga. */
export async function linhaDoTempo(
  tx: Transacao,
  entidade: TipoEntidade,
  entidadeId: string,
  limite = 50,
): Promise<EventoLido[]> {
  const linhas = await tx
    .select({
      id: eventos.id,
      tipo: eventos.tipo,
      atorId: eventos.atorId,
      dados: eventos.dados,
      criadoEm: eventos.criadoEm,
    })
    .from(eventos)
    .where(and(eq(eventos.tipoEntidade, entidade), eq(eventos.entidadeId, entidadeId)))
    .orderBy(desc(eventos.criadoEm))
    .limit(limite);

  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    atorId: l.atorId,
    dados: (l.dados ?? {}) as Record<string, unknown>,
    criadoEm: l.criadoEm,
  }));
}

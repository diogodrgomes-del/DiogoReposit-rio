import { isNull } from "drizzle-orm";
import { comoAdmin } from "./cliente";
import { organizacoes } from "./esquema/nucleo";

/**
 * Consultas que precisam existir antes de haver contexto de organização.
 *
 * Só o worker as usa, e só para descobrir *quais* organizações existem — o
 * passo anterior a abrir contexto em cada uma. A partir daí tudo volta a passar
 * por `comContexto` e pela RLS.
 *
 * Existe para que o worker não precise importar `comoAdmin`, que ignora a RLS
 * por completo. Uma função com nome e escopo definidos é auditável; uma válvula
 * genérica espalhada pelo worker não é. O lint proíbe a válvula justamente para
 * forçar a passagem por aqui.
 */

export type OrganizacaoAtiva = {
  id: string;
  nome: string;
  /** Sem proprietário definido, o seed não terminou — não há o que sincronizar. */
  proprietarioId: string | null;
};

export async function listarOrganizacoesAtivas(): Promise<OrganizacaoAtiva[]> {
  return comoAdmin(async (tx) =>
    tx
      .select({
        id: organizacoes.id,
        nome: organizacoes.nome,
        proprietarioId: organizacoes.proprietarioId,
      })
      .from(organizacoes)
      .where(isNull(organizacoes.excluidoEm)),
  );
}

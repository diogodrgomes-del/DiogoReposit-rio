import "server-only";
import type { Ator } from "./sessao";
import type { Permissao } from "./permissoes";

/**
 * Unica funcao que decide permissao no sistema.
 *
 * A interface usa can() para ESCONDER; o servidor usa can() para NEGAR.
 * Esconder botao no cliente e cortesia, nao seguranca — a negacao que vale
 * acontece sempre aqui, no servidor, em toda leitura e em toda escrita.
 */
export function can(ator: Ator | null, permissao: Permissao): boolean {
  if (!ator) return false;
  return ator.permissoes.has(permissao);
}

export function canAlguma(ator: Ator | null, ...permissoes: Permissao[]): boolean {
  return permissoes.some((p) => can(ator, p));
}

/** Pode alcancar este cliente? Papeis sem escopo alcancam todos. */
export function podeCliente(ator: Ator | null, clientId: string | null): boolean {
  if (!ator) return false;
  if (ator.clientesVisiveis === null) return true;
  if (!clientId) return true; // item interno, sem cliente
  return ator.clientesVisiveis.includes(clientId);
}

/**
 * Predicado de escopo para entrar no `where` do Prisma.
 *
 * Entra na consulta, e nao no filtro da tela: assim o banco nunca devolve a
 * linha. Nao existe o caminho "veio do banco e a interface escondeu", que e
 * como dado vaza por API, exportacao e busca.
 */
export function escopoCliente(ator: Ator): Record<string, unknown> {
  if (ator.clientesVisiveis === null) return {};
  return { clientId: { in: ator.clientesVisiveis } };
}

/** Idem, para tabelas em que o cliente pode ser nulo (item interno). */
export function escopoClienteOuInterno(ator: Ator): Record<string, unknown> {
  if (ator.clientesVisiveis === null) return {};
  return {
    OR: [{ clientId: { in: ator.clientesVisiveis } }, { clientId: null }],
  };
}

export class SemPermissao extends Error {
  constructor(permissao?: string) {
    super(
      permissao
        ? `Sem permissão para ${permissao}.`
        : "Você não tem permissão para esta ação."
    );
    this.name = "SemPermissao";
  }
}

/** Lanca se faltar. Toda server action de escrita comeca por aqui. */
export function exigir(ator: Ator | null, permissao: Permissao): asserts ator is Ator {
  if (!can(ator, permissao)) throw new SemPermissao(permissao);
}

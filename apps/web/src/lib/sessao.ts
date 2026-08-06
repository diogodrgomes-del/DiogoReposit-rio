import { cookies, headers } from "next/headers";
import type { Contexto } from "@mark/core";
import { COOKIE as COOKIE_BANCO, carregarContexto, sessao } from "@mark/auth";
import { COOKIE as COOKIE_LEGADO, lerSessao as lerSessaoLegado } from "./auth";

/**
 * Ponte entre os dois modos de acesso.
 *
 * O painel autenticava por `DASH_USERS` e JWT. O MARK SISTEM autentica por
 * banco, com sessão revogável. Os dois convivem **de propósito** durante a fase
 * 1: sem `DATABASE_URL` configurada, o painel continua funcionando exatamente
 * como antes.
 *
 * Isso não é indecisão — é o requisito de não quebrar o que está em produção.
 * Um deploy que exigisse banco no mesmo instante deixaria a equipe sem painel
 * até alguém terminar de configurar o Neon.
 *
 * O modo legado dá acesso **só ao painel de campanhas**. Nenhum módulo do MARK
 * SISTEM abre sem `Contexto` de verdade, porque sem organização e sem papel não
 * há como decidir permissão — e chutar seria pior do que recusar.
 */

export type Acesso =
  | { modo: "banco"; ctx: Contexto; usuario: string }
  | { modo: "legado"; usuario: string };

export function bancoConfigurado(): boolean {
  return Boolean(
    process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL,
  );
}

/**
 * Resolve o acesso a partir dos cookies. Devolve `null` quando nenhum vale.
 *
 * A sessão de banco tem precedência: se as duas existirem, a revogável ganha.
 */
export async function resolverAcesso(
  tokenBanco: string | undefined,
  tokenLegado: string | undefined,
): Promise<Acesso | null> {
  if (tokenBanco && bancoConfigurado()) {
    try {
      const dados = await sessao.ler(tokenBanco);
      if (dados) {
        const ctx = await carregarContexto(dados);
        // Sessão válida de quem deixou de ser membro ativo não vira acesso.
        if (ctx) return { modo: "banco", ctx, usuario: dados.usuarioId };
      }
    } catch (e) {
      // Banco fora do ar não pode derrubar o painel inteiro: cai para o legado,
      // que não depende de banco nenhum.
      console.error("Sessão de banco indisponível:", e instanceof Error ? e.message : e);
    }
  }

  const usuario = await lerSessaoLegado(tokenLegado);
  return usuario ? { modo: "legado", usuario } : null;
}

/** Versão para Server Components, Server Actions e Route Handlers. */
export async function lerAcesso(): Promise<Acesso | null> {
  const jar = await cookies();
  return resolverAcesso(jar.get(COOKIE_BANCO)?.value, jar.get(COOKIE_LEGADO)?.value);
}

export class SemAcesso extends Error {
  constructor(readonly precisaDeBanco = false) {
    super(precisaDeBanco ? "Este módulo exige login no MARK SISTEM." : "Sessão expirada.");
    this.name = "SemAcesso";
  }
}

/** Para o painel de campanhas: qualquer um dos dois modos serve. */
export async function exigirAcesso(): Promise<Acesso> {
  const acesso = await lerAcesso();
  if (!acesso) throw new SemAcesso();
  return acesso;
}

/**
 * Para os módulos do MARK SISTEM: só sessão de banco.
 *
 * É esta função que devolve o `Contexto` exigido por todas as regras em
 * `@mark/core`. Sem ela não há como chamar nenhuma delas — que é exatamente o
 * ponto: não existe caminho até os dados que não passe por uma autorização.
 */
export async function exigirContexto(): Promise<Contexto> {
  const acesso = await lerAcesso();
  if (acesso?.modo !== "banco") throw new SemAcesso(true);
  return acesso.ctx;
}

/** IP de origem, para auditoria de revelação de senha e limite de tentativas. */
export async function ipDaRequisicao(): Promise<string | null> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for");
  return encaminhado?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { autenticando, comContexto, novoId, sessoes } from "@mark/db";
import { OCIOSIDADE_H, VIDA_MAXIMA_D } from "./cookie";

/**
 * Sessões em banco.
 *
 * O painel de campanhas usava JWT puro, e para ele estava certo: sem banco, sem
 * estado, sem custo. Aqui não serve — um JWT válido não pode ser cassado antes
 * de expirar. Desligar o acesso de alguém às 14h e ele seguir lendo o
 * financeiro até as 2h da manhã não é aceitável num sistema com financeiro e
 * senhas de cliente. Com registro em banco, revogar é um UPDATE.
 *
 * O que vai no cookie é um token aleatório de 256 bits. O banco guarda só o
 * SHA-256 dele: um vazamento da tabela `sessoes` não permite montar cookie
 * válido, do mesmo jeito que um vazamento de `usuarios` não devolve senha.
 */

/** Só renova a validade depois disso, para não escrever a cada requisição. */
const RENOVAR_APOS_MIN = 60;

export { COOKIE, MAX_IDADE_COOKIE } from "./cookie";

function agora(): Date {
  return new Date();
}

function maisTarde(base: Date, horas: number): Date {
  return new Date(base.getTime() + horas * 3_600_000);
}

/** SHA-256 em base64url. Disponível em Node, Edge e navegador. */
async function digerir(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function tokenAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export type DadosSessao = {
  usuarioId: string;
  organizacaoId: string;
};

/** Cria a sessão e devolve o token cru — a única vez em que ele existe. */
export async function criar(
  dados: DadosSessao,
  origem: { ip?: string | null; agente?: string | null } = {},
): Promise<string> {
  const token = tokenAleatorio();
  const tokenHash = await digerir(token);

  await autenticando(async (tx) => {
    await tx.insert(sessoes).values({
      id: novoId(),
      usuarioId: dados.usuarioId,
      organizacaoId: dados.organizacaoId,
      tokenHash,
      ip: origem.ip ?? null,
      agente: origem.agente?.slice(0, 500) ?? null,
      expiraEm: maisTarde(agora(), OCIOSIDADE_H),
    });
  });

  return token;
}

/**
 * Valida o token e devolve de quem é. Renova a validade quando faz sentido.
 *
 * Devolve `null` para token inexistente, expirado, revogado ou velho demais —
 * sem distinguir os casos. Quem chama não tem o que fazer com a diferença, e
 * distinguir só ajudaria quem estivesse sondando.
 */
export async function ler(token: string | undefined): Promise<DadosSessao | null> {
  if (!token) return null;

  const tokenHash = await digerir(token);
  const momento = agora();

  return autenticando(async (tx) => {
    const linhas = await tx
      .select({
        id: sessoes.id,
        usuarioId: sessoes.usuarioId,
        organizacaoId: sessoes.organizacaoId,
        expiraEm: sessoes.expiraEm,
        ultimoUso: sessoes.ultimoUso,
        criadoEm: sessoes.criadoEm,
      })
      .from(sessoes)
      .where(and(eq(sessoes.tokenHash, tokenHash), isNull(sessoes.revogadaEm)))
      .limit(1);

    const s = linhas[0];
    if (!s) return null;
    if (s.expiraEm <= momento) return null;

    const limiteAbsoluto = new Date(s.criadoEm.getTime() + VIDA_MAXIMA_D * 86_400_000);
    if (momento >= limiteAbsoluto) return null;

    // Renovação preguiçosa: escrever a cada requisição transformaria toda
    // leitura de página numa escrita no banco.
    if (momento.getTime() - s.ultimoUso.getTime() > RENOVAR_APOS_MIN * 60_000) {
      const novaValidade = maisTarde(momento, OCIOSIDADE_H);
      await tx
        .update(sessoes)
        .set({
          ultimoUso: momento,
          // Nunca além do teto absoluto.
          expiraEm: novaValidade < limiteAbsoluto ? novaValidade : limiteAbsoluto,
        })
        .where(eq(sessoes.id, s.id));
    }

    return { usuarioId: s.usuarioId, organizacaoId: s.organizacaoId };
  });
}

/** Encerra uma sessão. Usado no logout. */
export async function revogar(token: string): Promise<void> {
  const tokenHash = await digerir(token);
  await autenticando(async (tx) => {
    await tx
      .update(sessoes)
      .set({ revogadaEm: agora() })
      .where(and(eq(sessoes.tokenHash, tokenHash), isNull(sessoes.revogadaEm)));
  });
}

/**
 * Derruba todas as sessões de um usuário. É o que roda ao trocar senha, ao
 * desativar alguém e ao suspeitar de cookie roubado.
 */
export async function revogarTodas(ctx: DadosSessao): Promise<number> {
  return comContexto(ctx, async (tx) => {
    const r = await tx
      .update(sessoes)
      .set({ revogadaEm: agora() })
      .where(and(eq(sessoes.usuarioId, ctx.usuarioId), isNull(sessoes.revogadaEm)))
      .returning({ id: sessoes.id });
    return r.length;
  });
}

/**
 * Remove sessões que já não servem para nada. Chamada pelo worker.
 *
 * Apaga de verdade, sem exclusão lógica: sessão morta não é histórico de
 * negócio, e a auditoria de login vive em tabela própria.
 */
export async function limpar(): Promise<number> {
  const corte = new Date(Date.now() - 7 * 86_400_000);
  return autenticando(async (tx) => {
    const r = await tx
      .delete(sessoes)
      .where(
        or(
          lt(sessoes.expiraEm, corte),
          and(sql`${sessoes.revogadaEm} IS NOT NULL`, lt(sessoes.revogadaEm, corte)),
        ),
      )
      .returning({ id: sessoes.id });
    return r.length;
  });
}

import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  PAPEIS_SEM_ESCOPO,
  PERMISSOES_POR_PAPEL,
  type Permissao,
} from "./permissoes";
import type { Papel } from "@prisma/client";

export const COOKIE = "mark_sessao";
const DURACAO_H = 12;
export const MAX_IDADE_COOKIE = DURACAO_H * 60 * 60;

/** Minutos que uma re-autenticacao vale para acoes sensiveis. */
const STEP_UP_MIN = 15;

export type Ator = {
  userId: string;
  sessionId: string;
  nome: string;
  email: string;
  organizationId: string;
  organizacaoNome: string;
  membershipId: string;
  papel: Papel;
  permissoes: Set<Permissao>;
  /** null = enxerga todos os clientes. Array = restrito a estes. */
  clientesVisiveis: string[] | null;
  stepUpEm: Date | null;
};

function hashToken(token: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(token))
    .then((b) =>
      Array.from(new Uint8Array(b))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    );
}

export async function criarSessao(
  userId: string,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await prisma.session.create({
    data: {
      userId,
      tokenHash: await hashToken(token),
      ip,
      userAgent,
      expiraEm: new Date(Date.now() + MAX_IDADE_COOKIE * 1000),
      stepUpEm: new Date(),
    },
  });

  return token;
}

export async function revogarSessao(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: await hashToken(token) },
    data: { revogadaEm: new Date() },
  });
}

/** Derruba todas as sessoes de um usuario. Usado ao desligar alguem da equipe. */
export async function revogarTodasSessoes(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

/**
 * Resolve o ator da requisicao.
 *
 * Memoizado com cache() do React: uma tela com doze componentes de servidor
 * resolve permissao uma vez, nao doze.
 */
export const getAtor = cache(async (): Promise<Ator | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const sessao = await prisma.session.findUnique({
    where: { tokenHash: await hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { ativo: true },
            include: {
              organization: true,
              grants: true,
              clientes: { select: { clientId: true } },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!sessao || sessao.revogadaEm || sessao.expiraEm < new Date()) return null;
  if (!sessao.user.ativo) return null;

  const membership = sessao.user.memberships[0];
  if (!membership) return null;

  // Papel define a base; grants ajustam caso a caso, com DENY vencendo ALLOW.
  const permissoes = new Set<Permissao>(PERMISSOES_POR_PAPEL[membership.papel]);
  for (const g of membership.grants) {
    if (g.efeito === "ALLOW") permissoes.add(g.permissao as Permissao);
  }
  for (const g of membership.grants) {
    if (g.efeito === "DENY") permissoes.delete(g.permissao as Permissao);
  }

  return {
    userId: sessao.userId,
    sessionId: sessao.id,
    nome: sessao.user.nome,
    email: sessao.user.email,
    organizationId: membership.organizationId,
    organizacaoNome: membership.organization.nome,
    membershipId: membership.id,
    papel: membership.papel,
    permissoes,
    clientesVisiveis: PAPEIS_SEM_ESCOPO.includes(membership.papel)
      ? null
      : membership.clientes.map((c) => c.clientId),
    stepUpEm: sessao.stepUpEm,
  };
});

/** Ator garantido. Use em qualquer lugar abaixo do layout autenticado. */
export async function exigirAtor(): Promise<Ator> {
  const ator = await getAtor();
  if (!ator) throw new NaoAutenticado();
  return ator;
}

export function stepUpValido(ator: Ator): boolean {
  if (!ator.stepUpEm) return false;
  return Date.now() - ator.stepUpEm.getTime() < STEP_UP_MIN * 60_000;
}

export async function registrarStepUp(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { stepUpEm: new Date() },
  });
}

export async function ipDaRequisicao(): Promise<string | undefined> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    undefined
  );
}

export class NaoAutenticado extends Error {
  constructor() {
    super("Sessão expirada.");
    this.name = "NaoAutenticado";
  }
}

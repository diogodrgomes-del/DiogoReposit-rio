import "server-only";
import type { Prisma } from "@prisma/client";
import type { Ator } from "@/lib/auth/sessao";

type Tx = Prisma.TransactionClient;

/** Campos que nunca entram num diff de auditoria. */
const REDIGIDOS = new Set([
  "senha",
  "senhaHash",
  "segredo",
  "segredoCipher",
  "segredoIv",
  "segredoTag",
  "token",
  "tokenHash",
]);

function redigir(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "object") return v as Prisma.InputJsonValue;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (REDIGIDOS.has(k)) continue;
    out[k] = val instanceof Date ? val.toISOString() : val;
  }
  return out as Prisma.InputJsonValue;
}

/**
 * Grava auditoria. Recebe o cliente de transacao para que o registro e a
 * mudanca vivam na MESMA transacao: ou as duas coisas aconteceram, ou nenhuma.
 */
export async function auditar(
  tx: Tx,
  ator: Ator,
  dados: {
    acao: string;
    entidadeTipo: string;
    entidadeId: string;
    resumo?: string;
    antes?: unknown;
    depois?: unknown;
    ip?: string;
  }
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: ator.organizationId,
      userId: ator.userId,
      acao: dados.acao,
      entidadeTipo: dados.entidadeTipo,
      entidadeId: dados.entidadeId,
      resumo: dados.resumo,
      antes: redigir(dados.antes),
      depois: redigir(dados.depois),
      ip: dados.ip,
    },
  });
}

/**
 * Enfileira um evento para o worker. Escrito na mesma transacao da mudanca —
 * e o que impede "criou o lead e perdeu a notificacao".
 */
export async function enfileirar(
  tx: Tx,
  organizationId: string,
  tipo: string,
  payload: Prisma.InputJsonValue
): Promise<void> {
  await tx.outbox.create({ data: { organizationId, tipo, payload } });
}

/** Notificacao interna, respeitando permissao na entrega. */
export async function notificar(
  tx: Tx,
  dados: {
    organizationId: string;
    userId: string;
    tipo: string;
    titulo: string;
    corpo?: string;
    url?: string;
    permissaoExigida?: string;
  }
): Promise<void> {
  await tx.notification.create({ data: dados });
}

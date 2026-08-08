import "server-only";
import { z } from "zod";
import { SemPermissao } from "@/lib/auth/can";
import { NaoAutenticado } from "@/lib/auth/sessao";

/**
 * Retorno de toda server action.
 *
 * Erro é valor de retorno, não exceção que sobe até a tela: exceção em server
 * action vira "an error occurred in the Server Components render" em produção,
 * que não diz nada a quem está usando o sistema.
 */
export type Resultado<T = void> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campos?: Record<string, string> };

export function sucesso<T>(dados: T): Resultado<T> {
  return { ok: true, dados };
}

export function falha(
  erro: string,
  campos?: Record<string, string>
): Resultado<never> {
  return { ok: false, erro, campos };
}

/**
 * Converte a exceção em mensagem que a pessoa entende, sem vazar detalhe de
 * banco. O erro técnico continua indo para o log do servidor.
 */
export function tratarErro(e: unknown): Resultado<never> {
  if (e instanceof z.ZodError) {
    const campos: Record<string, string> = {};
    for (const issue of e.issues) {
      const campo = issue.path.join(".");
      if (campo && !campos[campo]) campos[campo] = issue.message;
    }
    return falha("Confira os campos destacados.", campos);
  }

  if (e instanceof SemPermissao) return falha(e.message);
  if (e instanceof NaoAutenticado) return falha("Sua sessão expirou. Entre de novo.");

  const msg = e instanceof Error ? e.message : String(e);

  if (msg.includes("Unique constraint")) {
    return falha("Já existe um registro com esses dados.");
  }
  if (msg.includes("Foreign key constraint")) {
    return falha("Um item relacionado não foi encontrado.");
  }

  console.error("[acao]", e);
  return falha("Não foi possível concluir. Tente de novo.");
}

/** Campo de texto opcional: string vazia do formulário vira null no banco. */
export const textoOpcional = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .transform((v) => (v ? v : null));

export const idOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const dataOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Data inválida.");

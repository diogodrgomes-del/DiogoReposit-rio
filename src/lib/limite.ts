/**
 * Limite de tentativas de login por origem.
 *
 * Guarda em memória do processo. Numa plataforma serverless isso não é uma
 * barreira global — instâncias diferentes contam separado, e uma instância nova
 * começa zerada. Ainda assim corta a força bruta rápida, que é o ataque real
 * contra senha curta: sem isso, um milhão de combinações de seis dígitos é só
 * questão de deixar o script rodando.
 *
 * Um bloqueio de verdade exigiria armazenamento compartilhado (Redis, KV). Se
 * o painel passar a ter senhas fracas de forma permanente, vale trocar por isso.
 */

type Registro = { tentativas: number; ate: number };

const JANELA_MS = 15 * 60_000;
const MAX_TENTATIVAS = 8;
const memoria = new Map<string, Registro>();

function limpar(agora: number) {
  // O Map não pode crescer sem fim num processo de vida longa.
  if (memoria.size < 1000) return;
  for (const [k, v] of memoria) if (v.ate < agora) memoria.delete(k);
}

/** Identidade da origem. Atrás de proxy, o IP real vem no cabeçalho. */
export function origem(req: Request): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "desconhecido";
  return ip;
}

export function bloqueado(chave: string): number {
  const agora = Date.now();
  const r = memoria.get(chave);
  if (!r || r.ate < agora) return 0;
  if (r.tentativas < MAX_TENTATIVAS) return 0;
  return Math.ceil((r.ate - agora) / 1000);
}

export function registrarFalha(chave: string): void {
  const agora = Date.now();
  limpar(agora);
  const r = memoria.get(chave);
  if (!r || r.ate < agora) {
    memoria.set(chave, { tentativas: 1, ate: agora + JANELA_MS });
    return;
  }
  r.tentativas += 1;
  memoria.set(chave, r);
}

export function limparFalhas(chave: string): void {
  memoria.delete(chave);
}

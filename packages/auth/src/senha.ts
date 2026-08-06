import { pbkdf2 as pbkdf2Cb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { hash, verify } from "@node-rs/argon2";

const pbkdf2 = promisify(pbkdf2Cb);

/**
 * Derivação e verificação de senha.
 *
 * Dois formatos convivem:
 *
 *   `$argon2id$v=19$m=...`         — padrão daqui em diante
 *   `pbkdf2.<iter>.<sal>.<hash>`   — herdado do painel de campanhas
 *
 * O painel derivava com PBKDF2-SHA256 e 210 mil iterações, o que era uma
 * escolha correta para WebCrypto puro. Argon2id resiste melhor a ataque com
 * GPU, porque o custo é de memória e não só de CPU.
 *
 * Ninguém precisa trocar de senha por causa disso: `verificar()` aceita os dois
 * e avisa quando o hash é antigo. Quem chama regrava no primeiro login certo.
 */

// OWASP 2024 para argon2id: 19 MiB, 2 iterações, paralelismo 1.
const PARAMETROS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export async function derivar(senha: string): Promise<string> {
  if (senha.length < 12) {
    throw new Error("Senha curta demais: mínimo de 12 caracteres.");
  }
  return hash(senha, PARAMETROS);
}

export type Resultado = {
  confere: boolean;
  /** Verdadeiro quando o hash guardado está num formato que já não usamos. */
  precisaRegravar: boolean;
};

export async function verificar(senha: string, guardado: string | null): Promise<Resultado> {
  // Sem usuário ou sem hash, ainda gastamos o mesmo tempo de uma verificação
  // real. Responder rápido aqui denunciaria quais e-mails existem na base.
  if (!guardado) {
    await hash(senha, PARAMETROS).catch(() => "");
    return { confere: false, precisaRegravar: false };
  }

  if (guardado.startsWith("$argon2")) {
    const confere = await verify(guardado, senha, PARAMETROS).catch(() => false);
    return { confere, precisaRegravar: false };
  }

  if (guardado.startsWith("pbkdf2.")) {
    const confere = await conferirPbkdf2(senha, guardado);
    return { confere, precisaRegravar: confere };
  }

  return { confere: false, precisaRegravar: false };
}

/**
 * Formato do painel antigo: `pbkdf2.<iteracoes>.<salB64url>.<hashB64url>`.
 *
 * Base64url e ponto como separador não são estética: o Next passa os valores de
 * `.env` por dotenv-expand, que comeria qualquer `$` do hash. A restrição não
 * existe mais aqui — o hash vem do banco —, mas os hashes já gravados seguem
 * neste formato e precisam continuar sendo aceitos.
 */
async function conferirPbkdf2(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split(".");
  if (partes.length !== 4) return false;

  const iteracoes = Number(partes[1]);
  // O painel gravava com 210 mil. Piso de mil recusa hash adulterado para
  // baixo, que tornaria a verificação barata de forçar.
  if (!Number.isFinite(iteracoes) || iteracoes < 1000) return false;

  const sal = Buffer.from(partes[2] ?? "", "base64url");
  const esperado = Buffer.from(partes[3] ?? "", "base64url");
  if (sal.length === 0 || esperado.length === 0) return false;

  const obtido = await pbkdf2(senha, sal, iteracoes, esperado.length, "sha256");

  // timingSafeEqual exige o mesmo comprimento, senão lança.
  if (obtido.length !== esperado.length) return false;
  return timingSafeEqual(obtido, esperado);
}

/**
 * Hash de senha em PBKDF2-SHA256 sobre Web Crypto.
 *
 * Por que nao Argon2: Argon2 no Node exige binario nativo (@node-rs/argon2 ou
 * argon2), que e a causa numero um de build quebrado em plataforma serverless —
 * arquitetura errada, glibc diferente, binario ausente no bundle. PBKDF2 pelo
 * Web Crypto nao tem dependencia nenhuma, roda igual no Node e no runtime Edge,
 * e com 600 mil iteracoes atende a recomendacao do OWASP para PBKDF2-SHA256.
 *
 * O formato guardado e:  pbkdf2.<iteracoes>.<saltB64url>.<hashB64url>
 *
 * Separador ponto e codificacao base64url de proposito: o Next passa os valores
 * de .env por dotenv-expand, que substituiria qualquer `$algo` por variavel
 * vazia — um hash com `$` chega truncado. Base64url tambem evita `+` e `/`, que
 * atrapalham em URL. Isso vem do painel anterior e continua valendo para os
 * hashes migrados de DASH_USERS.
 */

const ITERACOES_PADRAO = 600_000;

function bytesParaB64url(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlParaBytes(s: string): Uint8Array {
  const padrao = s.replace(/-/g, "+").replace(/_/g, "/");
  const completo = padrao + "=".repeat((4 - (padrao.length % 4)) % 4);
  const bin = atob(completo);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derivar(
  senha: string,
  salt: Uint8Array,
  iteracoes: number
): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: iteracoes,
      hash: "SHA-256",
    },
    chave,
    256
  );
  return new Uint8Array(bits);
}

/** Comparacao em tempo constante: nao vaza onde os bytes divergem. */
function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(senha, salt, ITERACOES_PADRAO);
  return `pbkdf2.${ITERACOES_PADRAO}.${bytesParaB64url(salt)}.${bytesParaB64url(hash)}`;
}

/**
 * Confere a senha. Sempre deriva, mesmo com hash invalido ou ausente, para que
 * o tempo de resposta nao denuncie quais e-mails existem na base.
 */
export async function conferirSenha(
  senha: string,
  guardado: string | null | undefined
): Promise<boolean> {
  const alvo =
    guardado ??
    `pbkdf2.${ITERACOES_PADRAO}.AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

  const partes = alvo.split(".");
  if (partes.length !== 4 || partes[0] !== "pbkdf2") {
    await derivar(senha, new Uint8Array(16), 1000);
    return false;
  }

  const iteracoes = Number(partes[1]);
  if (!Number.isFinite(iteracoes) || iteracoes < 1000) return false;

  let salt: Uint8Array;
  let esperado: Uint8Array;
  try {
    salt = b64urlParaBytes(partes[2]);
    esperado = b64urlParaBytes(partes[3]);
  } catch {
    return false;
  }

  const obtido = await derivar(senha, salt, iteracoes);
  return guardado !== undefined && guardado !== null && iguais(obtido, esperado);
}

/**
 * Hash antigo, com menos iteracoes que o padrao atual, deve ser reescrito no
 * proximo login bem-sucedido. E como as contas migradas de DASH_USERS (210 mil
 * iteracoes) sobem para 600 mil sem ninguem trocar de senha.
 */
export function precisaRehash(guardado: string): boolean {
  const partes = guardado.split(".");
  if (partes.length !== 4 || partes[0] !== "pbkdf2") return true;
  return Number(partes[1]) < ITERACOES_PADRAO;
}

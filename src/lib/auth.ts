import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "marktiva_session";
const DURACAO_H = 12;

/**
 * Usuarios vem de DASH_USERS, no formato:
 *   usuario:pbkdf2.iteracoes.saltB64url.hashB64url,outro:pbkdf2....
 *
 * O separador e ponto e a codificacao e base64url de proposito. O Next passa
 * os valores de .env por dotenv-expand, que substituiria qualquer `$algo` por
 * uma variavel vazia — um hash com `$` chega truncado ao servidor e o login
 * falha sempre. Base64url tambem evita `+` e `/`, que atrapalham em URL e em
 * alguns paineis de configuracao.
 */
function usuarios(): Map<string, string> {
  const bruto = process.env.DASH_USERS ?? "";
  const mapa = new Map<string, string>();
  for (const parte of bruto.split(",")) {
    const limpo = parte.trim();
    if (!limpo) continue;
    const corte = limpo.indexOf(":");
    if (corte < 1) continue;
    mapa.set(limpo.slice(0, corte).trim(), limpo.slice(corte + 1).trim());
  }
  return mapa;
}

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres)."
    );
  }
  return new TextEncoder().encode(s);
}

function bytesParaB64(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}

function b64ParaBytes(s: string): Uint8Array {
  // Aceita base64url; converte para o alfabeto padrao antes de decodificar.
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
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iteracoes, hash: "SHA-256" },
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

export async function conferirSenha(
  usuario: string,
  senha: string
): Promise<boolean> {
  const guardado = usuarios().get(usuario);
  // Deriva mesmo sem usuario valido, para o tempo de resposta nao denunciar
  // quais nomes existem.
  const alvo =
    guardado ??
    "pbkdf2.210000.AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const partes = alvo.split(".");
  if (partes.length !== 4 || partes[0] !== "pbkdf2") return false;

  const iteracoes = Number(partes[1]);
  if (!Number.isFinite(iteracoes) || iteracoes < 1000) return false;

  let salt: Uint8Array;
  let esperado: Uint8Array;
  try {
    salt = b64ParaBytes(partes[2]);
    esperado = b64ParaBytes(partes[3]);
  } catch {
    return false;
  }

  const obtido = await derivar(senha, salt, iteracoes);
  return guardado !== undefined && iguais(obtido, esperado);
}

export async function criarSessao(usuario: string): Promise<string> {
  return new SignJWT({ sub: usuario })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_H}h`)
    .sign(segredo());
}

export async function lerSessao(token?: string): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const MAX_IDADE_COOKIE = DURACAO_H * 60 * 60;

export { bytesParaB64 };

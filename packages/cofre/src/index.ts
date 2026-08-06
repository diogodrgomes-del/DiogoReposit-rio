import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cofre — cifra envelopada para segredos guardados no banco.
 *
 * Segredos aqui são tokens da Meta, senhas de plataformas dos clientes e
 * credenciais de integração. Nada disso pode ficar em texto puro em lugar
 * nenhum, e "nenhum" inclui log, backup e resposta de erro.
 *
 * ┌── KEK (chave mestra, em variável de ambiente / futuramente KMS)
 * │    └── cifra a DEK, uma por segredo, aleatória
 * │         └── cifra o segredo
 *
 * Por que duas chaves em vez de cifrar direto com a mestra:
 *
 *  - **Rotação barata.** Trocar a KEK reescreve só as DEKs — alguns bytes por
 *    linha — em vez de decifrar e recifrar todo segredo do banco.
 *  - **Raio de alcance.** Uma DEK vazada expõe um segredo, não a base.
 *  - **Rotação sem parada.** Cada linha guarda a versão da KEK que a cifrou,
 *    então segredos antigos continuam legíveis enquanto a migração roda.
 *
 * AES-256-GCM: cifra e autentica na mesma passada. Adulterar o texto cifrado
 * faz a decifragem falhar em vez de devolver lixo silenciosamente.
 */

const ALGORITMO = "aes-256-gcm";
const TAMANHO_NONCE = 12; // recomendado para GCM
const TAMANHO_TAG = 16;
const TAMANHO_CHAVE = 32; // AES-256

export type Envelope = {
  /** nonce ‖ texto cifrado ‖ tag */
  segredo: Buffer;
  /** nonce ‖ DEK cifrada ‖ tag */
  dek: Buffer;
  /** Qual KEK cifrou a DEK. Permite rotacionar sem parar o sistema. */
  versaoKek: number;
};

export class ErroDoCofre extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDoCofre";
  }
}

/**
 * Chaves mestras, lidas de `COFRE_KEKS` no formato `versao:base64url,…`.
 *
 * Várias ao mesmo tempo de propósito: durante uma rotação, a nova cifra e as
 * antigas ainda decifram. `COFRE_KEK_ATUAL` diz qual usar para escrever.
 */
function chaves(): Map<number, Buffer> {
  const bruto = process.env.COFRE_KEKS ?? "";
  const mapa = new Map<number, Buffer>();

  for (const parte of bruto.split(",")) {
    const limpo = parte.trim();
    if (!limpo) continue;
    const corte = limpo.indexOf(":");
    if (corte < 1) continue;

    const versao = Number(limpo.slice(0, corte));
    const chave = Buffer.from(limpo.slice(corte + 1), "base64url");
    if (!Number.isInteger(versao) || versao < 1) continue;
    if (chave.length !== TAMANHO_CHAVE) {
      throw new ErroDoCofre(
        `COFRE_KEKS: a chave da versão ${versao} tem ${chave.length} bytes; são necessários ${TAMANHO_CHAVE}.`,
      );
    }
    mapa.set(versao, chave);
  }

  if (mapa.size === 0) {
    throw new ErroDoCofre(
      "COFRE_KEKS ausente. Gere com: node -e \"console.log('1:' + require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
  return mapa;
}

function versaoAtual(disponiveis: Map<number, Buffer>): number {
  const declarada = Number(process.env.COFRE_KEK_ATUAL);
  if (Number.isInteger(declarada) && disponiveis.has(declarada)) return declarada;
  // Sem declaração, a mais nova. Evita cifrar com chave velha por descuido.
  return Math.max(...disponiveis.keys());
}

export function cofreConfigurado(): boolean {
  try {
    chaves();
    return true;
  } catch {
    return false;
  }
}

function selar(chave: Buffer, texto: Buffer, aad: Buffer): Buffer {
  const nonce = randomBytes(TAMANHO_NONCE);
  const cifra = createCipheriv(ALGORITMO, chave, nonce);
  cifra.setAAD(aad);
  const corpo = Buffer.concat([cifra.update(texto), cifra.final()]);
  return Buffer.concat([nonce, corpo, cifra.getAuthTag()]);
}

function abrir(chave: Buffer, envelope: Buffer, aad: Buffer): Buffer {
  if (envelope.length < TAMANHO_NONCE + TAMANHO_TAG) {
    throw new ErroDoCofre("Envelope truncado.");
  }
  const nonce = envelope.subarray(0, TAMANHO_NONCE);
  const tag = envelope.subarray(envelope.length - TAMANHO_TAG);
  const corpo = envelope.subarray(TAMANHO_NONCE, envelope.length - TAMANHO_TAG);

  const decifra = createDecipheriv(ALGORITMO, chave, nonce);
  decifra.setAAD(aad);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(corpo), decifra.final()]);
}

/**
 * `aad` amarra o texto cifrado ao lugar onde ele mora — normalmente
 * `organizacaoId:credencialId`. Copiar a linha para outro cliente, ou para
 * outra organização, faz a decifragem falhar em vez de entregar o segredo.
 * Não é opcional: sem isso, mover bytes entre linhas é um ataque válido.
 */
export function cifrar(segredo: string, aad: string): Envelope {
  if (!aad) throw new ErroDoCofre("aad é obrigatório: sem ele o envelope é transplantável.");

  const disponiveis = chaves();
  const versaoKek = versaoAtual(disponiveis);
  const kek = disponiveis.get(versaoKek);
  if (!kek) throw new ErroDoCofre(`KEK versão ${versaoKek} não configurada.`);

  const dek = randomBytes(TAMANHO_CHAVE);
  const bytesAad = Buffer.from(aad, "utf8");

  const envelope: Envelope = {
    segredo: selar(dek, Buffer.from(segredo, "utf8"), bytesAad),
    dek: selar(kek, dek, bytesAad),
    versaoKek,
  };

  // A DEK em claro não tem por que sobreviver a esta função.
  dek.fill(0);
  return envelope;
}

export function decifrar(envelope: Envelope, aad: string): string {
  if (!aad) throw new ErroDoCofre("aad é obrigatório.");

  const disponiveis = chaves();
  const kek = disponiveis.get(envelope.versaoKek);
  if (!kek) {
    throw new ErroDoCofre(
      `KEK versão ${envelope.versaoKek} não está em COFRE_KEKS. ` +
        "Chave de rotação anterior removida cedo demais — sem ela este segredo é irrecuperável.",
    );
  }

  const bytesAad = Buffer.from(aad, "utf8");
  const dek = abrir(kek, envelope.dek, bytesAad);
  try {
    return abrir(dek, envelope.segredo, bytesAad).toString("utf8");
  } finally {
    dek.fill(0);
  }
}

/**
 * Recifra a DEK com a KEK atual, sem tocar no segredo.
 *
 * É a rotação de chave mestra inteira: percorre as credenciais, chama isto e
 * grava de volta. O texto cifrado do segredo não muda, então o custo é
 * proporcional ao número de linhas e não ao tamanho dos dados.
 */
export function rotacionar(envelope: Envelope, aad: string): Envelope {
  const disponiveis = chaves();
  const destino = versaoAtual(disponiveis);
  if (destino === envelope.versaoKek) return envelope;

  const antiga = disponiveis.get(envelope.versaoKek);
  const nova = disponiveis.get(destino);
  if (!antiga || !nova) throw new ErroDoCofre("Chave de origem ou destino ausente na rotação.");

  const bytesAad = Buffer.from(aad, "utf8");
  const dek = abrir(antiga, envelope.dek, bytesAad);
  try {
    return { segredo: envelope.segredo, dek: selar(nova, dek, bytesAad), versaoKek: destino };
  } finally {
    dek.fill(0);
  }
}

/** Mostra só o suficiente para reconhecer o segredo sem revelá-lo. */
export function mascarar(segredo: string): string {
  if (segredo.length <= 8) return "•".repeat(segredo.length);
  return `${segredo.slice(0, 4)}${"•".repeat(Math.min(segredo.length - 8, 20))}${segredo.slice(-4)}`;
}

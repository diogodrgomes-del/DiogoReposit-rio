/**
 * Normalização de telefone para E.164.
 *
 * Esta função é a chave que casa uma conversa de WhatsApp com um contato do
 * CRM. Se ela errar, o sistema cria contato duplicado a cada mensagem e o
 * histórico do lead se parte em dois — exatamente no momento em que ele passa a
 * valer mais. Por isso ela é pura, mora no núcleo e tem teste para cada formato
 * que aparece na prática.
 *
 * O padrão brasileiro tem três armadilhas:
 *
 *  1. O nono dígito. Celulares ganharam um `9` na frente entre 2010 e 2016, e
 *     bases antigas ainda têm números de 8 dígitos. Um `44 8888-7777` e um
 *     `44 98888-7777` são a mesma pessoa.
 *  2. O zero do DDD. `044` e `44` são o mesmo DDD.
 *  3. O código do país. `5544…` e `44…` são o mesmo número, mas `55` também é
 *     um DDD válido (Rio Grande do Sul), então não dá para cortar por prefixo
 *     sem olhar o comprimento.
 */

/** DDDs válidos no Brasil. Fora desta lista, o número não é brasileiro. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Devolve o número em E.164 (`+5544998887777`) ou `null` se não der para
 * afirmar que é um telefone.
 *
 * Devolver `null` é melhor do que chutar: um telefone errado no banco vira
 * mensagem enviada para a pessoa errada.
 */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;

  const tinhaMais = bruto.trim().startsWith("+");
  let digitos = bruto.replace(/\D/g, "");
  if (!digitos) return null;

  // Número internacional explícito e não brasileiro: aceita como veio. Não
  // temos como validar o plano de numeração de cada país, e recusar seria pior
  // do que guardar.
  if (tinhaMais && !digitos.startsWith("55")) {
    return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null;
  }

  // Prefixo internacional discado (00) ou código do país já presente.
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length >= 12 && digitos.startsWith("55")) digitos = digitos.slice(2);

  // Zero de operadora antes do DDD: 0 44 9…
  if (digitos.length > 11 && digitos.startsWith("0")) digitos = digitos.replace(/^0+/, "");
  if (digitos.length === 11 && digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 12 && digitos.startsWith("0")) digitos = digitos.slice(1);

  if (digitos.length !== 10 && digitos.length !== 11) return null;

  const ddd = Number(digitos.slice(0, 2));
  if (!DDDS.has(ddd)) return null;

  let assinante = digitos.slice(2);

  // Nono dígito: 8 dígitos começando por 6-9 é celular antigo e ganha o 9.
  // Começando por 2-5 é fixo, e fixo continua com 8 dígitos.
  if (assinante.length === 8 && /^[6-9]/.test(assinante)) {
    assinante = `9${assinante}`;
  }

  // Celular com 9 dígitos tem de começar por 9; fixo com 8, por 2-5.
  if (assinante.length === 9 && !assinante.startsWith("9")) return null;
  if (assinante.length === 8 && !/^[2-5]/.test(assinante)) return null;

  return `+55${ddd}${assinante}`;
}

/** Formato de leitura: `(44) 99888-7777`. Só para exibir. */
export function formatarTelefone(e164: string | null | undefined): string {
  if (!e164) return "";
  if (!e164.startsWith("+55")) return e164;

  const d = e164.slice(3);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

/** Link de conversa no WhatsApp. Espera E.164; devolve `null` sem número. */
export function linkWhatsApp(e164: string | null | undefined): string | null {
  if (!e164) return null;
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}

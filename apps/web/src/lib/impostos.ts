import { apelido } from "./clientes";

/**
 * Alíquota de imposto sobre a verba de anúncios, por cliente.
 *
 * A Graph API NÃO devolve imposto: `spend` é o valor líquido, e os endpoints de
 * faturamento (`transactions`, `invoices`, `business_invoices`) não existem mais
 * na v21 — verificado. O valor com imposto só aparece na área de Faturamento do
 * Gerenciador. Por isso a alíquota é configurada, e o painel rotula o resultado
 * como estimativa em vez de fingir que veio da Meta.
 *
 * Configuração em META_IMPOSTO, percentual:
 *
 *   META_IMPOSTO=7.65                          (mesma alíquota para todos)
 *   META_IMPOSTO=padrao=7.65;Bilumix=9         (padrão + exceções por cliente)
 *
 * Sem a variável, o painel não mostra imposto nenhum — melhor omitir do que
 * exibir um número inventado ao lado de valores reais.
 */

const LIMITE = 100;

function parsear(): { padrao: number | null; porCliente: Map<string, number> } {
  const bruto = (process.env.META_IMPOSTO ?? "").trim();
  const porCliente = new Map<string, number>();
  if (!bruto) return { padrao: null, porCliente };

  // Valor único: alíquota para todos.
  const simples = Number(bruto.replace(",", "."));
  if (Number.isFinite(simples)) {
    return {
      padrao: simples >= 0 && simples < LIMITE ? simples : null,
      porCliente,
    };
  }

  let padrao: number | null = null;
  for (const parte of bruto.split(/[;\n]+/)) {
    const texto = parte.trim();
    if (!texto) continue;
    const corte = texto.indexOf("=");
    if (corte < 1) continue;
    const nome = texto.slice(0, corte).trim();
    const valor = Number(texto.slice(corte + 1).trim().replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0 || valor >= LIMITE) continue;

    if (nome.toLowerCase() === "padrao" || nome.toLowerCase() === "padrão") {
      padrao = valor;
    } else {
      porCliente.set(apelido(nome), valor);
    }
  }
  return { padrao, porCliente };
}

/** Alíquota em porcentagem, ou null quando não há imposto configurado. */
export function aliquotaDe(clienteId: string): number | null {
  const { padrao, porCliente } = parsear();
  return porCliente.get(clienteId) ?? padrao;
}

export function temImpostoConfigurado(): boolean {
  const { padrao, porCliente } = parsear();
  return padrao !== null || porCliente.size > 0;
}

/** Imposto e custo total a partir da verba líquida. */
export function calcular(
  gastoLiquido: number,
  aliquota: number | null
): { imposto: number; total: number } | null {
  if (aliquota === null || !Number.isFinite(gastoLiquido)) return null;
  const imposto = gastoLiquido * (aliquota / 100);
  return { imposto, total: gastoLiquido + imposto };
}

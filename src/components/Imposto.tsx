"use client";

import { brl, decimal } from "@/lib/format";

type Props = {
  /** Verba líquida do período, como vem da Meta. */
  gastoLiquido: number;
  /** Percentual configurado; null quando não há imposto configurado. */
  aliquota: number | null;
};

/**
 * Imposto sobre a verba de anúncios.
 *
 * A Graph API não devolve esse dado: `spend` é líquido, e os endpoints de
 * faturamento foram removidos da v21. O valor aqui é calculado sobre a alíquota
 * configurada em META_IMPOSTO, e o rótulo diz isso — para ninguém confundir com
 * número vindo da Meta.
 *
 * Sem alíquota configurada o bloco não aparece: melhor omitir do que exibir
 * estimativa ao lado de valores reais.
 */
export default function Imposto({ gastoLiquido, aliquota }: Props) {
  if (aliquota === null || gastoLiquido <= 0) return null;

  const imposto = gastoLiquido * (aliquota / 100);
  const total = gastoLiquido + imposto;

  return (
    <div className="imposto">
      <div className="imposto-item">
        <span className="imposto-rot">Verba líquida</span>
        <span className="imposto-val">{brl(gastoLiquido)}</span>
      </div>
      <div className="imposto-item">
        <span className="imposto-rot">
          Imposto estimado ({decimal(aliquota)}%)
        </span>
        <span className="imposto-val">{brl(imposto)}</span>
      </div>
      <div className="imposto-item">
        <span className="imposto-rot">Custo total</span>
        <span className="imposto-val total">{brl(total)}</span>
      </div>
      <p className="imposto-nota">
        Calculado sobre a alíquota configurada. A Meta não expõe imposto na API —
        o valor que ela devolve é sempre líquido. Confira na área de Faturamento
        do Gerenciador.
      </p>
    </div>
  );
}

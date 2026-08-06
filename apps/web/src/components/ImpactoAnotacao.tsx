"use client";

import type { Impacto } from "@/lib/meta";
import { brl, inteiro } from "@/lib/format";

/** Variação percentual, protegida contra divisão por zero. */
function variacao(antes: number | null, depois: number | null): number | null {
  if (antes === null || depois === null || antes === 0) return null;
  return ((depois - antes) / antes) * 100;
}

function Delta({
  rotulo,
  antes,
  depois,
  formato,
  menorMelhor,
}: {
  rotulo: string;
  antes: number | null;
  depois: number | null;
  formato: (v: number | null) => string;
  menorMelhor?: boolean;
}) {
  const v = variacao(antes, depois);
  const melhorou = v === null ? null : menorMelhor ? v < 0 : v > 0;
  const classe = melhorou === null ? "" : melhorou ? "sobe" : "desce";

  return (
    <div className="imp-item">
      <span className="imp-rot">{rotulo}</span>
      <span className="imp-par">
        <span className="imp-antes">{formato(antes)}</span>
        <span className="imp-seta">→</span>
        <span className="imp-depois">{formato(depois)}</span>
      </span>
      {v !== null && (
        <span className={`imp-delta ${classe}`}>
          {v > 0 ? "+" : ""}
          {v.toFixed(1).replace(".", ",")}%
        </span>
      )}
    </div>
  );
}

export default function ImpactoAnotacao({
  imp,
  mudancas = 1,
}: {
  imp: Impacto;
  /** Quantas alterações houve nesse dia, para não atribuir o efeito a uma só. */
  mudancas?: number;
}) {
  const { antes, depois, diasDecorridos, diasJanela, confiavel } = imp;

  // Nada veiculou nas duas janelas: não há o que comparar.
  if (antes.gasto === 0 && depois.gasto === 0) return null;

  if (diasDecorridos < diasJanela) {
    const faltam = diasJanela - diasDecorridos;
    return (
      <div className="impacto aguardando">
        <span className="imp-aviso">
          Resultado em {faltam} {faltam === 1 ? "dia" : "dias"} — comparando{" "}
          {diasJanela} dias antes e depois.
        </span>
      </div>
    );
  }

  const custoAntes = antes.custoConversa;
  const custoDepois = depois.custoConversa;
  const v = variacao(custoAntes, custoDepois);

  let veredito: string | null = null;
  let tom = "";
  if (!confiavel) {
    veredito = "Amostra pequena para concluir";
    tom = "neutro";
  } else if (v !== null) {
    // Abaixo de 10% a diferença cabe na variação normal entre semanas.
    if (Math.abs(v) < 10) {
      veredito = "Sem mudança relevante no custo por lead";
      tom = "neutro";
    } else if (v < 0) {
      veredito = `Custo por lead caiu ${Math.abs(v).toFixed(0)}%`;
      tom = "bom";
    } else {
      veredito = `Custo por lead subiu ${v.toFixed(0)}%`;
      tom = "ruim";
    }
  }

  return (
    <div className={`impacto ${tom}`}>
      {veredito && <span className="imp-veredito">{veredito}</span>}

      <div className="imp-grade">
        <Delta
          rotulo="Custo por lead"
          antes={custoAntes}
          depois={custoDepois}
          formato={(x) => brl(x)}
          menorMelhor
        />
        <Delta
          rotulo="Leads"
          antes={antes.conversas}
          depois={depois.conversas}
          formato={(x) => inteiro(x)}
        />
        <Delta
          rotulo="Investido"
          antes={antes.gasto}
          depois={depois.gasto}
          formato={(x) => brl(x)}
        />
        <Delta
          rotulo="CPM"
          antes={antes.cpm}
          depois={depois.cpm}
          formato={(x) => brl(x)}
          menorMelhor
        />
      </div>

      {mudancas > 1 && (
        <span className="imp-aviso">
          {mudancas} alterações neste dia — o resultado é do conjunto delas, não
          de uma isolada.
        </span>
      )}

      {!confiavel && (
        <span className="imp-aviso">
          Menos de 5 leads em uma das janelas: a variação aí é oscilação do dia a
          dia, não efeito da mudança.
        </span>
      )}
    </div>
  );
}

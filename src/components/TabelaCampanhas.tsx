"use client";

import { useMemo, useState } from "react";
import type { Campanha } from "@/lib/meta";
import {
  brl,
  decimal,
  inteiro,
  objetivoPt,
  pct,
  statusPt,
} from "@/lib/format";

type Coluna = {
  id: keyof Campanha | "nome";
  rot: string;
  fmt?: (c: Campanha) => string;
  /** Menor é melhor (custo). Define a direção inicial da ordenação. */
  menorMelhor?: boolean;
};

const COLUNAS: Coluna[] = [
  { id: "nome", rot: "Campanha" },
  { id: "gasto", rot: "Investido", fmt: (c) => brl(c.gasto) },
  { id: "conversas", rot: "Conversas", fmt: (c) => inteiro(c.conversas) },
  {
    id: "custoConversa",
    rot: "R$/conversa",
    fmt: (c) => (c.conversas ? brl(c.custoConversa) : "sem retorno"),
    menorMelhor: true,
  },
  { id: "alcance", rot: "Alcance", fmt: (c) => inteiro(c.alcance) },
  { id: "frequencia", rot: "Freq.", fmt: (c) => decimal(c.frequencia) },
  { id: "impressoes", rot: "Impressões", fmt: (c) => inteiro(c.impressoes) },
  { id: "cliques", rot: "Cliques", fmt: (c) => inteiro(c.cliques) },
  { id: "ctr", rot: "CTR", fmt: (c) => pct(c.ctr) },
  { id: "cpc", rot: "CPC", fmt: (c) => brl(c.cpc), menorMelhor: true },
  { id: "cpm", rot: "CPM", fmt: (c) => brl(c.cpm), menorMelhor: true },
];

function classeStatus(s: string): string {
  if (s === "ACTIVE") return "ativa";
  if (s === "DISAPPROVED" || s === "WITH_ISSUES") return "problema";
  return "pausada";
}

export default function TabelaCampanhas({ campanhas }: { campanhas: Campanha[] }) {
  const [ordem, setOrdem] = useState<{ col: string; asc: boolean }>({
    col: "gasto",
    asc: false,
  });

  const ordenadas = useMemo(() => {
    const lista = [...campanhas];
    lista.sort((a, b) => {
      if (ordem.col === "nome") {
        return ordem.asc
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : b.nome.localeCompare(a.nome, "pt-BR");
      }
      const va = a[ordem.col as keyof Campanha];
      const vb = b[ordem.col as keyof Campanha];
      // Campanhas sem conversa não têm custo: vão sempre para o fim da lista.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const na = Number(va);
      const nb = Number(vb);
      return ordem.asc ? na - nb : nb - na;
    });
    return lista;
  }, [campanhas, ordem]);

  const custos = campanhas
    .filter((c) => c.custoConversa !== null)
    .map((c) => c.custoConversa as number);
  const melhor = custos.length ? Math.min(...custos) : null;
  const pior = custos.length ? Math.max(...custos) : null;

  function alternar(col: Coluna) {
    setOrdem((o) =>
      o.col === col.id
        ? { col: o.col, asc: !o.asc }
        : { col: String(col.id), asc: col.id === "nome" ? true : !!col.menorMelhor }
    );
  }

  if (campanhas.length === 0) {
    return (
      <div className="vazio">
        Nenhuma campanha com veiculação neste período.
      </div>
    );
  }

  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            {COLUNAS.map((c) => (
              <th
                key={String(c.id)}
                onClick={() => alternar(c)}
                aria-sort={
                  ordem.col === c.id
                    ? ordem.asc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                title={`Ordenar por ${c.rot}`}
              >
                {c.rot}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((c) => {
            const cc = c.custoConversa;
            const classe =
              c.conversas === 0
                ? "ruim"
                : cc !== null && cc === melhor
                  ? "bom"
                  : cc !== null && cc === pior
                    ? "ruim"
                    : "";
            return (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.nome}</div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-3)",
                      marginTop: 3,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className={`pastilha ${classeStatus(c.status)}`}>
                      {statusPt(c.status)}
                    </span>
                    <span>{objetivoPt(c.objetivo)}</span>
                    <span>· {c.conta}</span>
                  </div>
                </td>
                {COLUNAS.slice(1).map((col) => (
                  <td
                    key={String(col.id)}
                    className={col.id === "custoConversa" ? classe : ""}
                  >
                    {col.fmt ? col.fmt(c) : String(c[col.id as keyof Campanha])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

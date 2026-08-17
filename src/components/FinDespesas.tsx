"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Categoria, SaldoMes } from "@/lib/financeiro-comum";
import { brl, dataCurta } from "@/lib/format";

/**
 * Para onde o dinheiro foi, e como o mes se compara com os anteriores.
 *
 * As barras por categoria usam o previsto, nao o pago: despesa que ainda nao
 * saiu ja comprometeu o mes, e esconde-la ate a data do debito da a impressao
 * de sobra que nao existe. O quanto ja saiu aparece dentro da propria barra.
 */

const EIXO = { fontSize: 11, fontFamily: "var(--mono)" };

export function DespesasPorCategoria({
  despesas,
  titulo = "Despesas por categoria",
}: {
  despesas: Categoria[];
  titulo?: string;
}) {
  const total = despesas.reduce((t, d) => t + d.previsto, 0);
  const maior = despesas[0]?.previsto ?? 0;

  return (
    <div className="painel">
      <h2>{titulo}</h2>
      <p className="desc">
        {total > 0
          ? `${brl(total)} comprometidos no mês, em ${despesas.length} categoria(s).`
          : "Nenhuma despesa lançada neste mês."}
      </p>

      {despesas.length > 0 && (
        <div className="fin-categorias">
          {despesas.map((d) => (
            <div key={d.categoria} className="fin-categoria">
              <div className="fin-categoria-rot">
                <span>{d.categoria}</span>
                <b>{brl(d.previsto)}</b>
              </div>
              <div className="fin-trilho">
                <div
                  className="fin-barra"
                  style={{ width: `${maior ? (d.previsto / maior) * 100 : 0}%` }}
                >
                  {/* Faixa mais escura: a parte que já saiu da conta. */}
                  <div
                    className="fin-barra-paga"
                    style={{
                      width: `${d.previsto ? (d.pago / d.previsto) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="fin-categoria-obs">
                {d.itens} lançamento(s) · {brl(d.pago)} já pago ·{" "}
                {total ? ((d.previsto / total) * 100).toFixed(0) : 0}% do mês
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type PontoGrafico = SaldoMes & { rotulo: string };

export function EvolucaoMensal({ serie }: { serie: SaldoMes[] }) {
  const dados: PontoGrafico[] = serie.map((s) => ({
    ...s,
    rotulo: dataCurta(s.competencia),
  }));

  return (
    <div className="painel">
      <h2>Evolução</h2>
      <p className="desc">
        Entradas e saídas por competência, incluindo o que ainda está em aberto.
      </p>
      {dados.length === 0 ? (
        <p className="fin-vazio">Sem histórico ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="rotulo"
              tick={{ ...EIXO, fill: "var(--ink-3)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ ...EIXO, fill: "var(--ink-3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => brl(v, 0)}
              width={86}
            />
            <Tooltip content={<Caixa />} cursor={{ fill: "var(--border-2)" }} />
            <Legend
              wrapperStyle={{ fontSize: 12.5, paddingTop: 6 }}
              formatter={(v) => (v === "entradas" ? "Entradas" : "Saídas")}
            />
            <Bar dataKey="entradas" fill="var(--s1)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="saidas" fill="var(--s2)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** Nomes de props fixados pelo Recharts — ele injeta essas e nenhuma outra. */
function Caixa({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PontoGrafico }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const saldo = p.entradas - p.saidas;
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--surface)",
        padding: "9px 12px",
        borderRadius: 6,
        fontSize: 12.5,
        lineHeight: 1.5,
        boxShadow: "0 6px 22px rgba(0,0,0,.22)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.rotulo}</div>
      {[
        ["Entradas", brl(p.entradas)],
        ["Recebido", brl(p.recebido)],
        ["Saídas", brl(p.saidas)],
        ["Pago", brl(p.pago)],
        ["Saldo previsto", brl(saldo)],
      ].map(([k, v]) => (
        <div
          key={k}
          style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
        >
          <span>{k}</span>
          <b style={{ fontFamily: "var(--mono)" }}>{v}</b>
        </div>
      ))}
    </div>
  );
}

"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PontoSerie } from "@mark/integracoes/meta-ads";
import { brl, dataCurta, inteiro } from "@/lib/format";

type Props = { serie: PontoSerie[] };

const EIXO = { fontSize: 11, fontFamily: "var(--mono)" };

/**
 * Conteúdo do tooltip. Os nomes `active`, `payload` e `label` são fixados pelo
 * Recharts — ele injeta essas props e nenhuma outra.
 */
function Caixa({
  active,
  payload,
  label,
  linhas,
}: {
  active?: boolean;
  payload?: { payload: PontoSerie }[];
  label?: string | number;
  linhas: (p: PontoSerie) => [string, string][];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const rotulo = dataCurta(String(label ?? p.data));
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{rotulo}</div>
      {linhas(p).map(([k, v]) => (
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

/** Conversas iniciadas ao longo do tempo. */
export function GraficoConversas({ serie }: Props) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-conv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--s1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="data"
          tickFormatter={dataCurta}
          tick={{ ...EIXO, fill: "var(--ink-3)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          minTickGap={18}
        />
        <YAxis
          tick={{ ...EIXO, fill: "var(--ink-3)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={44}
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          content={
            <Caixa
              linhas={(p) => [
                ["Conversas", inteiro(p.conversas)],
                ["Custo/conversa", brl(p.custoConversa)],
                ["Investido", brl(p.gasto)],
              ]}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="conversas"
          stroke="var(--s1)"
          strokeWidth={2}
          fill="url(#grad-conv)"
          dot={serie.length <= 20 ? { r: 3, fill: "var(--s1)" } : false}
          activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
          name="Conversas"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Investimento por período. */
export function GraficoInvestimento({ serie }: Props) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={serie} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="data"
          tickFormatter={dataCurta}
          tick={{ ...EIXO, fill: "var(--ink-3)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          minTickGap={18}
        />
        <YAxis
          tick={{ ...EIXO, fill: "var(--ink-3)" }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          cursor={{ fill: "var(--border-2)" }}
          content={
            <Caixa
              linhas={(p) => [
                ["Investido", brl(p.gasto)],
                ["Impressões", inteiro(p.impressoes)],
                ["Cliques", inteiro(p.cliques)],
              ]}
            />
          }
        />
        <Bar dataKey="gasto" fill="var(--s2)" radius={[3, 3, 0, 0]} name="Investido" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Custo por conversa. A média do período entra como referência visual: barras
 * acima dela custaram mais que o normal da conta.
 */
export function GraficoCustoConversa({
  serie,
  media,
}: Props & { media: number | null }) {
  const dados = serie.filter((p) => p.custoConversa !== null);
  if (dados.length === 0) {
    return (
      <div className="vazio" style={{ padding: "48px 12px", fontSize: 14 }}>
        Nenhuma conversa iniciada neste período.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="data"
          tickFormatter={dataCurta}
          tick={{ ...EIXO, fill: "var(--ink-3)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          minTickGap={18}
        />
        <YAxis
          tick={{ ...EIXO, fill: "var(--ink-3)" }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          cursor={{ fill: "var(--border-2)" }}
          content={
            <Caixa
              linhas={(p) => [
                ["Custo/conversa", brl(p.custoConversa)],
                ["Conversas", inteiro(p.conversas)],
                ["Investido", brl(p.gasto)],
              ]}
            />
          }
        />
        <Bar dataKey="custoConversa" radius={[3, 3, 0, 0]} name="Custo por conversa">
          {dados.map((p, i) => (
            <Cell
              key={i}
              fill={
                media !== null && (p.custoConversa ?? 0) > media
                  ? "var(--s2)"
                  : "var(--s1)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

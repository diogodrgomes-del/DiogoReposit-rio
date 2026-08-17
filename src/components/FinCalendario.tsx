"use client";

import { useMemo, useState } from "react";
import type { Feriado } from "@/lib/feriados";
import type { Lancamento } from "@/lib/financeiro-comum";
import { brl, dataLonga } from "@/lib/format";
import { fimDeSemana } from "@/lib/feriados";
import { textoSituacao } from "./FinSituacao";

/**
 * O mes visto como calendario, e nao como lista.
 *
 * Uma tabela ordenada por vencimento diz o que vence; o calendario diz quando
 * o mes aperta — tres boletos na mesma segunda-feira e uma informacao que so
 * aparece no formato de grade. Feriado marcado no lugar certo evita a conta
 * errada de "cai na sexta, recebo na sexta".
 */

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Props = {
  mes: string; // YYYY-MM
  hoje: string;
  lancamentos: Lancamento[];
  feriados: Feriado[];
};

/** Colunas vazias antes do dia 1, com a semana comecando na segunda. */
function deslocamento(ano: number, mes: number): number {
  return (new Date(Date.UTC(ano, mes, 1)).getUTCDay() + 6) % 7;
}

export default function FinCalendario({ mes, hoje, lancamentos, feriados }: Props) {
  const [ano, mesNum] = mes.split("-").map(Number);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Lancamento[]>();
    for (const l of lancamentos) {
      const lista = mapa.get(l.vencimento) ?? [];
      lista.push(l);
      mapa.set(l.vencimento, lista);
    }
    return mapa;
  }, [lancamentos]);

  const feriadoPorDia = useMemo(
    () => new Map(feriados.map((f) => [f.data, f])),
    [feriados]
  );

  const total = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
  const antes = deslocamento(ano, mesNum - 1);

  const celulas: React.ReactNode[] = [];
  for (let i = 0; i < antes; i++) {
    celulas.push(<span key={`v${i}`} className="fin-cal-vazio" />);
  }

  for (let d = 1; d <= total; d++) {
    const data = `${mes}-${String(d).padStart(2, "0")}`;
    const doDia = porDia.get(data) ?? [];
    const feriado = feriadoPorDia.get(data);
    const entradas = doDia.filter((l) => l.tipo === "entrada");
    const saidas = doDia.filter((l) => l.tipo === "saida");
    const vencido = doDia.some((l) => !l.pagoEm && data < hoje);

    const classes = [
      "fin-cal-dia",
      data === hoje ? "hoje" : "",
      feriado ? "feriado" : "",
      fimDeSemana(data) ? "fds" : "",
      selecionado === data ? "sel" : "",
      vencido ? "alerta" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const titulo = [
      dataLonga(data),
      feriado ? `${feriado.nome}${feriado.tipo === "bancario" ? " (sem expediente bancário)" : ""}` : "",
      doDia.length ? `${doDia.length} lançamento(s)` : "",
    ]
      .filter(Boolean)
      .join(" — ");

    celulas.push(
      <button
        key={data}
        type="button"
        className={classes}
        title={titulo}
        aria-pressed={selecionado === data}
        onClick={() => setSelecionado((s) => (s === data ? null : data))}
      >
        <span className="fin-cal-num">{d}</span>
        {feriado && <span className="fin-cal-feriado">{feriado.nome}</span>}
        {entradas.length > 0 && (
          <span className="fin-cal-valor entrada">+{brl(soma(entradas), 0)}</span>
        )}
        {saidas.length > 0 && (
          <span className="fin-cal-valor saida">−{brl(soma(saidas), 0)}</span>
        )}
      </button>
    );
  }

  const detalhe = selecionado ? (porDia.get(selecionado) ?? []) : [];
  const feriadoSel = selecionado ? feriadoPorDia.get(selecionado) : undefined;

  return (
    <div className="painel">
      <h2>Calendário — {MESES_LONGOS[mesNum - 1]} de {ano}</h2>
      <p className="desc">
        Vencimentos do mês sobre o calendário brasileiro. Dias em destaque são
        feriados nacionais; os marcados em cinza não têm compensação bancária.
      </p>

      <div className="fin-cal-grade fin-cal-cab">
        {DIAS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="fin-cal-grade">{celulas}</div>

      {selecionado && (
        <div className="fin-cal-detalhe">
          <strong>{dataLonga(selecionado)}</strong>
          {feriadoSel && (
            <span className="fin-cal-nota">
              {feriadoSel.nome}
              {feriadoSel.tipo === "bancario" && " — banco fechado"}
            </span>
          )}
          {detalhe.length === 0 ? (
            <span className="fin-cal-nota">Nenhum lançamento neste dia.</span>
          ) : (
            <ul>
              {detalhe.map((l) => (
                <li key={l.id}>
                  <span className={l.tipo === "entrada" ? "bom" : "ruim"}>
                    {l.tipo === "entrada" ? "+" : "−"}
                    {brl(l.valor)}
                  </span>{" "}
                  {l.descricao}
                  {l.cliente ? ` · ${l.cliente}` : ""}{" "}
                  <em>{textoSituacao(l, hoje)}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {feriados.length > 0 && (
        <p className="fin-cal-legenda">
          Feriados: {feriados.map((f) => `${f.data.slice(8)} ${f.nome}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

function soma(lista: Lancamento[]): number {
  return lista.reduce((t, l) => t + l.valor, 0);
}

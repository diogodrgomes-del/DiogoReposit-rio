"use client";

import type { Orcamento as Dados } from "@mark/integracoes/meta-ads";
import { brl, dataLonga, inteiro } from "@/lib/format";

type Props = {
  orcamentos: Dados[];
  /** Gasto médio por dia no período, para estimar a duração do saldo. */
  gastoDiario: number | null;
};

function diasAtras(iso: string): number | null {
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export default function Orcamento({ orcamentos, gastoDiario }: Props) {
  if (!orcamentos.length) return null;

  // Com várias contas selecionadas, os valores somam e o aporte é o mais recente.
  const disponivel = orcamentos.reduce<number | null>((s, o) => {
    if (o.disponivel === null) return s;
    return (s ?? 0) + o.disponivel;
  }, null);

  const aportes = orcamentos
    .map((o) => o.ultimoAporte)
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => b.data.localeCompare(a.data));
  const ultimo = aportes[0] ?? null;

  const dias = ultimo ? diasAtras(ultimo.data) : null;
  const duracao =
    disponivel !== null && gastoDiario && gastoDiario > 0
      ? Math.floor(disponivel / gastoDiario)
      : null;

  return (
    <div className="orcamento">
      <div className="orc-item">
        <span className="orc-rot">Último aporte</span>
        <span className="orc-val">
          {ultimo ? dataLonga(ultimo.data) : "—"}
        </span>
        <span className="orc-obs">
          {ultimo
            ? `${brl(ultimo.valor)}${
                dias === null
                  ? ""
                  : dias === 0
                    ? " · hoje"
                    : dias === 1
                      ? " · há 1 dia"
                      : ` · há ${dias} dias`
              }`
            : "nenhum aporte registrado"}
        </span>
      </div>

      <div className="orc-item">
        <span className="orc-rot">Orçamento disponível</span>
        <span className={`orc-val ${disponivel !== null && disponivel <= 0 ? "esgotado" : "saldo"}`}>
          {disponivel === null ? "sem teto definido" : brl(disponivel)}
        </span>
        <span className="orc-obs">
          {disponivel === null
            ? "a conta não tem limite de gasto"
            : duracao === null
              ? "ainda para gastar"
              : duracao === 0
                ? "acaba hoje no ritmo atual"
                : `cerca de ${inteiro(duracao)} dia(s) no ritmo atual`}
        </span>
      </div>

      <div className="orc-item">
        <span className="orc-rot">Total investido na conta</span>
        <span className="orc-val">
          {brl(orcamentos.reduce((s, o) => s + o.gastoAcumulado, 0))}
        </span>
        <span className="orc-obs">desde a criação</span>
      </div>

      {orcamentos.length === 1 && orcamentos[0].aportes.length > 1 && (
        <details className="orc-hist">
          <summary>Aportes anteriores</summary>
          <ul>
            {orcamentos[0].aportes.map((a, i) => (
              <li key={`${a.data}-${i}`}>
                <span>{dataLonga(a.data)}</span>
                <b>{brl(a.valor)}</b>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="orc-nota">
        Valores como a Meta devolve, sem desconto de imposto. O aporte entra
        cheio e o imposto é cobrado depois, junto com a veiculação de cada dia —
        a estimativa dele está na faixa abaixo.
      </p>
    </div>
  );
}

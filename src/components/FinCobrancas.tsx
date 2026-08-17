"use client";

import { useMemo } from "react";
import type { Area, Lancamento, Recorrencia } from "@/lib/financeiro-comum";
import { brl, dataLonga } from "@/lib/format";
import { diasEntreDatas, precisaCobrar } from "@/lib/recorrencia";
import { AcoesPagamento, PastilhaSituacao, textoSituacao } from "./FinSituacao";

/**
 * A agenda: o que precisa ser cobrado e o que precisa ser pago.
 *
 * Puxa de todas as competencias, nao so do mes aberto — a fatura de marco que
 * ninguem pagou continua sendo dinheiro a receber em agosto, e some da tela se
 * a lista respeitar o filtro de mes.
 *
 * A ordem e por vencimento, do mais velho para o mais novo: o topo da lista e
 * sempre o que doi mais.
 */

type Props = {
  area: Area;
  hoje: string;
  pendentes: Lancamento[];
  recorrencias: Recorrencia[];
  ocupado: boolean;
  onPagar: (id: number, pagoEm: string, forma: string) => void;
  onDesfazer: (id: number) => void;
  onCobrar: (id: number, cobrado: boolean) => void;
};

export default function FinCobrancas({
  area,
  hoje,
  pendentes,
  recorrencias,
  ocupado,
  onPagar,
  onDesfazer,
  onCobrar,
}: Props) {
  // Cada contrato decide com quantos dias de antecedência quer ser lembrado;
  // lançamento avulso usa três, que é o padrão do cadastro.
  const lembretePorRecorrencia = useMemo(
    () => new Map(recorrencias.map((r) => [r.id, r.lembreteDias])),
    [recorrencias]
  );

  const receber = pendentes.filter((l) => l.tipo === "entrada");
  const pagar = pendentes.filter((l) => l.tipo === "saida");

  const aCobrar = receber.filter((l) =>
    precisaCobrar(
      l.vencimento,
      l.pagoEm,
      (l.recorrenciaId && lembretePorRecorrencia.get(l.recorrenciaId)) ?? 3,
      hoje
    )
  );

  return (
    <div className="painel">
      <h2>{area === "marktiva" ? "Cobranças e contas" : "Contas do mês"}</h2>
      <p className="desc">
        {area === "marktiva"
          ? "Quem precisa ser cobrado hoje e o que a empresa tem a pagar."
          : "O que entra e o que sai, ainda em aberto."}
      </p>

      {aCobrar.length > 0 && (
        <div className="fin-lembrete">
          <strong>
            {aCobrar.length === 1
              ? "1 cobrança para hoje"
              : `${aCobrar.length} cobranças para hoje`}
          </strong>
          <span>
            {brl(aCobrar.reduce((t, l) => t + l.valor, 0))} ·{" "}
            {aCobrar.filter((l) => l.vencimento < hoje).length} já vencida(s)
          </span>
        </div>
      )}

      <Bloco
        titulo={area === "marktiva" ? "A receber" : "Entradas em aberto"}
        vazio="Nada a receber em aberto."
        itens={receber}
        hoje={hoje}
        ocupado={ocupado}
        onPagar={onPagar}
        onDesfazer={onDesfazer}
        onCobrar={area === "marktiva" ? onCobrar : undefined}
        lembretes={lembretePorRecorrencia}
      />

      <Bloco
        titulo="A pagar"
        vazio="Nenhuma conta em aberto."
        itens={pagar}
        hoje={hoje}
        ocupado={ocupado}
        onPagar={onPagar}
        onDesfazer={onDesfazer}
        lembretes={lembretePorRecorrencia}
      />
    </div>
  );
}

function Bloco({
  titulo,
  vazio,
  itens,
  hoje,
  ocupado,
  onPagar,
  onDesfazer,
  onCobrar,
  lembretes,
}: {
  titulo: string;
  vazio: string;
  itens: Lancamento[];
  hoje: string;
  ocupado: boolean;
  onPagar: (id: number, pagoEm: string, forma: string) => void;
  onDesfazer: (id: number) => void;
  onCobrar?: (id: number, cobrado: boolean) => void;
  lembretes: Map<number, number>;
}) {
  const total = itens.reduce((t, l) => t + l.valor, 0);

  return (
    <section className="fin-bloco">
      <div className="fin-bloco-cab">
        <h3>{titulo}</h3>
        <span>{brl(total)}</span>
      </div>

      {itens.length === 0 ? (
        <p className="fin-vazio">{vazio}</p>
      ) : (
        <ul className="fin-lista">
          {itens.map((l) => {
            const dias = diasEntreDatas(hoje, l.vencimento);
            const lembrete =
              (l.recorrenciaId && lembretes.get(l.recorrenciaId)) ?? 3;
            const urgente = dias <= lembrete;
            return (
              <li key={l.id} className={urgente ? "fin-item urgente" : "fin-item"}>
                <div className="fin-item-topo">
                  <span className="fin-item-nome">
                    {l.descricao}
                    {l.cliente && <em> · {l.cliente}</em>}
                    {l.recorrenciaId && (
                      <span className="fin-tag" title="Gerado por contrato recorrente">
                        recorrente
                      </span>
                    )}
                  </span>
                  <span className="fin-item-valor">{brl(l.valor)}</span>
                </div>
                <div className="fin-item-meta">
                  <PastilhaSituacao l={l} hoje={hoje} />
                  <span>
                    vence {dataLonga(l.vencimento)} — {textoSituacao(l, hoje)}
                  </span>
                  {l.cobradoEm && (
                    <span className="fin-tag ok">
                      cobrado em {dataLonga(l.cobradoEm.slice(0, 10))}
                    </span>
                  )}
                </div>
                <AcoesPagamento
                  l={l}
                  hoje={hoje}
                  ocupado={ocupado}
                  onPagar={onPagar}
                  onDesfazer={onDesfazer}
                  onCobrar={onCobrar}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

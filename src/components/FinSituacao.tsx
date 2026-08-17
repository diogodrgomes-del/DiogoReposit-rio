"use client";

import { useState } from "react";
import type { Lancamento } from "@/lib/financeiro-comum";
import { FORMAS } from "@/lib/financeiro-comum";
import {
  diasEntreDatas,
  pontualidadeDe,
  situacaoDe,
} from "@/lib/recorrencia";
import { dataLonga } from "@/lib/format";

/**
 * Como uma cobranca aparece e como se da baixa nela.
 *
 * Fica num arquivo so porque a agenda de cobranca e a tabela de lancamentos
 * fazem a mesma pergunta e oferecem os mesmos botoes — duas copias divergiriam
 * na primeira mudanca de regra.
 */

/** Texto curto do estado: pago (com pontualidade) ou quanto falta/atrasou. */
export function textoSituacao(l: Lancamento, hoje: string): string {
  if (l.pagoEm) {
    const { pontualidade, dias } = pontualidadeDe(l.vencimento, l.pagoEm);
    if (pontualidade === "em_dia") return "Pago em dia";
    const plural = dias === 1 ? "dia" : "dias";
    return pontualidade === "atrasado"
      ? `Pago com ${dias} ${plural} de atraso`
      : `Pago ${dias} ${plural} adiantado`;
  }
  const faltam = diasEntreDatas(hoje, l.vencimento);
  if (faltam === 0) return "Vence hoje";
  if (faltam < 0) {
    const d = -faltam;
    return `Vencido há ${d} ${d === 1 ? "dia" : "dias"}`;
  }
  return `Vence em ${faltam} ${faltam === 1 ? "dia" : "dias"}`;
}

export function PastilhaSituacao({
  l,
  hoje,
}: {
  l: Lancamento;
  hoje: string;
}) {
  const situacao = situacaoDe(l.vencimento, l.pagoEm, hoje);

  if (l.pagoEm) {
    const { pontualidade, dias } = pontualidadeDe(l.vencimento, l.pagoEm);
    // Pago com atraso continua sendo pago — o alerta é âmbar, não vermelho,
    // porque o dinheiro entrou; o que ficou foi a informação sobre o cliente.
    const classe = pontualidade === "atrasado" ? "atrasado" : "pago";
    const rotulo =
      pontualidade === "em_dia"
        ? "Em dia"
        : pontualidade === "atrasado"
          ? `Atrasado ${dias}d`
          : `Adiantado ${dias}d`;
    return (
      <span
        className={`pastilha fin-${classe}`}
        title={`${textoSituacao(l, hoje)} — pagamento em ${dataLonga(l.pagoEm)}`}
      >
        {rotulo}
      </span>
    );
  }

  const classe =
    situacao === "vencido"
      ? "vencido"
      : situacao === "vence_hoje"
        ? "hoje"
        : "aberto";
  const rotulo =
    situacao === "vencido"
      ? "Vencido"
      : situacao === "vence_hoje"
        ? "Vence hoje"
        : "A vencer";
  return (
    <span className={`pastilha fin-${classe}`} title={textoSituacao(l, hoje)}>
      {rotulo}
    </span>
  );
}

type PropsAcoes = {
  l: Lancamento;
  hoje: string;
  ocupado: boolean;
  onPagar: (id: number, pagoEm: string, forma: string) => void;
  onDesfazer: (id: number) => void;
  /** Ausente onde não faz sentido registrar cobrança (saídas, área pessoal). */
  onCobrar?: (id: number, cobrado: boolean) => void;
};

/**
 * Botoes de baixa.
 *
 * "Registrar" abre a data e a forma em vez de dar baixa direto: a diferenca
 * entre pago hoje e pago na semana passada e exatamente o que decide se o
 * cliente pagou em dia — dar baixa com a data de hoje sempre apagaria essa
 * informacao.
 */
export function AcoesPagamento({
  l,
  hoje,
  ocupado,
  onPagar,
  onDesfazer,
  onCobrar,
}: PropsAcoes) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState(l.forma ?? "Pix");

  if (l.pagoEm) {
    return (
      <div className="fin-acoes">
        <button
          type="button"
          className="btn btn-mini"
          disabled={ocupado}
          onClick={() => onDesfazer(l.id)}
          title="Desfazer a baixa e voltar para em aberto"
        >
          Desfazer baixa
        </button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="fin-acoes">
        <button
          type="button"
          className="btn btn-mini btn-primario"
          disabled={ocupado}
          onClick={() => setAberto(true)}
        >
          {l.tipo === "entrada" ? "Recebi" : "Paguei"}
        </button>
        {onCobrar && (
          <button
            type="button"
            className={`btn btn-mini${l.cobradoEm ? " fin-marcado" : ""}`}
            disabled={ocupado}
            onClick={() => onCobrar(l.id, !l.cobradoEm)}
            title={
              l.cobradoEm
                ? `Cobrança enviada em ${dataLonga(l.cobradoEm.slice(0, 10))} — clique para desmarcar`
                : "Marcar que a cobrança já foi enviada ao cliente"
            }
          >
            {l.cobradoEm ? "✓ Cobrado" : "Cobrar"}
          </button>
        )}
      </div>
    );
  }

  const previa = pontualidadeDe(l.vencimento, data);

  return (
    <div className="fin-baixa">
      <label>
        <span>Data</span>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          max={hoje}
        />
      </label>
      <label>
        <span>Forma</span>
        <select value={forma} onChange={(e) => setForma(e.target.value)}>
          {FORMAS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <span
        className={`pastilha fin-${
          previa.pontualidade === "atrasado" ? "atrasado" : "pago"
        }`}
      >
        {previa.pontualidade === "em_dia"
          ? "Em dia"
          : previa.pontualidade === "atrasado"
            ? `${previa.dias}d de atraso`
            : `${previa.dias}d adiantado`}
      </span>
      <button
        type="button"
        className="btn btn-mini btn-primario"
        disabled={ocupado || !data}
        onClick={() => {
          onPagar(l.id, data, forma);
          setAberto(false);
        }}
      >
        Confirmar
      </button>
      <button
        type="button"
        className="btn btn-mini"
        disabled={ocupado}
        onClick={() => setAberto(false)}
      >
        Cancelar
      </button>
    </div>
  );
}

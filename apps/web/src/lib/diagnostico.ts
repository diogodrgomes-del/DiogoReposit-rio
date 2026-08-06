import type { Campanha } from "./meta";

export type Acao = "pausar" | "escalar" | "revisar" | "renovar" | "reativar";

export type Recomendacao = {
  id: string;
  campanha: string;
  acao: Acao;
  /** 1 = age hoje, 2 = esta semana, 3 = quando puder. */
  prioridade: 1 | 2 | 3;
  titulo: string;
  motivo: string;
};

export const ROTULO_ACAO: Record<Acao, string> = {
  pausar: "Pausar",
  escalar: "Escalar",
  revisar: "Revisar",
  renovar: "Renovar criativo",
  reativar: "Reativar",
};

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: number) => Math.round(v).toLocaleString("pt-BR");

const ativa = (c: Campanha) => c.status === "ACTIVE";

/**
 * Recomendações por campanha, derivadas só dos números do período.
 *
 * Os limiares são relativos à média da própria conta, nunca absolutos: um CPC
 * de R$ 5 é caro numa conta que roda a R$ 1 e barato numa que roda a R$ 12.
 * Um valor fixo daria conselho errado para metade da carteira.
 *
 * Amostras pequenas não geram recomendação. Chamar de "vencedora" uma campanha
 * com 2 conversas é ruído, e agir sobre isso custa dinheiro de verdade.
 */
export function diagnosticar(campanhas: Campanha[]): Recomendacao[] {
  const comGasto = campanhas.filter((c) => c.gasto > 0);
  if (comGasto.length === 0) return [];

  const gastoTotal = comGasto.reduce((s, c) => s + c.gasto, 0);
  const conversasTotal = comGasto.reduce((s, c) => s + c.conversas, 0);
  // Sem nenhuma conversa na conta não há régua de eficiência para comparar.
  const media = conversasTotal > 0 ? gastoTotal / conversasTotal : null;

  const comConversa = comGasto.filter((c) => c.conversas > 0);
  const melhor = comConversa.length
    ? Math.min(...comConversa.map((c) => c.custoConversa as number))
    : null;

  const recs: Recomendacao[] = [];

  for (const c of comGasto) {
    const fatia = c.gasto / gastoTotal;
    const cc = c.custoConversa;

    // --- gasto sem nenhuma conversa ---------------------------------------
    if (c.conversas === 0) {
      // Verba irrisória ainda não prova nada; pode ser campanha recém-subida.
      if (c.gasto >= gastoTotal * 0.03 || c.gasto >= 50) {
        recs.push({
          id: c.id,
          campanha: c.nome,
          acao: ativa(c) ? "pausar" : "revisar",
          prioridade: ativa(c) ? 1 : 3,
          titulo: ativa(c)
            ? `Pausar: ${brl(c.gasto)} sem nenhuma conversa`
            : `Sem retorno: ${brl(c.gasto)} e nenhuma conversa`,
          motivo: ativa(c)
            ? `Consumiu ${brl(c.gasto)} (${(fatia * 100).toFixed(1)}% da verba) e ` +
              `${num(c.cliques)} cliques sem gerar uma única conversa. ` +
              `Cada dia ativa custa dinheiro sem retorno mensurável.`
            : `Gastou ${brl(c.gasto)} sem conversa. Já está parada — vale entender ` +
              `o que não funcionou antes de repetir o formato.`,
        });
      }
      continue;
    }

    if (cc === null || media === null) continue;

    // --- muito acima da média da conta -------------------------------------
    if (cc > media * 2 && c.conversas >= 3) {
      recs.push({
        id: c.id,
        campanha: c.nome,
        acao: ativa(c) ? "revisar" : "revisar",
        prioridade: ativa(c) && fatia > 0.15 ? 1 : 2,
        titulo: `Custo ${(cc / media).toFixed(1)}× acima da média da conta`,
        motivo:
          `Cada conversa sai a ${brl(cc)}, contra ${brl(media)} de média. ` +
          `Levou ${brl(c.gasto)} para ${num(c.conversas)} conversas` +
          (fatia > 0.15
            ? `, e é ${(fatia * 100).toFixed(0)}% de toda a verba do período — ` +
              `é onde o dinheiro está sendo perdido.`
            : `. Público, criativo ou oferta precisam de ajuste.`),
      });
    }

    // --- público saturado ---------------------------------------------------
    if (c.frequencia >= 3 && ativa(c)) {
      recs.push({
        id: c.id,
        campanha: c.nome,
        acao: "renovar",
        prioridade: c.frequencia >= 4 ? 1 : 2,
        titulo: `Frequência ${c.frequencia.toFixed(2)}: público saturando`,
        motivo:
          `Cada pessoa já viu o anúncio ${c.frequencia.toFixed(1)} vezes ` +
          `(${num(c.alcance)} pessoas, ${num(c.impressoes)} impressões). ` +
          `Daqui em diante o custo sobe sem ganho: renove o criativo ou amplie o público.`,
      });
    }

    // --- vencedora com espaço para crescer ----------------------------------
    const eficiente = cc <= media * 0.6;
    const amostraBoa = c.conversas >= 8;
    const temEspaco = c.frequencia < 2.5;
    const pequena = fatia < 0.2;

    if (eficiente && amostraBoa && temEspaco && pequena && ativa(c)) {
      recs.push({
        id: c.id,
        campanha: c.nome,
        acao: "escalar",
        prioridade: 1,
        titulo: `Escalar: ${brl(cc)} por conversa, ${(media / cc).toFixed(1)}× melhor que a média`,
        motivo:
          `${num(c.conversas)} conversas por ${brl(c.gasto)} — apenas ` +
          `${(fatia * 100).toFixed(0)}% da verba. Frequência em ` +
          `${c.frequencia.toFixed(2)}, então o público ainda não saturou. ` +
          `É a melhor relação da conta e está subaproveitada.`,
      });
    }

    // --- vencedora parada ---------------------------------------------------
    if (!ativa(c) && melhor !== null && cc <= media * 0.7 && amostraBoa) {
      recs.push({
        id: c.id,
        campanha: c.nome,
        acao: "reativar",
        prioridade: 2,
        titulo: `Pausada, mas entregava a ${brl(cc)} por conversa`,
        motivo:
          `Gerou ${num(c.conversas)} conversas a ${brl(cc)} cada, contra ` +
          `${brl(media)} da média da conta. Está parada. Reativar custa menos ` +
          `que montar campanha nova do zero.`,
      });
    }
  }

  // Prioridade primeiro; dentro dela, quem move mais dinheiro.
  const gastoDe = new Map(campanhas.map((c) => [c.id, c.gasto]));
  return recs.sort(
    (a, b) =>
      a.prioridade - b.prioridade ||
      (gastoDe.get(b.id) ?? 0) - (gastoDe.get(a.id) ?? 0)
  );
}

"use client";

import { useMemo, useState } from "react";
import type { Campanha } from "@mark/integracoes/meta-ads";
import { ROTULO_ACAO, diagnosticar, type Acao } from "@/lib/diagnostico";

const CLASSE: Record<Acao, string> = {
  pausar: "rec-pausar",
  escalar: "rec-escalar",
  revisar: "rec-revisar",
  renovar: "rec-renovar",
  reativar: "rec-reativar",
};

const URGENCIA = ["", "Agir hoje", "Esta semana", "Quando puder"];

export default function Diagnostico({ campanhas }: { campanhas: Campanha[] }) {
  const [aberto, setAberto] = useState(true);
  const recs = useMemo(() => diagnosticar(campanhas), [campanhas]);

  const contagem = useMemo(() => {
    const m = new Map<Acao, number>();
    for (const r of recs) m.set(r.acao, (m.get(r.acao) ?? 0) + 1);
    return m;
  }, [recs]);

  return (
    <section className="diag">
      <div className="diag-topo">
        <div>
          <h2>Recomendações</h2>
          <p className="desc">
            {recs.length === 0
              ? "Nenhum ajuste evidente nos números deste período."
              : `${recs.length} ${recs.length === 1 ? "ponto" : "pontos"} de atenção nas campanhas do período.`}
          </p>
        </div>
        <button
          className="btn nao-imprime"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
        >
          {aberto ? "Ocultar" : "Mostrar"} recomendações
        </button>
      </div>

      {aberto && recs.length > 0 && (
        <>
          <div className="diag-resumo">
            {[...contagem.entries()].map(([acao, n]) => (
              <span key={acao} className={`rec-tag ${CLASSE[acao]}`}>
                {ROTULO_ACAO[acao]} · {n}
              </span>
            ))}
          </div>

          <div className="diag-lista">
            {recs.map((r, i) => (
              <article key={`${r.id}-${i}`} className={`rec ${CLASSE[r.acao]}`}>
                <div className="rec-cab">
                  <span className="rec-acao">{ROTULO_ACAO[r.acao]}</span>
                  <span className="rec-urgencia">{URGENCIA[r.prioridade]}</span>
                </div>
                <h3>{r.titulo}</h3>
                <p className="rec-campanha">{r.campanha}</p>
                <p className="rec-motivo">{r.motivo}</p>
              </article>
            ))}
          </div>

          <p className="nota-metrica">
            Leitura automática dos números do período selecionado, comparando cada
            campanha com a média da própria conta. Amostras pequenas ficam de fora
            de propósito: chamar de vencedora uma campanha com duas conversas é
            ruído, e agir sobre isso custa dinheiro. Mudar o período muda as
            recomendações.
          </p>
        </>
      )}

      {aberto && recs.length === 0 && campanhas.length > 0 && (
        <div className="vazio" style={{ padding: "32px 12px", fontSize: 14 }}>
          Nenhuma campanha destoa da média da conta neste período.
        </div>
      )}
    </section>
  );
}

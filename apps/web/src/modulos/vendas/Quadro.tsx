"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { formatarTelefone, type CardLead, type Coluna } from "@mark/core/navegador";
import { moverLead } from "./acoes";

/**
 * Quadro Kanban comercial.
 *
 * Arrastar usa a API nativa de drag and drop do navegador — sem biblioteca.
 * Para um quadro de colunas e cards ela basta, e evita 40KB de JavaScript que
 * o usuário baixaria em toda visita.
 *
 * O card se move na tela **antes** da resposta do servidor (`useOptimistic`).
 * Se a gravação falhar, ele volta ao lugar e um aviso explica por quê — em vez
 * de o card parecer ter ido e a página discordar no próximo refresh.
 */

type Movimento = { leadId: string; etapaId: string; antesDe: string | null };

function aplicar(colunas: Coluna[], m: Movimento): Coluna[] {
  let card: CardLead | undefined;

  const semCard = colunas.map((c) => ({
    ...c,
    cards: c.cards.filter((x) => {
      if (x.id !== m.leadId) return true;
      card = x;
      return false;
    }),
  }));

  if (!card) return colunas;
  const movido = card;

  return semCard.map((c) => {
    if (c.id !== m.etapaId) return c;
    const cards = [...c.cards];
    const alvo = m.antesDe ? cards.findIndex((x) => x.id === m.antesDe) : cards.length;
    cards.splice(alvo < 0 ? cards.length : alvo, 0, { ...movido, etapaId: m.etapaId });
    return { ...c, cards };
  });
}

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const CLASSE_TEMPERATURA: Record<string, string> = {
  quente: "selo--vermelho",
  morno: "selo--ambar",
  frio: "",
};

export function Quadro({ colunas, podeEditar }: { colunas: Coluna[]; podeEditar: boolean }) {
  const [otimista, moverOtimista] = useOptimistic(colunas, aplicar);
  const [, iniciar] = useTransition();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function soltar(etapaId: string, antesDe: string | null) {
    const leadId = arrastando;
    setArrastando(null);
    if (!leadId) return;

    setErro(null);
    iniciar(async () => {
      moverOtimista({ leadId, etapaId, antesDe });
      const r = await moverLead(leadId, etapaId, antesDe);
      // Falhou: o estado otimista é descartado no fim da transição e o card
      // volta sozinho. O aviso conta o motivo.
      if (!r.ok) setErro(r.erro ?? "Não foi possível mover o card.");
    });
  }

  return (
    <>
      {erro && (
        <p className="aviso-erro" role="alert">
          {erro}
        </p>
      )}

      <div className="quadro">
        {otimista.map((coluna) => (
          <section
            key={coluna.id}
            className="quadro__coluna"
            onDragOver={(e) => {
              if (podeEditar) e.preventDefault();
            }}
            onDrop={() => podeEditar && soltar(coluna.id, null)}
            aria-label={coluna.nome}
          >
            <header className="quadro__cabeca">
              <span>{coluna.nome}</span>
              <span className="quadro__contagem">{coluna.cards.length}</span>
            </header>

            <div className="quadro__cards">
              {coluna.cards.length === 0 && (
                <p className="quadro__vazio">
                  {podeEditar ? "Arraste um card para cá" : "Nenhum lead"}
                </p>
              )}

              {coluna.cards.map((card) => (
                <article
                  key={card.id}
                  className="quadro__card"
                  draggable={podeEditar}
                  onDragStart={() => setArrastando(card.id)}
                  onDragEnd={() => setArrastando(null)}
                  onDrop={(e) => {
                    if (!podeEditar) return;
                    e.stopPropagation();
                    soltar(coluna.id, card.id);
                  }}
                  onDragOver={(e) => podeEditar && e.preventDefault()}
                >
                  <Link href={`/vendas/${card.id}`} className="quadro__nome">
                    {card.nome}
                  </Link>

                  {card.empresa && <p className="quadro__linha">{card.empresa}</p>}
                  {card.telefone && (
                    <p className="quadro__linha">{formatarTelefone(card.telefone)}</p>
                  )}

                  <div className="quadro__pe">
                    {card.valorEstimado !== null && (
                      <strong>{moeda.format(card.valorEstimado)}</strong>
                    )}
                    {card.temperatura && (
                      <span className={`selo ${CLASSE_TEMPERATURA[card.temperatura] ?? ""}`}>
                        {card.temperatura}
                      </span>
                    )}
                  </div>

                  {card.responsavelNome && (
                    <p className="quadro__responsavel">{card.responsavelNome}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

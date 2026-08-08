"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";

export type ColunaKanban = {
  id: string;
  nome: string;
  tipo?: "ABERTO" | "GANHO" | "PERDIDO";
};

export type CardKanban = {
  id: string;
  stageId: string;
  posicao: number;
};

export type ResultadoMover =
  | { ok: true }
  | { ok: false; erro: string };

/**
 * Quadro genérico, usado pelo pipeline de vendas e pelo de demandas.
 *
 * Ordenação fracionária: soltar um card entre dois outros grava a média das
 * posições vizinhas — UMA linha atualizada, não a coluna inteira. Com
 * `ordem: int` sequencial, cada arraste reescreveria dezenas de registros.
 */
export function Kanban<T extends CardKanban>({
  colunas,
  cards,
  aoMover,
  renderCard,
  rodapeColuna,
  vazioColuna,
}: {
  colunas: ColunaKanban[];
  cards: T[];
  aoMover: (
    cardId: string,
    stageId: string,
    posicao: number
  ) => Promise<ResultadoMover>;
  renderCard: (card: T, arrastando: boolean) => React.ReactNode;
  rodapeColuna?: (coluna: ColunaKanban) => React.ReactNode;
  vazioColuna?: (coluna: ColunaKanban) => React.ReactNode;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  // UI otimista: o card muda de coluna na hora e o servidor confirma depois.
  const [otimistas, aplicarOtimista] = useOptimistic(
    cards,
    (estado: T[], mov: { id: string; stageId: string; posicao: number }) =>
      estado.map((c) =>
        c.id === mov.id ? { ...c, stageId: mov.stageId, posicao: mov.posicao } : c
      )
  );

  const sensores = useSensors(
    // 5px antes de considerar arraste: sem isso, clicar no card para abrir
    // vira arraste acidental e a ficha nunca abre.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const porColuna = useMemo(() => {
    const mapa = new Map<string, T[]>();
    for (const col of colunas) mapa.set(col.id, []);
    for (const card of otimistas) {
      const lista = mapa.get(card.stageId);
      if (lista) lista.push(card);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.posicao - b.posicao);
    return mapa;
  }, [colunas, otimistas]);

  function aoIniciar(e: DragStartEvent) {
    setArrastando(String(e.active.id));
  }

  function aoTerminar(e: DragEndEvent) {
    setArrastando(null);
    const { active, over } = e;
    if (!over) return;

    const cardId = String(active.id);
    const card = otimistas.find((c) => c.id === cardId);
    if (!card) return;

    // O alvo pode ser a coluna (área vazia) ou outro card.
    const alvo = String(over.id);
    const colunaAlvo = alvo.startsWith("coluna:")
      ? alvo.slice(7)
      : otimistas.find((c) => c.id === alvo)?.stageId;
    if (!colunaAlvo) return;

    const lista = (porColuna.get(colunaAlvo) ?? []).filter((c) => c.id !== cardId);

    let indice = lista.length;
    if (!alvo.startsWith("coluna:")) {
      const i = lista.findIndex((c) => c.id === alvo);
      if (i >= 0) indice = i;
    }

    const anterior = lista[indice - 1]?.posicao;
    const seguinte = lista[indice]?.posicao;
    const posicao =
      anterior !== undefined && seguinte !== undefined
        ? (anterior + seguinte) / 2
        : anterior !== undefined
          ? anterior + 1000
          : seguinte !== undefined
            ? seguinte - 1000
            : 1000;

    if (card.stageId === colunaAlvo && card.posicao === posicao) return;

    startTransition(async () => {
      aplicarOtimista({ id: cardId, stageId: colunaAlvo, posicao });
      const r = await aoMover(cardId, colunaAlvo, posicao);
      // Falhou: o revalidate do servidor devolve o estado real, e o aviso
      // explica. Nunca falha silenciosa.
      if (!r.ok) toast(r.erro, { tom: "erro" });
    });
  }

  const cardArrastado = otimistas.find((c) => c.id === arrastando);

  return (
    <DndContext
      sensors={sensores}
      onDragStart={aoIniciar}
      onDragEnd={aoTerminar}
      onDragCancel={() => setArrastando(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {colunas.map((coluna) => {
          const lista = porColuna.get(coluna.id) ?? [];
          return (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              total={lista.length}
              rodape={rodapeColuna?.(coluna)}
            >
              <SortableContext
                items={lista.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {lista.length === 0
                  ? (vazioColuna?.(coluna) ?? null)
                  : lista.map((card) => (
                      <CardArrastavel key={card.id} id={card.id}>
                        {renderCard(card, false)}
                      </CardArrastavel>
                    ))}
              </SortableContext>
            </Coluna>
          );
        })}
      </div>

      {/* Overlay segue o cursor sem transição: card arrastado com animação
          "escorrega" e erra o alvo. */}
      <DragOverlay dropAnimation={null}>
        {cardArrastado ? (
          <div className="rotate-1 opacity-95 shadow-lg">
            {renderCard(cardArrastado, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Coluna({
  coluna,
  total,
  children,
  rodape,
}: {
  coluna: ColunaKanban;
  total: number;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `coluna:${coluna.id}` });

  return (
    <div className="flex w-[272px] shrink-0 flex-col rounded-lg bg-[var(--color-fundo-sutil)]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            coluna.tipo === "GANHO"
              ? "bg-[var(--color-sucesso)]"
              : coluna.tipo === "PERDIDO"
                ? "bg-[var(--color-erro)]"
                : "bg-[var(--color-borda-forte)]"
          )}
        />
        <h3 className="flex-1 truncate text-[13px] font-semibold">
          {coluna.nome}
        </h3>
        <span className="tabular text-[12px] text-[var(--color-texto-3)]">
          {total}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2 transition-colors",
          isOver && "bg-azul-50/60"
        )}
      >
        {children}
      </div>

      {rodape && <div className="px-2 pb-2">{rodape}</div>}
    </div>
  );
}

function CardArrastavel({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isDragging && "opacity-30")}
    >
      {children}
    </div>
  );
}

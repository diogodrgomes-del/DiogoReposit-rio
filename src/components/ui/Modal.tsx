"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Modal com foco preso e devolvido ao elemento de origem ao fechar — sem isso,
 * quem navega por teclado é jogado para o topo da página a cada fechamento.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "md",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: "sm" | "md" | "lg";
}) {
  const painel = useRef<HTMLDivElement>(null);
  const origem = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    origem.current = document.activeElement as HTMLElement;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const foco = painel.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), textarea, select, button, [href], [tabindex]:not([tabindex='-1'])"
    );
    foco?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
        return;
      }
      if (e.key !== "Tab" || !painel.current) return;
      const focaveis = Array.from(
        painel.current.querySelectorAll<HTMLElement>(
          "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
        )
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.body.style.overflow = anterior;
      origem.current?.focus?.();
    };
  }, [aberto, aoFechar]);

  if (!aberto || typeof document === "undefined") return null;

  const larguras = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "anim-modal w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] shadow-[0_16px_48px_rgb(0_0_0_/_0.12)]",
          larguras[largura]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-borda)] px-5 py-4">
          <div className="space-y-0.5">
            <h2 className="text-[16px] font-semibold">{titulo}</h2>
            {descricao && (
              <p className="text-[13px] text-[var(--color-texto-2)]">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-m-1 rounded-md p-1 text-[var(--color-texto-3)] hover:bg-[var(--color-fundo-hover)] hover:text-[var(--color-texto)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {rodape && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-borda)] px-5 py-3">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

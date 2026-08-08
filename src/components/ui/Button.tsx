"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variante = "primary" | "secondary" | "ghost" | "destructive";
type Tamanho = "sm" | "md" | "icon";

const VARIANTES: Record<Variante, string> = {
  primary:
    "bg-azul-600 text-white hover:bg-azul-700 disabled:hover:bg-azul-600 shadow-sm",
  secondary:
    "bg-[var(--color-fundo-elevado)] text-[var(--color-texto)] border border-[var(--color-borda-forte)] hover:bg-[var(--color-fundo-hover)]",
  ghost:
    "text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)] hover:text-[var(--color-texto)]",
  destructive: "bg-[var(--color-erro)] text-white hover:brightness-95 shadow-sm",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 gap-2",
  icon: "h-9 w-9 justify-center",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
};

/**
 * Quatro variantes e mais nenhuma. Quando `carregando`, a largura é preservada
 * (o spinner substitui o conteúdo, não empurra) — botão que muda de tamanho ao
 * clicar faz o cursor errar o alvo.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variante = "secondary",
      tamanho = "md",
      carregando,
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || carregando}
      className={cn(
        "relative inline-flex items-center rounded-md font-medium transition-colors duration-100",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className
      )}
      {...props}
    >
      {carregando && (
        <span className="absolute inset-0 grid place-items-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}
      <span
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap",
          carregando && "invisible"
        )}
      >
        {children}
      </span>
    </button>
  )
);
Button.displayName = "Button";

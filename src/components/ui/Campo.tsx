"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const BASE =
  "w-full rounded-md border border-[var(--color-borda-forte)] bg-[var(--color-fundo-elevado)] " +
  "px-3 text-[14px] text-[var(--color-texto)] placeholder:text-[var(--color-texto-3)] " +
  "transition-colors focus:border-azul-600 disabled:opacity-60 disabled:cursor-not-allowed";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { erro?: boolean }
>(({ className, erro, ...props }, ref) => (
  <input
    ref={ref}
    aria-invalid={erro || undefined}
    className={cn(BASE, "h-9", erro && "border-[var(--color-erro)]", className)}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { erro?: boolean }
>(({ className, erro, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={erro || undefined}
    className={cn(
      BASE,
      "py-2 min-h-[80px] resize-y leading-relaxed",
      erro && "border-[var(--color-erro)]",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { erro?: boolean }
>(({ className, erro, children, ...props }, ref) => (
  <select
    ref={ref}
    aria-invalid={erro || undefined}
    className={cn(
      BASE,
      "h-9 pr-8 appearance-none bg-no-repeat cursor-pointer",
      erro && "border-[var(--color-erro)]",
      className
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round'><path d='M4 6l4 4 4-4'/></svg>\")",
      backgroundPosition: "right 10px center",
    }}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

/**
 * Rótulo acima, ajuda abaixo, erro substituindo a ajuda. O erro aparece no
 * blur e não a cada tecla — validar enquanto a pessoa digita é hostil.
 */
export function Campo({
  label,
  ajuda,
  erro,
  obrigatorio,
  children,
  className,
}: {
  label: string;
  ajuda?: string;
  erro?: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-[var(--color-texto)]"
      >
        {label}
        {obrigatorio && <span className="text-[var(--color-erro)]"> *</span>}
      </label>
      <div id={id}>{children}</div>
      {erro ? (
        <p className="text-[12px] text-[var(--color-erro)]">{erro}</p>
      ) : ajuda ? (
        <p className="text-[12px] text-[var(--color-texto-3)]">{ajuda}</p>
      ) : null}
    </div>
  );
}

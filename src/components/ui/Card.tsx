import Link from "next/link";
import { cn } from "@/lib/cn";
import { iniciais } from "@/lib/formato";
import type { LucideIcon } from "lucide-react";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitulo({
  children,
  acao,
}: {
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-borda)] px-4 py-3">
      <h2 className="text-[14px] font-semibold">{children}</h2>
      {acao}
    </div>
  );
}

/**
 * Indicador do painel. Sempre um link: todo número do Painel Geral leva para a
 * lista já filtrada, com o filtro na URL — assim o estado é compartilhável e o
 * botão voltar funciona.
 */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  href,
  icone: Icone,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  href: string;
  icone?: LucideIcon;
  tom?: "neutro" | "atencao" | "risco" | "positivo";
}) {
  const tons = {
    neutro: "text-[var(--color-texto)]",
    atencao: "text-[var(--color-alerta)]",
    risco: "text-[var(--color-erro)]",
    positivo: "text-[var(--color-sucesso)]",
  };

  return (
    <Link
      href={href}
      className="group rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] p-4 transition-colors hover:border-[var(--color-borda-forte)] hover:bg-[var(--color-fundo-hover)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] text-[var(--color-texto-2)]">{rotulo}</p>
        {Icone && (
          <Icone className="h-4 w-4 shrink-0 text-[var(--color-texto-3)]" />
        )}
      </div>
      <p
        className={cn(
          "tabular mt-1.5 text-[26px] font-semibold leading-none",
          tons[tom]
        )}
      >
        {valor}
      </p>
      {detalhe && (
        <p className="mt-1.5 text-[12px] text-[var(--color-texto-3)]">
          {detalhe}
        </p>
      )}
    </Link>
  );
}

const CORES_AVATAR = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

export function Avatar({
  nome,
  tamanho = 24,
  className,
}: {
  nome: string;
  tamanho?: number;
  className?: string;
}) {
  // Cor derivada do nome: estável entre sessões, sem guardar nada.
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  const cor = CORES_AVATAR[soma % CORES_AVATAR.length];

  return (
    <span
      title={nome}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-medium",
        cor,
        className
      )}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.max(9, tamanho * 0.4),
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

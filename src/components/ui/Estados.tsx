import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

/** Estado vazio: uma frase que explica, e a ação que resolve. */
export function Vazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-borda-forte)] px-6 py-12 text-center",
        className
      )}
    >
      {Icone && (
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-fundo-hover)]">
          <Icone className="h-5 w-5 text-[var(--color-texto-3)]" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium text-[var(--color-texto)]">{titulo}</p>
        {descricao && (
          <p className="max-w-sm text-[13px] text-[var(--color-texto-2)]">
            {descricao}
          </p>
        )}
      </div>
      {acao}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

/** Skeleton com a forma do conteúdo real, não um retângulo genérico. */
export function SkeletonLinhas({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function SkeletonCards({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-[88px]" />
      ))}
    </div>
  );
}

export function ErroEstado({
  titulo = "Não foi possível carregar",
  descricao,
  acao,
}: {
  titulo?: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-erro)] bg-[var(--color-erro-fundo)] px-4 py-3">
      <p className="font-medium text-[var(--color-erro-texto)]">{titulo}</p>
      {descricao && (
        <p className="mt-1 text-[13px] text-[var(--color-erro-texto)] opacity-90">
          {descricao}
        </p>
      )}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}

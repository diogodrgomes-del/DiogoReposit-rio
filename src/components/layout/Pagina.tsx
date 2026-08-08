import { cn } from "@/lib/cn";

/** Cabeçalho padrão de página: título, subtítulo, ações à direita. */
export function Pagina({
  titulo,
  descricao,
  acoes,
  children,
  largura = "normal",
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  largura?: "normal" | "cheia";
}) {
  return (
    <div
      className={cn(
        "px-4 py-5 sm:px-6",
        largura === "normal" && "mx-auto max-w-[1440px]"
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight">{titulo}</h1>
          {descricao && (
            <p className="mt-0.5 text-[13px] text-[var(--color-texto-2)]">
              {descricao}
            </p>
          )}
        </div>
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </div>
  );
}

export function Secao({
  titulo,
  acao,
  children,
  className,
}: {
  titulo?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6", className)}>
      {(titulo || acao) && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          {titulo && (
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-texto-3)]">
              {titulo}
            </h2>
          )}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

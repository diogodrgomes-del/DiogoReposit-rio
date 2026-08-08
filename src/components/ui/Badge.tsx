import { cn } from "@/lib/cn";

export type TomBadge = "neutro" | "ativo" | "sucesso" | "alerta" | "erro";

const TONS: Record<TomBadge, string> = {
  neutro:
    "bg-[var(--color-fundo-hover)] text-[var(--color-texto-2)] border-[var(--color-borda)]",
  ativo: "bg-azul-50 text-azul-700 border-azul-200",
  sucesso:
    "bg-[var(--color-sucesso-fundo)] text-[var(--color-sucesso-texto)] border-transparent",
  alerta:
    "bg-[var(--color-alerta-fundo)] text-[var(--color-alerta-texto)] border-transparent",
  erro: "bg-[var(--color-erro-fundo)] text-[var(--color-erro-texto)] border-transparent",
};

export function Badge({
  tom = "neutro",
  children,
  className,
}: {
  tom?: TomBadge;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12px] font-medium whitespace-nowrap",
        TONS[tom],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Uma tabela de status para o sistema inteiro. É o que faz "atrasado" parecer
 * igual no financeiro e no operacional. Cor sempre acompanhada de rótulo:
 * nada é comunicado só por cor.
 */
const STATUS: Record<string, { tom: TomBadge; rotulo: string }> = {
  // Cliente
  ATIVO: { tom: "sucesso", rotulo: "Ativo" },
  ONBOARDING: { tom: "ativo", rotulo: "Onboarding" },
  PAUSADO: { tom: "neutro", rotulo: "Pausado" },
  INADIMPLENTE: { tom: "erro", rotulo: "Inadimplente" },
  EM_RISCO: { tom: "alerta", rotulo: "Em risco" },
  CANCELADO: { tom: "erro", rotulo: "Cancelado" },
  ENCERRADO: { tom: "neutro", rotulo: "Encerrado" },

  // Financeiro
  PREVISTO: { tom: "neutro", rotulo: "Previsto" },
  PENDENTE: { tom: "alerta", rotulo: "Pendente" },
  PAGO: { tom: "sucesso", rotulo: "Pago" },
  RECEBIDO: { tom: "sucesso", rotulo: "Recebido" },
  ATRASADO: { tom: "erro", rotulo: "Atrasado" },

  // Proposta
  RASCUNHO: { tom: "neutro", rotulo: "Rascunho" },
  ENVIADA: { tom: "ativo", rotulo: "Enviada" },
  VISUALIZADA: { tom: "ativo", rotulo: "Visualizada" },
  AGUARDANDO: { tom: "alerta", rotulo: "Aguardando" },
  NEGOCIACAO: { tom: "ativo", rotulo: "Em negociação" },
  APROVADA: { tom: "sucesso", rotulo: "Aprovada" },
  RECUSADA: { tom: "erro", rotulo: "Recusada" },
  VENCIDA: { tom: "erro", rotulo: "Vencida" },

  // Contrato
  PLANEJADA: { tom: "neutro", rotulo: "Planejada" },
  CONFIRMADA: { tom: "ativo", rotulo: "Confirmada" },
  AGUARDANDO_ROTEIRO: { tom: "alerta", rotulo: "Aguardando roteiro" },
  PRONTA: { tom: "ativo", rotulo: "Pronta" },
  REALIZADA: { tom: "sucesso", rotulo: "Realizada" },
  REAGENDADA: { tom: "alerta", rotulo: "Reagendada" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { tom: "neutro" as TomBadge, rotulo: status };
  return <Badge tom={s.tom}>{s.rotulo}</Badge>;
}

export function rotuloStatus(status: string): string {
  return STATUS[status]?.rotulo ?? status;
}

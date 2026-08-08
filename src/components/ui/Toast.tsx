"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tom = "sucesso" | "erro" | "info";

type Aviso = {
  id: number;
  tom: Tom;
  texto: string;
  acao?: { rotulo: string; aoClicar: () => void };
};

type Ctx = {
  toast: (
    texto: string,
    opcoes?: { tom?: Tom; acao?: Aviso["acao"]; duracaoMs?: number }
  ) => void;
};

const ToastCtx = createContext<Ctx>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const ICONES = {
  sucesso: CheckCircle2,
  erro: AlertCircle,
  info: Info,
} as const;

const CORES: Record<Tom, string> = {
  sucesso: "text-[var(--color-sucesso)]",
  erro: "text-[var(--color-erro)]",
  info: "text-azul-600",
};

/**
 * Todo toast de erro pode carregar uma ação — normalmente "tentar de novo".
 * Falha sem saída é o que faz a pessoa recarregar a página e perder o que
 * estava fazendo.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const remover = useCallback((id: number) => {
    setAvisos((a) => a.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback<Ctx["toast"]>(
    (texto, opcoes) => {
      const id = Date.now() + Math.random();
      const tom = opcoes?.tom ?? "sucesso";
      setAvisos((a) => [...a, { id, tom, texto, acao: opcoes?.acao }]);
      // Erro fica mais tempo: costuma exigir leitura e decisão.
      const duracao = opcoes?.duracaoMs ?? (tom === "erro" ? 8000 : 4000);
      setTimeout(() => remover(id), duracao);
    },
    [remover]
  );

  const valor = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {avisos.map((a) => {
          const Icone = ICONES[a.tom];
          return (
            <div
              key={a.id}
              className="anim-entrada pointer-events-auto flex items-start gap-2.5 rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] px-3.5 py-3 shadow-[0_8px_24px_rgb(0_0_0_/_0.12)]"
            >
              <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", CORES[a.tom])} />
              <p className="flex-1 text-[13px] leading-snug">{a.texto}</p>
              {a.acao && (
                <button
                  type="button"
                  onClick={() => {
                    a.acao!.aoClicar();
                    remover(a.id);
                  }}
                  className="shrink-0 text-[13px] font-medium text-azul-600 hover:underline"
                >
                  {a.acao.rotulo}
                </button>
              )}
              <button
                type="button"
                onClick={() => remover(a.id)}
                aria-label="Dispensar"
                className="-mr-1 shrink-0 rounded p-0.5 text-[var(--color-texto-3)] hover:text-[var(--color-texto)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

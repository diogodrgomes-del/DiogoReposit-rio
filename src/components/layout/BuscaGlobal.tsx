"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Search,
  Target,
  Users,
  ListChecks,
  CalendarDays,
  Wallet,
  Plus,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Resultado = {
  tipo: "lead" | "cliente" | "demanda" | "evento" | "financeiro";
  id: string;
  titulo: string;
  detalhe?: string;
  url: string;
};

type Acao = { rotulo: string; url: string };

const ICONES = {
  lead: Target,
  cliente: Users,
  demanda: ListChecks,
  evento: CalendarDays,
  financeiro: Wallet,
} as const;

const ROTULO_TIPO = {
  lead: "Leads",
  cliente: "Clientes",
  demanda: "Demandas",
  evento: "Agenda",
  financeiro: "Financeiro",
} as const;

export function BuscaGlobal({
  aberto,
  aoFechar,
  acoes,
}: {
  aberto: boolean;
  aoFechar: () => void;
  acoes: Acao[];
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [indice, setIndice] = useState(0);
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);

  const acoesFiltradas = termo
    ? acoes.filter((a) => a.rotulo.toLowerCase().includes(termo.toLowerCase()))
    : acoes;

  const lista: Array<{ url: string; rotulo: string }> = [
    ...acoesFiltradas.map((a) => ({ url: a.url, rotulo: a.rotulo })),
    ...resultados.map((r) => ({ url: r.url, rotulo: r.titulo })),
  ];

  useEffect(() => {
    if (aberto) {
      setTermo("");
      setResultados([]);
      setIndice(0);
      setTimeout(() => entrada.current?.focus(), 10);
    }
  }, [aberto]);

  // Debounce de 150 ms e cancelamento da requisição anterior: sem o abort, a
  // resposta de uma busca antiga chega depois e sobrescreve a atual.
  useEffect(() => {
    if (!termo.trim()) {
      setResultados([]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`, {
          signal: ctrl.signal,
        });
        if (r.ok) setResultados((await r.json()).resultados ?? []);
      } catch {
        /* abortada */
      } finally {
        setCarregando(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [termo]);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") return aoFechar();
      // Reabrir com ⌘K já aberto não deve fazer nada além de manter o foco.
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        entrada.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndice((i) => Math.min(i + 1, lista.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndice((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && lista[indice]) {
        e.preventDefault();
        router.push(lista[indice].url);
        aoFechar();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, indice, lista, router, aoFechar]);

  if (!aberto || typeof document === "undefined") return null;

  const porTipo = resultados.reduce<Record<string, Resultado[]>>((acc, r) => {
    (acc[r.tipo] ??= []).push(r);
    return acc;
  }, {});

  let n = acoesFiltradas.length;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
    >
      <div className="anim-modal w-full max-w-xl overflow-hidden rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] shadow-[0_16px_48px_rgb(0_0_0_/_0.18)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--color-borda)] px-4">
          <Search className="h-4 w-4 shrink-0 text-[var(--color-texto-3)]" />
          <input
            ref={entrada}
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setIndice(0);
            }}
            placeholder="Buscar leads, clientes, demandas…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--color-texto-3)]"
          />
          {carregando && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-borda-forte)] border-t-azul-600" />
          )}
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-1.5">
          {acoesFiltradas.length > 0 && (
            <Grupo titulo="Ações">
              {acoesFiltradas.map((a, i) => (
                <Linha
                  key={a.url}
                  ativo={indice === i}
                  aoEntrar={() => setIndice(i)}
                  aoClicar={() => {
                    router.push(a.url);
                    aoFechar();
                  }}
                  icone={<Plus className="h-4 w-4" />}
                  titulo={a.rotulo}
                />
              ))}
            </Grupo>
          )}

          {Object.entries(porTipo).map(([tipo, itens]) => {
            const Icone = ICONES[tipo as keyof typeof ICONES];
            return (
              <Grupo
                key={tipo}
                titulo={ROTULO_TIPO[tipo as keyof typeof ROTULO_TIPO]}
              >
                {itens.map((r) => {
                  const meu = n++;
                  return (
                    <Linha
                      key={r.id}
                      ativo={indice === meu}
                      aoEntrar={() => setIndice(meu)}
                      aoClicar={() => {
                        router.push(r.url);
                        aoFechar();
                      }}
                      icone={<Icone className="h-4 w-4" />}
                      titulo={r.titulo}
                      detalhe={r.detalhe}
                    />
                  );
                })}
              </Grupo>
            );
          })}

          {termo && !carregando && resultados.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-[var(--color-texto-3)]">
              Nada encontrado para “{termo}”.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--color-borda)] px-3 py-2 text-[11px] text-[var(--color-texto-3)]">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> abrir
          </span>
          <span>↑↓ navegar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-texto-3)]">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Linha({
  ativo,
  titulo,
  detalhe,
  icone,
  aoClicar,
  aoEntrar,
}: {
  ativo: boolean;
  titulo: string;
  detalhe?: string;
  icone: React.ReactNode;
  aoClicar: () => void;
  aoEntrar: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={aoEntrar}
      onClick={aoClicar}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px]",
        ativo ? "bg-azul-50 text-azul-700" : "text-[var(--color-texto)]"
      )}
    >
      <span className="shrink-0 text-[var(--color-texto-3)]">{icone}</span>
      <span className="flex-1 truncate">{titulo}</span>
      {detalhe && (
        <span className="shrink-0 truncate text-[12px] text-[var(--color-texto-3)]">
          {detalhe}
        </span>
      )}
    </button>
  );
}

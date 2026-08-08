"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Target,
  Users,
  ListChecks,
  CalendarDays,
  Wallet,
  BarChart3,
  Settings,
  KeyRound,
  Building2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type ItemMenu = {
  href: string;
  rotulo: string;
  icone: keyof typeof ICONES;
  grupo?: string;
};

const ICONES = {
  painel: LayoutDashboard,
  vendas: Target,
  clientes: Users,
  demandas: ListChecks,
  agenda: CalendarDays,
  financeiro: Wallet,
  trafego: BarChart3,
  senhas: KeyRound,
  gestao: Building2,
  config: Settings,
} as const;

export function Sidebar({
  itens,
  colapsadaInicial,
}: {
  itens: ItemMenu[];
  colapsadaInicial: boolean;
}) {
  const pathname = usePathname();
  const [colapsada, setColapsada] = useState(colapsadaInicial);

  // Estado em cookie, não em localStorage: assim a primeira renderização no
  // servidor já vem com a largura certa, sem o pulo de layout.
  useEffect(() => {
    document.cookie = `mark-sidebar=${colapsada ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
  }, [colapsada]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setColapsada((c) => !c);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const grupos = itens.reduce<Record<string, ItemMenu[]>>((acc, item) => {
    const g = item.grupo ?? "";
    (acc[g] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-[var(--color-borda)] bg-[var(--color-fundo-sutil)] transition-[width] duration-200 md:flex",
        colapsada ? "w-14" : "w-60"
      )}
    >
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {Object.entries(grupos).map(([grupo, lista]) => (
          <div key={grupo} className="mb-4">
            {grupo && !colapsada && (
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-texto-3)]">
                {grupo}
              </p>
            )}
            {grupo && colapsada && (
              <div className="mx-2 mb-2 border-t border-[var(--color-borda)]" />
            )}
            <ul className="space-y-0.5">
              {lista.map((item) => {
                const Icone = ICONES[item.icone];
                const ativo =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={colapsada ? item.rotulo : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] transition-colors",
                        colapsada && "justify-center px-0",
                        ativo
                          ? "bg-azul-50 font-medium text-azul-700"
                          : "text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)] hover:text-[var(--color-texto)]"
                      )}
                    >
                      <Icone className="h-[17px] w-[17px] shrink-0" />
                      {!colapsada && <span>{item.rotulo}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setColapsada((c) => !c)}
        title="Recolher barra lateral (⌘\)"
        className={cn(
          "m-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[var(--color-texto-3)] hover:bg-[var(--color-fundo-hover)] hover:text-[var(--color-texto)]",
          colapsada && "justify-center px-0"
        )}
      >
        {colapsada ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" />
            <span>Recolher</span>
          </>
        )}
      </button>
    </aside>
  );
}

/** Navegação inferior do celular: cinco destinos, os que se usa fora da mesa. */
export function NavMobile({ itens }: { itens: ItemMenu[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] md:hidden">
      {itens.slice(0, 5).map((item) => {
        const Icone = ICONES[item.icone];
        const ativo =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
              ativo ? "text-azul-600" : "text-[var(--color-texto-3)]"
            )}
          >
            <Icone className="h-5 w-5" />
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

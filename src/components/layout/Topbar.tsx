"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Bell, Sun, Moon, LogOut, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function Topbar({
  usuario,
  organizacao,
  papel,
  naoLidas,
  aoAbrirBusca,
}: {
  usuario: string;
  organizacao: string;
  papel: string;
  naoLidas: number;
  aoAbrirBusca: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (menu.current && !menu.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function alternarTema() {
    const atual = document.documentElement.dataset.tema;
    const novo = atual === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    localStorage.setItem("mark-tema", novo);
  }

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-[var(--color-borda)] bg-[var(--color-fundo)]/95 px-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 pr-1">
        <span className="grid h-6 w-6 place-items-center rounded bg-azul-600 text-[11px] font-bold text-white">
          M
        </span>
        <span className="hidden text-[13px] font-semibold tracking-tight sm:block">
          MARK SISTEM
        </span>
      </Link>

      <button
        type="button"
        onClick={aoAbrirBusca}
        className="flex h-8 flex-1 max-w-md items-center gap-2 rounded-md border border-[var(--color-borda)] bg-[var(--color-fundo-sutil)] px-2.5 text-[13px] text-[var(--color-texto-3)] transition-colors hover:border-[var(--color-borda-forte)]"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="hidden rounded border border-[var(--color-borda)] px-1 font-sans text-[10px] sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Link
          href="/notificacoes"
          aria-label={`Notificações${naoLidas ? `, ${naoLidas} não lidas` : ""}`}
          className="relative grid h-8 w-8 place-items-center rounded-md text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)] hover:text-[var(--color-texto)]"
        >
          <Bell className="h-[17px] w-[17px]" />
          {naoLidas > 0 && (
            <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[var(--color-erro)] px-1 text-[9px] font-semibold text-white">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={alternarTema}
          aria-label="Alternar tema"
          className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)] hover:text-[var(--color-texto)]"
        >
          <Sun className="h-[17px] w-[17px] dark:hidden" />
          <Moon className="hidden h-[17px] w-[17px] dark:block" />
        </button>

        <div ref={menu} className="relative">
          <button
            type="button"
            onClick={() => setMenuAberto((a) => !a)}
            className="flex h-8 items-center gap-1.5 rounded-md pl-1 pr-1.5 hover:bg-[var(--color-fundo-hover)]"
          >
            <Avatar nome={usuario} tamanho={24} />
            <ChevronDown className="h-3 w-3 text-[var(--color-texto-3)]" />
          </button>

          {menuAberto && (
            <div className="anim-entrada absolute right-0 top-9 w-60 rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] py-1 shadow-[0_4px_12px_rgb(0_0_0_/_0.08)]">
              <div className="border-b border-[var(--color-borda)] px-3 py-2">
                <p className="truncate text-[13px] font-medium">{usuario}</p>
                <p className="truncate text-[12px] text-[var(--color-texto-3)]">
                  {papel} · {organizacao}
                </p>
              </div>
              <Link
                href="/configuracoes"
                onClick={() => setMenuAberto(false)}
                className="block px-3 py-2 text-[13px] hover:bg-[var(--color-fundo-hover)]"
              >
                Configurações
              </Link>
              <button
                type="button"
                onClick={sair}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]",
                  "text-[var(--color-erro)] hover:bg-[var(--color-fundo-hover)]"
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

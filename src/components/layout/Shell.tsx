"use client";

import { useEffect, useState } from "react";
import { Sidebar, NavMobile, type ItemMenu } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BuscaGlobal } from "./BuscaGlobal";

export function Shell({
  itens,
  itensMobile,
  acoesBusca,
  usuario,
  organizacao,
  papel,
  naoLidas,
  colapsadaInicial,
  children,
}: {
  itens: ItemMenu[];
  itensMobile: ItemMenu[];
  acoesBusca: { rotulo: string; url: string }[];
  usuario: string;
  organizacao: string;
  papel: string;
  naoLidas: number;
  colapsadaInicial: boolean;
  children: React.ReactNode;
}) {
  const [busca, setBusca] = useState(false);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      // toLowerCase porque com CapsLock ligado — ou com Shift junto — o
      // navegador entrega "K", e a comparação estrita deixava o atalho mudo.
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setBusca(true);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <Topbar
        usuario={usuario}
        organizacao={organizacao}
        papel={papel}
        naoLidas={naoLidas}
        aoAbrirBusca={() => setBusca(true)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar itens={itens} colapsadaInicial={colapsadaInicial} />
        <main className="min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <NavMobile itens={itensMobile} />
      <BuscaGlobal
        aberto={busca}
        aoFechar={() => setBusca(false)}
        acoes={acoesBusca}
      />
    </div>
  );
}

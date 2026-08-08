import Link from "next/link";
import { Bell } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina } from "@/components/layout/Pagina";
import { Card } from "@/components/ui/Card";
import { Vazio } from "@/components/ui/Estados";
import { relativo } from "@/lib/formato";
import { MarcarLidas } from "./MarcarLidas";
import type { Permissao } from "@/lib/auth/permissoes";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const ator = await exigirAtor();

  const brutas = await prisma.notification.findMany({
    where: { userId: ator.userId, arquivadaEm: null },
    orderBy: { criadoEm: "desc" },
    take: 100,
  });

  /*
    Filtro de permissão na ENTREGA, não só na renderização: uma notificação
    financeira gravada antes de alguém perder o acesso não deve aparecer.
    É o que cumpre o §14 do briefing.
  */
  const notificacoes = brutas.filter(
    (n) => !n.permissaoExigida || can(ator, n.permissaoExigida as Permissao)
  );

  const naoLidas = notificacoes.filter((n) => !n.lidaEm).length;

  return (
    <Pagina
      titulo="Notificações"
      descricao={naoLidas > 0 ? `${naoLidas} não lida(s)` : "Tudo lido"}
      acoes={naoLidas > 0 ? <MarcarLidas /> : undefined}
    >
      {notificacoes.length === 0 ? (
        <Vazio
          icone={Bell}
          titulo="Nenhuma notificação"
          descricao="Avisos sobre demandas, prazos e compromissos aparecem aqui."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-borda)]">
            {notificacoes.map((n) => {
              const conteudo = (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.lidaEm ? "bg-transparent" : "bg-azul-600"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[13.5px]",
                        !n.lidaEm && "font-medium"
                      )}
                    >
                      {n.titulo}
                    </p>
                    {n.corpo && (
                      <p className="text-[12.5px] text-[var(--color-texto-2)]">
                        {n.corpo}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11.5px] text-[var(--color-texto-3)]">
                      {relativo(n.criadoEm)}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={n.id} className="hover:bg-[var(--color-fundo-hover)]">
                  {n.url ? <Link href={n.url}>{conteudo}</Link> : conteudo}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Pagina>
  );
}

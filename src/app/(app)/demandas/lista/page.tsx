import { redirect } from "next/navigation";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can, escopoClienteOuInterno } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina } from "@/components/layout/Pagina";
import { Card, Avatar } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Vazio } from "@/components/ui/Estados";
import { data } from "@/lib/formato";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/**
 * Lista filtrada — o destino dos cards do Painel Geral. O filtro vem da URL,
 * então "Demandas atrasadas" no painel abre exatamente esta tela já filtrada,
 * e o link é compartilhável.
 */
export default async function ListaDemandas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "demandas:ler")) redirect("/");

  const sp = await searchParams;
  const agora = new Date();
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date();
  fimDoDia.setHours(23, 59, 59, 999);

  const vejoTudo = can(ator, "demandas:ler_todas");
  const soMinhas = sp.responsavel === "eu" || !vejoTudo;

  const filtroPrazo =
    sp.prazo === "atrasado"
      ? { prazoEm: { lt: agora }, concluidaEm: null }
      : sp.prazo === "hoje"
        ? { prazoEm: { gte: inicioDoDia, lte: fimDoDia }, concluidaEm: null }
        : {};

  const demandas = await prisma.demand.findMany({
    where: {
      organizationId: ator.organizationId,
      deletadoEm: null,
      arquivadaEm: null,
      ...(soMinhas ? { responsavelId: ator.userId } : {}),
      ...(sp.prioridade ? { prioridade: sp.prioridade as "URGENTE" } : {}),
      ...(sp.cliente ? { clientId: sp.cliente } : {}),
      ...filtroPrazo,
      ...escopoClienteOuInterno(ator),
    },
    include: {
      client: { select: { razaoSocial: true, nomeFantasia: true } },
      stage: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      tipo: { select: { nome: true } },
    },
    orderBy: [{ prazoEm: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
    take: 200,
  });

  const titulo =
    sp.prazo === "atrasado"
      ? "Demandas atrasadas"
      : sp.prazo === "hoje"
        ? "Demandas para hoje"
        : sp.prioridade === "URGENTE"
          ? "Demandas urgentes"
          : "Todas as demandas";

  return (
    <Pagina
      titulo={titulo}
      descricao={`${demandas.length} demanda(s)`}
      acoes={
        <Link
          href="/demandas"
          className="rounded-md border border-[var(--color-borda-forte)] px-2.5 py-1.5 text-[13px] text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)]"
        >
          Ver quadro
        </Link>
      }
    >
      {demandas.length === 0 ? (
        <Vazio
          icone={ListChecks}
          titulo="Nada aqui"
          descricao={
            sp.prazo === "atrasado"
              ? "Nenhuma demanda atrasada. Bom sinal."
              : "Nenhuma demanda com esse filtro."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--color-borda)] text-left text-[12px] uppercase tracking-wide text-[var(--color-texto-3)]">
                  <th className="px-4 py-2.5 font-medium">Demanda</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Etapa</th>
                  <th className="px-4 py-2.5 font-medium">Responsável</th>
                  <th className="px-4 py-2.5 font-medium">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borda)]">
                {demandas.map((d) => {
                  const atrasada =
                    d.prazoEm && d.prazoEm < agora && !d.concluidaEm;
                  return (
                    <tr
                      key={d.id}
                      className="group hover:bg-[var(--color-fundo-hover)]"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/demandas/${d.id}`}
                          className="flex items-center gap-2"
                        >
                          <span
                            className={cn(
                              "h-5 w-1 shrink-0 rounded-full",
                              d.prioridade === "URGENTE"
                                ? "bg-[var(--color-erro)]"
                                : d.prioridade === "ALTA"
                                  ? "bg-[var(--color-alerta)]"
                                  : "bg-transparent"
                            )}
                          />
                          <span className="font-medium group-hover:text-azul-700">
                            {d.titulo}
                          </span>
                          {d.tipo && (
                            <Badge tom="neutro">{d.tipo.nome}</Badge>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-texto-2)]">
                        {d.client?.nomeFantasia ?? d.client?.razaoSocial ?? "Interno"}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-texto-2)]">
                        {d.stage.nome}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.responsavel ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar nome={d.responsavel.nome} tamanho={20} />
                            <span className="text-[13px] text-[var(--color-texto-2)]">
                              {d.responsavel.nome.split(" ")[0]}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-texto-3)]">—</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5",
                          atrasada
                            ? "font-medium text-[var(--color-erro)]"
                            : "text-[var(--color-texto-3)]"
                        )}
                      >
                        {data(d.prazoEm)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Pagina>
  );
}

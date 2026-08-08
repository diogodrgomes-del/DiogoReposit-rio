import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina } from "@/components/layout/Pagina";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Vazio } from "@/components/ui/Estados";
import { Avatar } from "@/components/ui/Card";
import { moeda, data } from "@/lib/formato";
import { NovoClienteBotao } from "./NovoCliente";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const FILTROS = [
  ["", "Todos"],
  ["ATIVO", "Ativos"],
  ["ONBOARDING", "Onboarding"],
  ["INADIMPLENTE", "Inadimplentes"],
  ["EM_RISCO", "Em risco"],
  ["PAUSADO", "Pausados"],
  ["CANCELADO", "Cancelados"],
] as const;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "clientes:ler")) redirect("/");

  const sp = await searchParams;
  const status = sp.status;
  const busca = sp.q?.trim();
  const verValores = can(ator, "clientes:ver_contrato");

  const clientes = await prisma.client.findMany({
    where: {
      organizationId: ator.organizationId,
      deletadoEm: null,
      // Escopo por cliente entra no where, não no filtro da tela.
      ...(ator.clientesVisiveis ? { id: { in: ator.clientesVisiveis } } : {}),
      ...(status ? { status: status as "ATIVO" } : {}),
      ...(busca
        ? {
            OR: [
              { razaoSocial: { contains: busca, mode: "insensitive" } },
              { nomeFantasia: { contains: busca, mode: "insensitive" } },
              { cnpj: { contains: busca } },
            ],
          }
        : {}),
    },
    include: {
      responsavel: { select: { nome: true } },
      contratos: {
        where: { status: "ATIVO", deletadoEm: null },
        select: { valorMensalCents: true, diaVencimento: true },
        take: 1,
      },
      _count: {
        select: {
          demandas: { where: { deletadoEm: null, concluidaEm: null } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { razaoSocial: "asc" }],
    take: 200,
  });

  const mrr = clientes.reduce(
    (s, c) => s + (c.contratos[0]?.valorMensalCents ?? 0),
    0
  );

  return (
    <Pagina
      titulo="Clientes"
      descricao={
        verValores
          ? `${clientes.length} clientes · ${moeda(mrr)} em contratos ativos`
          : `${clientes.length} clientes`
      }
      acoes={can(ator, "clientes:criar") ? <NovoClienteBotao /> : undefined}
    >
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTROS.map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={valor ? `/clientes?status=${valor}` : "/clientes"}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
              (status ?? "") === valor
                ? "border-azul-600 bg-azul-50 font-medium text-azul-700"
                : "border-[var(--color-borda)] text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)]"
            )}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {clientes.length === 0 ? (
        <Vazio
          icone={Users}
          titulo={busca || status ? "Nada encontrado" : "Nenhum cliente ainda"}
          descricao={
            busca || status
              ? "Tente outro filtro."
              : "Cadastre o primeiro cliente ou converta um lead ganho no pipeline."
          }
          acao={can(ator, "clientes:criar") ? <NovoClienteBotao /> : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--color-borda)] text-left text-[12px] uppercase tracking-wide text-[var(--color-texto-3)]">
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Responsável</th>
                  <th className="px-4 py-2.5 text-right font-medium">Demandas</th>
                  {verValores && (
                    <th className="px-4 py-2.5 text-right font-medium">Mensal</th>
                  )}
                  <th className="px-4 py-2.5 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borda)]">
                {clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="group hover:bg-[var(--color-fundo-hover)]"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="flex items-center gap-2.5"
                      >
                        <span
                          className={cn(
                            "h-6 w-1 shrink-0 rounded-full",
                            c.saude === "VERMELHO"
                              ? "bg-[var(--color-erro)]"
                              : c.saude === "AMARELO"
                                ? "bg-[var(--color-alerta)]"
                                : "bg-[var(--color-sucesso)]"
                          )}
                          title={`Saúde: ${c.saude.toLowerCase()}`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-azul-700">
                            {c.nomeFantasia ?? c.razaoSocial}
                          </span>
                          {c.segmento && (
                            <span className="block truncate text-[12px] text-[var(--color-texto-3)]">
                              {c.segmento}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      {c.responsavel ? (
                        <span className="flex items-center gap-1.5">
                          <Avatar nome={c.responsavel.nome} tamanho={20} />
                          <span className="truncate text-[13px] text-[var(--color-texto-2)]">
                            {c.responsavel.nome.split(" ")[0]}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--color-texto-3)]">—</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-[var(--color-texto-2)]">
                      {c._count.demandas}
                    </td>
                    {verValores && (
                      <td className="tabular px-4 py-2.5 text-right font-medium">
                        {c.contratos[0]
                          ? moeda(c.contratos[0].valorMensalCents)
                          : "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-[var(--color-texto-3)]">
                      {data(c.entrouEm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Pagina>
  );
}

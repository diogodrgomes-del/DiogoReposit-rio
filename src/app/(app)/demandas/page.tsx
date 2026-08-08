import { redirect } from "next/navigation";
import { exigirAtor } from "@/lib/auth/sessao";
import { can, escopoClienteOuInterno } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina } from "@/components/layout/Pagina";
import { Vazio } from "@/components/ui/Estados";
import { ListChecks } from "lucide-react";
import { QuadroDemandas } from "./QuadroDemandas";

export const dynamic = "force-dynamic";

export default async function DemandasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "demandas:ler")) redirect("/");

  const sp = await searchParams;
  const cliente = sp.cliente;
  const responsavel = sp.responsavel ?? (can(ator, "demandas:ler_todas") ? undefined : ator.userId);

  const pipeline = await prisma.pipeline.findFirst({
    where: { organizationId: ator.organizationId, tipo: "OPERACIONAL" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });

  if (!pipeline) {
    return (
      <Pagina titulo="Demandas">
        <Vazio
          icone={ListChecks}
          titulo="Nenhum pipeline operacional"
          descricao="Rode o seed (npm run db:seed) para criar as etapas padrão."
        />
      </Pagina>
    );
  }

  const [demandas, clientes, tipos, equipe] = await Promise.all([
    prisma.demand.findMany({
      where: {
        organizationId: ator.organizationId,
        pipelineId: pipeline.id,
        deletadoEm: null,
        arquivadaEm: null,
        ...(cliente ? { clientId: cliente } : {}),
        ...(responsavel ? { responsavelId: responsavel } : {}),
        ...escopoClienteOuInterno(ator),
      },
      select: {
        id: true,
        stageId: true,
        posicao: true,
        titulo: true,
        prioridade: true,
        prazoEm: true,
        client: { select: { razaoSocial: true, nomeFantasia: true } },
        responsavel: { select: { nome: true } },
        tipo: { select: { nome: true, cor: true } },
        _count: { select: { subtarefas: true } },
      },
      orderBy: { posicao: "asc" },
      take: 500,
    }),
    prisma.client.findMany({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        ...(ator.clientesVisiveis ? { id: { in: ator.clientesVisiveis } } : {}),
      },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { razaoSocial: "asc" },
    }),
    prisma.demandType.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.membership.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      select: { user: { select: { id: true, nome: true } } },
      orderBy: { user: { nome: "asc" } },
    }),
  ]);

  return (
    <QuadroDemandas
      etapas={pipeline.etapas.map((e) => ({
        id: e.id,
        nome: e.nome,
        tipo: e.tipo,
      }))}
      demandas={demandas.map((d) => ({
        id: d.id,
        stageId: d.stageId,
        posicao: d.posicao,
        titulo: d.titulo,
        prioridade: d.prioridade,
        prazoEm: d.prazoEm?.toISOString() ?? null,
        cliente: d.client?.nomeFantasia ?? d.client?.razaoSocial ?? null,
        responsavel: d.responsavel?.nome ?? null,
        tipo: d.tipo?.nome ?? null,
        subtarefas: d._count.subtarefas,
      }))}
      clientes={clientes.map((c) => ({
        id: c.id,
        nome: c.nomeFantasia ?? c.razaoSocial,
      }))}
      tipos={tipos.map((t) => ({ id: t.id, nome: t.nome }))}
      equipe={equipe.map((m) => m.user)}
      filtroCliente={cliente ?? ""}
      filtroResponsavel={responsavel ?? ""}
      podeCriar={can(ator, "demandas:criar")}
      podeMover={can(ator, "demandas:editar")}
      vejoTudo={can(ator, "demandas:ler_todas")}
      meuId={ator.userId}
      abrirNova={sp.nova === "1"}
    />
  );
}

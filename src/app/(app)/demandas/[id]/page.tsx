import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can, podeCliente } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { FichaDemanda } from "./FichaDemanda";

export const dynamic = "force-dynamic";

export default async function DemandaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "demandas:ler")) redirect("/");

  const { id } = await params;

  const demanda = await prisma.demand.findFirst({
    where: { id, organizationId: ator.organizationId, deletadoEm: null },
    include: {
      client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      stage: true,
      tipo: true,
      responsavel: { select: { id: true, nome: true } },
      subtarefas: { orderBy: { ordem: "asc" } },
    },
  });

  if (!demanda) notFound();
  if (!podeCliente(ator, demanda.clientId)) notFound();

  // Quem só tem "demandas:ler" enxerga o que é seu. A checagem é aqui, no
  // servidor — não adianta esconder o link.
  if (
    !can(ator, "demandas:ler_todas") &&
    demanda.responsavelId !== ator.userId
  ) {
    notFound();
  }

  const [clientes, tipos, equipe, comentarios, historico] = await Promise.all([
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
    prisma.comment.findMany({
      where: {
        organizationId: ator.organizationId,
        entidadeTipo: "demanda",
        entidadeId: id,
        deletadoEm: null,
      },
      include: { autor: { select: { nome: true } } },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: ator.organizationId,
        entidadeTipo: "demanda",
        entidadeId: id,
      },
      include: { user: { select: { nome: true } } },
      orderBy: { em: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
      <Link
        href="/demandas"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Demandas
      </Link>

      <FichaDemanda
        demanda={{
          id: demanda.id,
          titulo: demanda.titulo,
          descricao: demanda.descricao,
          clienteId: demanda.client?.id ?? "",
          clienteNome:
            demanda.client?.nomeFantasia ?? demanda.client?.razaoSocial ?? null,
          etapa: demanda.stage.nome,
          etapaTipo: demanda.stage.tipo,
          tipoId: demanda.tipo?.id ?? "",
          prioridade: demanda.prioridade,
          responsavelId: demanda.responsavel?.id ?? "",
          prazoEm: demanda.prazoEm?.toISOString().slice(0, 10) ?? "",
          concluidaEm: demanda.concluidaEm?.toISOString() ?? null,
          criadoEm: demanda.criadoEm.toISOString(),
        }}
        subtarefas={demanda.subtarefas.map((s) => ({
          id: s.id,
          titulo: s.titulo,
          concluida: s.concluidaEm !== null,
        }))}
        comentarios={comentarios.map((c) => ({
          id: c.id,
          corpo: c.corpo,
          autor: c.autor.nome,
          criadoEm: c.criadoEm.toISOString(),
        }))}
        historico={historico.map((h) => ({
          id: h.id,
          resumo: h.resumo ?? h.acao,
          usuario: h.user?.nome ?? "Sistema",
          em: h.em.toISOString(),
        }))}
        clientes={clientes.map((c) => ({
          id: c.id,
          nome: c.nomeFantasia ?? c.razaoSocial,
        }))}
        tipos={tipos.map((t) => ({ id: t.id, nome: t.nome }))}
        equipe={equipe.map((m) => m.user)}
        podeEditar={can(ator, "demandas:editar")}
        podeExcluir={can(ator, "demandas:excluir")}
      />
    </div>
  );
}

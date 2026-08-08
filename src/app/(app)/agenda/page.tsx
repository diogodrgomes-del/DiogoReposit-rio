import { redirect } from "next/navigation";
import { exigirAtor } from "@/lib/auth/sessao";
import { can, escopoCliente } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { CalendarioMes } from "./CalendarioMes";

export const dynamic = "force-dynamic";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "agenda:ler")) redirect("/");

  const sp = await searchParams;
  const hoje = new Date();
  const ano = Number(sp.ano) || hoje.getFullYear();
  const mes = sp.mes !== undefined ? Number(sp.mes) : hoje.getMonth();

  // Busca a grade inteira do mês, incluindo os dias vizinhos que aparecem
  // nas bordas da primeira e da última semana.
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 42);

  const [eventos, clientes, equipe] = await Promise.all([
    prisma.event.findMany({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        canceladoEm: null,
        inicioEm: { gte: inicio, lt: fim },
        ...(sp.tipo ? { tipo: sp.tipo as "REUNIAO" } : {}),
        ...escopoCliente(ator),
      },
      include: {
        client: { select: { razaoSocial: true, nomeFantasia: true } },
        participantes: { include: { user: { select: { nome: true } } } },
      },
      orderBy: { inicioEm: "asc" },
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
    prisma.membership.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      select: { user: { select: { id: true, nome: true } } },
      orderBy: { user: { nome: "asc" } },
    }),
  ]);

  return (
    <CalendarioMes
      ano={ano}
      mes={mes}
      filtroTipo={sp.tipo ?? ""}
      eventos={eventos.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        tipo: e.tipo,
        inicioEm: e.inicioEm.toISOString(),
        fimEm: e.fimEm.toISOString(),
        local: e.local,
        cliente: e.client?.nomeFantasia ?? e.client?.razaoSocial ?? null,
        statusGravacao: e.statusGravacao,
        participantes: e.participantes.map((p) => p.user.nome),
      }))}
      clientes={clientes.map((c) => ({
        id: c.id,
        nome: c.nomeFantasia ?? c.razaoSocial,
      }))}
      equipe={equipe.map((m) => m.user)}
      podeCriar={can(ator, "agenda:criar")}
      abrirNovo={sp.novo === "1"}
    />
  );
}

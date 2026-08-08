import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { FichaLead } from "./FichaLead";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "leads:ler")) redirect("/");

  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    // organizationId no where, sempre: um id de outra organização
    // simplesmente não retorna linha.
    where: { id, organizationId: ator.organizationId, deletadoEm: null },
    include: {
      contact: true,
      stage: true,
      pipeline: { include: { etapas: { orderBy: { ordem: "asc" } } } },
      responsavel: { select: { id: true, nome: true } },
      origem: true,
      motivoPerda: true,
      client: { select: { id: true, razaoSocial: true } },
      atividades: {
        where: { deletadoEm: null },
        include: { responsavel: { select: { nome: true } } },
        orderBy: { criadoEm: "desc" },
        take: 30,
      },
      propostas: {
        where: { deletadoEm: null },
        orderBy: { criadoEm: "desc" },
      },
    },
  });

  if (!lead) notFound();

  // Histórico automático: sai da auditoria, não de alguém escrever à mão.
  const [historico, equipe, origens, motivos, planos] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        organizationId: ator.organizationId,
        entidadeTipo: "lead",
        entidadeId: id,
      },
      include: { user: { select: { nome: true } } },
      orderBy: { em: "desc" },
      take: 40,
    }),
    prisma.membership.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      select: { user: { select: { id: true, nome: true } } },
      orderBy: { user: { nome: "asc" } },
    }),
    prisma.leadOrigin.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.lossReason.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { ordem: "asc" },
    }),
    prisma.plan.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
      <Link
        href="/vendas"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Pipeline
      </Link>

      <FichaLead
        lead={{
          id: lead.id,
          nome: lead.contact.nome,
          telefone: lead.contact.telefone,
          email: lead.contact.email,
          empresa: lead.contact.empresa,
          instagram: lead.contact.instagram,
          cidade: lead.contact.cidade,
          valorCents: lead.valorEstimadoCents,
          temperatura: lead.temperatura,
          servicoInteresse: lead.servicoInteresse,
          proximaAcao: lead.proximaAcao,
          proximaAcaoEm: lead.proximaAcaoEm?.toISOString().slice(0, 10) ?? "",
          observacoes: lead.observacoes,
          etapa: lead.stage.nome,
          etapaTipo: lead.stage.tipo,
          responsavelId: lead.responsavel?.id ?? "",
          origemId: lead.origem?.id ?? "",
          motivoPerda: lead.motivoPerda?.nome ?? null,
          perdidoEm: lead.perdidoEm?.toISOString() ?? null,
          ganhoEm: lead.ganhoEm?.toISOString() ?? null,
          clienteId: lead.client?.id ?? null,
          clienteNome: lead.client?.razaoSocial ?? null,
          criadoEm: lead.criadoEm.toISOString(),
        }}
        atividades={lead.atividades.map((a) => ({
          id: a.id,
          tipo: a.tipo,
          titulo: a.titulo,
          responsavel: a.responsavel?.nome ?? null,
          iniciaEm: a.iniciaEm?.toISOString() ?? null,
          concluidaEm: a.concluidaEm?.toISOString() ?? null,
          criadoEm: a.criadoEm.toISOString(),
        }))}
        propostas={lead.propostas.map((p) => ({
          id: p.id,
          titulo: p.titulo,
          valorCents: p.valorCents,
          status: p.status,
        }))}
        historico={historico.map((h) => ({
          id: h.id,
          acao: h.acao,
          resumo: h.resumo ?? h.acao,
          usuario: h.user?.nome ?? "Sistema",
          em: h.em.toISOString(),
        }))}
        equipe={equipe.map((m) => m.user)}
        origens={origens.map((o) => ({ id: o.id, nome: o.nome }))}
        motivos={motivos.map((m) => ({ id: m.id, nome: m.nome }))}
        planos={planos.map((p) => ({
          id: p.id,
          nome: p.nome,
          valorBaseCents: p.valorBaseCents,
        }))}
        podeEditar={can(ator, "leads:editar")}
        podeConverter={can(ator, "clientes:criar")}
        podeExcluir={can(ator, "leads:excluir")}
      />
    </div>
  );
}

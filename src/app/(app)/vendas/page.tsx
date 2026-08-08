import { redirect } from "next/navigation";
import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina } from "@/components/layout/Pagina";
import { Vazio } from "@/components/ui/Estados";
import { Target } from "lucide-react";
import { PipelineVendas } from "./PipelineVendas";

export const dynamic = "force-dynamic";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "leads:ler")) redirect("/");

  const sp = await searchParams;
  const semRetorno = sp.semRetorno === "1";
  const responsavel = sp.responsavel;

  const pipeline = await prisma.pipeline.findFirst({
    where: { organizationId: ator.organizationId, tipo: "VENDAS" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });

  if (!pipeline) {
    return (
      <Pagina titulo="Vendas">
        <Vazio
          icone={Target}
          titulo="Nenhum pipeline configurado"
          descricao="Rode o seed (npm run db:seed) ou crie um pipeline em Configurações."
        />
      </Pagina>
    );
  }

  const agora = new Date();
  const ha7dias = new Date(Date.now() - 7 * 86_400_000);

  const [leads, origens, motivos, equipe, planos] = await Promise.all([
    prisma.lead.findMany({
      where: {
        organizationId: ator.organizationId,
        pipelineId: pipeline.id,
        deletadoEm: null,
        ...(responsavel ? { responsavelId: responsavel } : {}),
        ...(semRetorno
          ? {
              ganhoEm: null,
              perdidoEm: null,
              OR: [
                { proximaAcaoEm: { lt: agora } },
                { proximaAcaoEm: null, atualizadoEm: { lt: ha7dias } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        stageId: true,
        posicao: true,
        valorEstimadoCents: true,
        temperatura: true,
        proximaAcao: true,
        proximaAcaoEm: true,
        contact: { select: { nome: true, empresa: true, telefone: true } },
        responsavel: { select: { nome: true } },
      },
      orderBy: { posicao: "asc" },
      take: 500,
    }),
    prisma.leadOrigin.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.lossReason.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { ordem: "asc" },
    }),
    prisma.membership.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      select: { user: { select: { id: true, nome: true } } },
      orderBy: { user: { nome: "asc" } },
    }),
    prisma.plan.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <PipelineVendas
      etapas={pipeline.etapas.map((e) => ({
        id: e.id,
        nome: e.nome,
        tipo: e.tipo,
      }))}
      leads={leads.map((l) => ({
        id: l.id,
        stageId: l.stageId,
        posicao: l.posicao,
        nome: l.contact.nome,
        empresa: l.contact.empresa,
        telefone: l.contact.telefone,
        valorCents: l.valorEstimadoCents,
        temperatura: l.temperatura,
        proximaAcao: l.proximaAcao,
        proximaAcaoEm: l.proximaAcaoEm?.toISOString() ?? null,
        responsavel: l.responsavel?.nome ?? null,
      }))}
      origens={origens.map((o) => ({ id: o.id, nome: o.nome }))}
      motivos={motivos.map((m) => ({ id: m.id, nome: m.nome }))}
      equipe={equipe.map((m) => m.user)}
      planos={planos.map((p) => ({
        id: p.id,
        nome: p.nome,
        valorBaseCents: p.valorBaseCents,
      }))}
      podeCriar={can(ator, "leads:criar")}
      podeMover={can(ator, "leads:mover")}
      podeConverter={can(ator, "clientes:criar")}
      filtroSemRetorno={semRetorno}
      abrirNovo={sp.novo === "1"}
    />
  );
}

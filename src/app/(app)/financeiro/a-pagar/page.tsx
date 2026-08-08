import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina } from "@/components/layout/Pagina";
import { Vazio } from "@/components/ui/Estados";
import { Wallet } from "lucide-react";
import { moeda } from "@/lib/formato";
import { ListaContas } from "../ListaContas";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ator = await exigirAtor();

  const itens = await prisma.finEntry.findMany({
    where: {
      organizationId: ator.organizationId,
      deletadoEm: null,
      escopo: "EMPRESA",
      tipo: "DESPESA",
      status: { not: "CANCELADO" },
    },
    include: { client: { select: { razaoSocial: true, nomeFantasia: true } } },
    orderBy: [{ quitadoEm: { sort: "asc", nulls: "first" } }, { vencimentoEm: "asc" }],
    take: 200,
  });

  const emAberto = itens
    .filter((e) => !e.quitadoEm)
    .reduce((s, e) => s + (e.valorCents - e.valorPagoCents), 0);

  return (
    <Pagina
      titulo="Contas a pagar"
      descricao={`${moeda(emAberto)} em aberto`}
    >
      {itens.length === 0 ? (
        <Vazio icone={Wallet} titulo="Nenhum lançamento" />
      ) : (
        <ListaContas
          tipo="DESPESA"
          podeEditar={can(ator, "financeiro.empresa:editar")}
          podeExcluir={can(ator, "financeiro.empresa:excluir")}
          itens={itens.map((e) => ({
            id: e.id,
            descricao: e.descricao,
            contraparte:
              e.client?.nomeFantasia ?? e.client?.razaoSocial ?? e.fornecedor,
            valorCents: e.valorCents,
            valorPagoCents: e.valorPagoCents,
            vencimentoEm: e.vencimentoEm.toISOString(),
            status: e.status,
            quitado: e.quitadoEm !== null,
          }))}
        />
      )}
    </Pagina>
  );
}

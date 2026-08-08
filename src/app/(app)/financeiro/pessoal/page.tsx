import { notFound } from "next/navigation";
import { exigirAtor, stepUpValido } from "@/lib/auth/sessao";
import { prisma } from "@/lib/db";
import { Pagina, Secao } from "@/components/layout/Pagina";
import { Card, Indicador } from "@/components/ui/Card";
import { Vazio } from "@/components/ui/Estados";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { moeda } from "@/lib/formato";
import { NovoLancamentoBotao } from "../NovoLancamento";
import { ListaContas } from "../ListaContas";
import { PedirSenha } from "./PedirSenha";

export const dynamic = "force-dynamic";

/**
 * Financeiro pessoal do proprietário.
 *
 * Duas barreiras acima da do módulo: só o papel PROPRIETARIO, e só com
 * re-autenticação nos últimos 15 minutos. Nem ADMIN alcança — e o predicado
 * de consulta é sempre `escopo = PESSOAL AND ownerUserId = ator`.
 */
export default async function PessoalPage() {
  const ator = await exigirAtor();

  // 404, não 403: confirmar que a área existe já é informação.
  if (ator.papel !== "PROPRIETARIO") notFound();

  if (!stepUpValido(ator)) {
    return (
      <Pagina
        titulo="Financeiro pessoal"
        descricao="Confirme sua senha para continuar."
      >
        <PedirSenha />
      </Pagina>
    );
  }

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

  const base = {
    organizationId: ator.organizationId,
    deletadoEm: null,
    escopo: "PESSOAL" as const,
    ownerUserId: ator.userId,
  };

  const [receita, despesa, itens, categorias] = await Promise.all([
    prisma.finEntry.aggregate({
      _sum: { valorCents: true },
      where: { ...base, tipo: "RECEITA", competenciaEm: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.finEntry.aggregate({
      _sum: { valorCents: true },
      where: { ...base, tipo: "DESPESA", competenciaEm: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.finEntry.findMany({
      where: base,
      orderBy: [{ quitadoEm: { sort: "asc", nulls: "first" } }, { vencimentoEm: "asc" }],
      take: 100,
    }),
    prisma.finCategory.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  const r = receita._sum.valorCents ?? 0;
  const d = despesa._sum.valorCents ?? 0;

  return (
    <Pagina
      titulo="Financeiro pessoal"
      descricao="Separado do empresarial. Não entra em nenhum relatório da agência."
      acoes={
        <NovoLancamentoBotao
          escopo="PESSOAL"
          categorias={categorias.map((c) => ({
            id: c.id,
            nome: c.nome,
            tipo: c.tipo,
          }))}
          clientes={[]}
        />
      }
    >
      <Secao>
        <div className="grid gap-3 sm:grid-cols-3">
          <Indicador
            rotulo="Receitas do mês"
            valor={moeda(r)}
            href="/financeiro/pessoal"
            icone={TrendingUp}
            tom="positivo"
          />
          <Indicador
            rotulo="Despesas do mês"
            valor={moeda(d)}
            href="/financeiro/pessoal"
            icone={TrendingDown}
            tom="atencao"
          />
          <Indicador
            rotulo="Saldo"
            valor={moeda(r - d)}
            href="/financeiro/pessoal"
            icone={Wallet}
            tom={r - d >= 0 ? "positivo" : "risco"}
          />
        </div>
      </Secao>

      {itens.length === 0 ? (
        <Vazio
          icone={Wallet}
          titulo="Nenhum lançamento pessoal"
          descricao="Use o botão Lançar para registrar receitas e despesas suas."
        />
      ) : (
        <ListaContas
          tipo="DESPESA"
          podeEditar
          podeExcluir
          itens={itens.map((e) => ({
            id: e.id,
            descricao: e.descricao,
            contraparte: e.fornecedor,
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

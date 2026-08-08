import Link from "next/link";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina, Secao } from "@/components/layout/Pagina";
import { Card, CardTitulo, Indicador } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Vazio } from "@/components/ui/Estados";
import { moeda, data, diasDeAtraso } from "@/lib/formato";
import { NovoLancamentoBotao } from "./NovoLancamento";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const ator = await exigirAtor();

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

  const base = {
    organizationId: ator.organizationId,
    deletadoEm: null,
    escopo: "EMPRESA" as const,
  };

  const [
    receitaMes,
    despesaMes,
    recebido,
    pago,
    atrasadas,
    proximas,
    categorias,
    clientes,
  ] = await Promise.all([
    prisma.finEntry.aggregate({
      _sum: { valorCents: true },
      where: { ...base, tipo: "RECEITA", competenciaEm: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.finEntry.aggregate({
      _sum: { valorCents: true },
      where: { ...base, tipo: "DESPESA", competenciaEm: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.finEntry.aggregate({
      _sum: { valorPagoCents: true },
      where: { ...base, tipo: "RECEITA", quitadoEm: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.finEntry.aggregate({
      _sum: { valorPagoCents: true },
      where: { ...base, tipo: "DESPESA", quitadoEm: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.finEntry.findMany({
      where: {
        ...base,
        quitadoEm: null,
        vencimentoEm: { lt: new Date(hoje.toDateString()) },
      },
      include: { client: { select: { razaoSocial: true, nomeFantasia: true } } },
      orderBy: { vencimentoEm: "asc" },
      take: 10,
    }),
    prisma.finEntry.findMany({
      where: {
        ...base,
        quitadoEm: null,
        vencimentoEm: {
          gte: new Date(hoje.toDateString()),
          lte: new Date(Date.now() + 15 * 86_400_000),
        },
      },
      include: { client: { select: { razaoSocial: true, nomeFantasia: true } } },
      orderBy: { vencimentoEm: "asc" },
      take: 10,
    }),
    prisma.finCategory.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.client.findMany({
      where: { organizationId: ator.organizationId, deletadoEm: null },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { razaoSocial: "asc" },
    }),
  ]);

  const receita = receitaMes._sum.valorCents ?? 0;
  const despesa = despesaMes._sum.valorCents ?? 0;
  const resultado = receita - despesa;
  const caixa = (recebido._sum.valorPagoCents ?? 0) - (pago._sum.valorPagoCents ?? 0);
  const totalAtrasado = atrasadas.reduce(
    (s, e) => s + (e.valorCents - e.valorPagoCents),
    0
  );

  return (
    <Pagina
      titulo="Financeiro"
      descricao={`Competência de ${hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
      acoes={
        <>
          {ator.papel === "PROPRIETARIO" && (
            <Link
              href="/financeiro/pessoal"
              className="rounded-md border border-[var(--color-borda-forte)] px-2.5 py-1.5 text-[13px] text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)]"
            >
              Pessoal
            </Link>
          )}
          {can(ator, "financeiro.empresa:criar") && (
            <NovoLancamentoBotao
              categorias={categorias.map((c) => ({
                id: c.id,
                nome: c.nome,
                tipo: c.tipo,
              }))}
              clientes={clientes.map((c) => ({
                id: c.id,
                nome: c.nomeFantasia ?? c.razaoSocial,
              }))}
              escopo="EMPRESA"
            />
          )}
        </>
      }
    >
      <Secao>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo="Receita do mês"
            valor={moeda(receita)}
            href="/financeiro/a-receber"
            icone={TrendingUp}
            tom="positivo"
          />
          <Indicador
            rotulo="Despesa do mês"
            valor={moeda(despesa)}
            href="/financeiro/a-pagar"
            icone={TrendingDown}
            tom="atencao"
          />
          <Indicador
            rotulo="Resultado"
            valor={moeda(resultado)}
            href="/financeiro"
            icone={Wallet}
            tom={resultado >= 0 ? "positivo" : "risco"}
            detalhe="Receita menos despesa, por competência"
          />
          <Indicador
            rotulo="Em atraso"
            valor={moeda(totalAtrasado)}
            href="/financeiro/a-receber"
            icone={AlertTriangle}
            tom={totalAtrasado > 0 ? "risco" : "neutro"}
            detalhe={`${atrasadas.length} lançamento(s)`}
          />
        </div>
      </Secao>

      <p className="mb-5 text-[13px] text-[var(--color-texto-2)]">
        Caixa realizado no mês:{" "}
        <span
          className={cn(
            "tabular font-medium",
            caixa >= 0 ? "text-[var(--color-sucesso)]" : "text-[var(--color-erro)]"
          )}
        >
          {moeda(caixa)}
        </span>{" "}
        <span className="text-[var(--color-texto-3)]">
          (o que efetivamente entrou menos o que saiu)
        </span>
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitulo>Vencidos</CardTitulo>
          {atrasadas.length === 0 ? (
            <Vazio titulo="Nada vencido" className="m-4 border-0" />
          ) : (
            <ListaLancamentos itens={atrasadas} destacar />
          )}
        </Card>

        <Card>
          <CardTitulo>Próximos 15 dias</CardTitulo>
          {proximas.length === 0 ? (
            <Vazio titulo="Nada a vencer" className="m-4 border-0" />
          ) : (
            <ListaLancamentos itens={proximas} />
          )}
        </Card>
      </div>
    </Pagina>
  );
}

type Item = {
  id: string;
  descricao: string;
  tipo: string;
  status: string;
  valorCents: number;
  valorPagoCents: number;
  vencimentoEm: Date;
  client: { razaoSocial: string; nomeFantasia: string | null } | null;
};

function ListaLancamentos({
  itens,
  destacar,
}: {
  itens: Item[];
  destacar?: boolean;
}) {
  return (
    <ul className="divide-y divide-[var(--color-borda)]">
      {itens.map((e) => {
        const dias = diasDeAtraso(e.vencimentoEm);
        return (
          <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={cn(
                "h-7 w-1 shrink-0 rounded-full",
                e.tipo === "RECEITA"
                  ? "bg-[var(--color-sucesso)]"
                  : "bg-[var(--color-alerta)]"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium">{e.descricao}</p>
              <p className="truncate text-[12px] text-[var(--color-texto-3)]">
                {e.client?.nomeFantasia ?? e.client?.razaoSocial ?? "—"} ·{" "}
                {data(e.vencimentoEm)}
                {destacar && dias > 0 && ` · ${dias}d de atraso`}
              </p>
            </div>
            <span className="tabular shrink-0 text-[13px] font-medium">
              {moeda(e.valorCents - e.valorPagoCents)}
            </span>
            <StatusBadge status={destacar ? "ATRASADO" : e.status} />
          </li>
        );
      })}
    </ul>
  );
}

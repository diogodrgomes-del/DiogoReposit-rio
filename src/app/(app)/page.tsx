import { Suspense } from "react";
import Link from "next/link";
import {
  Target,
  ListChecks,
  CalendarDays,
  Users,
  Wallet,
  AlertTriangle,
  Clock,
  FileText,
  Video,
} from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can, escopoClienteOuInterno, escopoCliente } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina, Secao } from "@/components/layout/Pagina";
import { Card, CardTitulo, Indicador, Avatar } from "@/components/ui/Card";
import { SkeletonCards, Vazio } from "@/components/ui/Estados";
import { StatusBadge } from "@/components/ui/Badge";
import { moeda, dataCurta, hora, relativo } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function PainelGeral() {
  const ator = await exigirAtor();

  return (
    <Pagina
      titulo={`Olá, ${ator.nome.split(" ")[0]}`}
      descricao="Tudo que precisa da sua atenção hoje."
    >
      {/*
        Suspense por região: a tela aparece na hora e cada bloco entra quando
        chega. O painel inteiro não espera o indicador mais lento.
      */}
      <Suspense fallback={<SkeletonCards n={4} />}>
        <Indicadores />
      </Suspense>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Suspense fallback={null}>
          <MinhasDemandas />
        </Suspense>
        <Suspense fallback={null}>
          <AgendaDeHoje />
        </Suspense>
      </div>
    </Pagina>
  );
}

async function Indicadores() {
  const ator = await exigirAtor();
  const agora = new Date();
  const fimDoDia = new Date();
  fimDoDia.setHours(23, 59, 59, 999);
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const em7dias = new Date(Date.now() + 7 * 86_400_000);
  const ha7dias = new Date(Date.now() - 7 * 86_400_000);

  const escopoD = escopoClienteOuInterno(ator);
  const escopoC = escopoCliente(ator);

  const podeVender = can(ator, "leads:ler");
  const podeFinanceiro = can(ator, "financeiro.empresa:ler");
  const vejoTudo = can(ator, "demandas:ler_todas");

  /*
    Consultas independentes em paralelo. Cada uma é uma varredura de índice —
    contagem no banco, nunca carregar as linhas para contar em JS.
  */
  const [
    demandasAtrasadas,
    demandasHoje,
    demandasUrgentes,
    leadsNovos,
    leadsSemRetorno,
    reunioesHoje,
    gravacoesHoje,
    propostasPendentes,
    clientesAtivos,
    clientesRisco,
    aReceber,
    aPagar,
  ] = await Promise.all([
    prisma.demand.count({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        concluidaEm: null,
        prazoEm: { lt: agora },
        ...(vejoTudo ? {} : { responsavelId: ator.userId }),
        ...escopoD,
      },
    }),
    prisma.demand.count({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        concluidaEm: null,
        prazoEm: { gte: inicioDoDia, lte: fimDoDia },
        ...(vejoTudo ? {} : { responsavelId: ator.userId }),
        ...escopoD,
      },
    }),
    prisma.demand.count({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        concluidaEm: null,
        prioridade: "URGENTE",
        ...(vejoTudo ? {} : { responsavelId: ator.userId }),
        ...escopoD,
      },
    }),
    podeVender
      ? prisma.lead.count({
          where: {
            organizationId: ator.organizationId,
            deletadoEm: null,
            ganhoEm: null,
            perdidoEm: null,
            criadoEm: { gte: ha7dias },
          },
        })
      : 0,
    podeVender
      ? prisma.lead.count({
          where: {
            organizationId: ator.organizationId,
            deletadoEm: null,
            ganhoEm: null,
            perdidoEm: null,
            OR: [
              { proximaAcaoEm: { lt: agora } },
              { proximaAcaoEm: null, atualizadoEm: { lt: ha7dias } },
            ],
          },
        })
      : 0,
    prisma.event.count({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        canceladoEm: null,
        tipo: "REUNIAO",
        inicioEm: { gte: inicioDoDia, lte: fimDoDia },
        ...escopoC,
      },
    }),
    prisma.event.count({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        canceladoEm: null,
        tipo: "GRAVACAO",
        inicioEm: { gte: inicioDoDia, lte: fimDoDia },
        ...escopoC,
      },
    }),
    podeVender
      ? prisma.proposal.count({
          where: {
            organizationId: ator.organizationId,
            deletadoEm: null,
            status: { in: ["ENVIADA", "VISUALIZADA", "AGUARDANDO", "NEGOCIACAO"] },
          },
        })
      : 0,
    prisma.client.count({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        status: "ATIVO",
        ...(ator.clientesVisiveis
          ? { id: { in: ator.clientesVisiveis } }
          : {}),
      },
    }),
    prisma.client.count({
      where: {
        organizationId: ator.organizationId,
        deletadoEm: null,
        status: { in: ["INADIMPLENTE", "EM_RISCO"] },
        ...(ator.clientesVisiveis
          ? { id: { in: ator.clientesVisiveis } }
          : {}),
      },
    }),
    // Financeiro: a consulta só acontece com permissão. Sem ela nem o número
    // sai do banco — não é a tela que esconde.
    podeFinanceiro
      ? prisma.finEntry.aggregate({
          _sum: { valorCents: true },
          where: {
            organizationId: ator.organizationId,
            deletadoEm: null,
            escopo: "EMPRESA",
            tipo: "RECEITA",
            status: { in: ["PREVISTO", "PENDENTE", "ATRASADO"] },
            vencimentoEm: { lte: em7dias },
          },
        })
      : null,
    podeFinanceiro
      ? prisma.finEntry.aggregate({
          _sum: { valorCents: true },
          where: {
            organizationId: ator.organizationId,
            deletadoEm: null,
            escopo: "EMPRESA",
            tipo: "DESPESA",
            status: { in: ["PREVISTO", "PENDENTE", "ATRASADO"] },
            vencimentoEm: { lte: em7dias },
          },
        })
      : null,
  ]);

  return (
    <>
      <Secao titulo="Operação">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo="Demandas atrasadas"
            valor={demandasAtrasadas}
            href="/demandas/lista?prazo=atrasado"
            icone={AlertTriangle}
            tom={demandasAtrasadas > 0 ? "risco" : "neutro"}
            detalhe={demandasAtrasadas > 0 ? "Precisa de ação" : "Nada atrasado"}
          />
          <Indicador
            rotulo="Para hoje"
            valor={demandasHoje}
            href="/demandas/lista?prazo=hoje"
            icone={Clock}
            tom={demandasHoje > 0 ? "atencao" : "neutro"}
          />
          <Indicador
            rotulo="Urgentes"
            valor={demandasUrgentes}
            href="/demandas/lista?prioridade=URGENTE"
            icone={ListChecks}
            tom={demandasUrgentes > 0 ? "atencao" : "neutro"}
          />
          <Indicador
            rotulo="Reuniões hoje"
            valor={reunioesHoje}
            href="/agenda?visao=dia"
            icone={CalendarDays}
            detalhe={gravacoesHoje > 0 ? `${gravacoesHoje} gravação(ões)` : undefined}
          />
        </div>
      </Secao>

      {can(ator, "leads:ler") && (
        <Secao titulo="Comercial">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador
              rotulo="Leads novos (7 dias)"
              valor={leadsNovos}
              href="/vendas"
              icone={Target}
            />
            <Indicador
              rotulo="Leads sem retorno"
              valor={leadsSemRetorno}
              href="/vendas?semRetorno=1"
              icone={AlertTriangle}
              tom={leadsSemRetorno > 0 ? "atencao" : "neutro"}
              detalhe="Passou da data da próxima ação"
            />
            <Indicador
              rotulo="Propostas pendentes"
              valor={propostasPendentes}
              href="/vendas/propostas?status=pendentes"
              icone={FileText}
            />
            <Indicador
              rotulo="Clientes ativos"
              valor={clientesAtivos}
              href="/clientes?status=ATIVO"
              icone={Users}
              tom="positivo"
              detalhe={clientesRisco > 0 ? `${clientesRisco} em risco` : undefined}
            />
          </div>
        </Secao>
      )}

      {can(ator, "financeiro.empresa:ler") && (
        <Secao titulo="Financeiro">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador
              rotulo="A receber (7 dias)"
              valor={moeda(aReceber?._sum.valorCents ?? 0)}
              href="/financeiro/a-receber"
              icone={Wallet}
              tom="positivo"
            />
            <Indicador
              rotulo="A pagar (7 dias)"
              valor={moeda(aPagar?._sum.valorCents ?? 0)}
              href="/financeiro/a-pagar"
              icone={Wallet}
              tom="atencao"
            />
            <Indicador
              rotulo="Clientes em risco"
              valor={clientesRisco}
              href="/clientes?status=INADIMPLENTE"
              icone={AlertTriangle}
              tom={clientesRisco > 0 ? "risco" : "neutro"}
            />
            <Indicador
              rotulo="Gravações hoje"
              valor={gravacoesHoje}
              href="/agenda/gravacoes"
              icone={Video}
            />
          </div>
        </Secao>
      )}
    </>
  );
}

async function MinhasDemandas() {
  const ator = await exigirAtor();

  const demandas = await prisma.demand.findMany({
    where: {
      organizationId: ator.organizationId,
      deletadoEm: null,
      concluidaEm: null,
      arquivadaEm: null,
      responsavelId: ator.userId,
      ...escopoClienteOuInterno(ator),
    },
    include: {
      client: { select: { razaoSocial: true, nomeFantasia: true } },
      stage: { select: { nome: true } },
    },
    orderBy: [{ prazoEm: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
    take: 8,
  });

  return (
    <Card>
      <CardTitulo
        acao={
          <Link
            href="/demandas"
            className="text-[13px] text-azul-600 hover:underline"
          >
            Ver todas
          </Link>
        }
      >
        Minhas demandas
      </CardTitulo>

      {demandas.length === 0 ? (
        <Vazio
          icone={ListChecks}
          titulo="Nada na sua fila"
          descricao="Quando alguém atribuir uma demanda a você, ela aparece aqui."
          className="m-4 border-0"
        />
      ) : (
        <ul className="divide-y divide-[var(--color-borda)]">
          {demandas.map((d) => {
            const atrasada = d.prazoEm && d.prazoEm < new Date();
            return (
              <li key={d.id}>
                <Link
                  href={`/demandas/${d.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-fundo-hover)]"
                >
                  <span
                    className={`h-8 w-[3px] shrink-0 rounded-full ${
                      d.prioridade === "URGENTE"
                        ? "bg-[var(--color-erro)]"
                        : d.prioridade === "ALTA"
                          ? "bg-[var(--color-alerta)]"
                          : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">
                      {d.titulo}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-texto-3)]">
                      {d.client?.nomeFantasia ?? d.client?.razaoSocial ?? "Interno"}
                      {" · "}
                      {d.stage.nome}
                    </p>
                  </div>
                  {d.prazoEm && (
                    <span
                      className={`shrink-0 text-[12px] ${
                        atrasada
                          ? "font-medium text-[var(--color-erro)]"
                          : "text-[var(--color-texto-3)]"
                      }`}
                    >
                      {dataCurta(d.prazoEm)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

async function AgendaDeHoje() {
  const ator = await exigirAtor();
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);

  const eventos = await prisma.event.findMany({
    where: {
      organizationId: ator.organizationId,
      deletadoEm: null,
      canceladoEm: null,
      inicioEm: { gte: inicio, lte: fim },
      ...escopoCliente(ator),
    },
    include: {
      client: { select: { razaoSocial: true, nomeFantasia: true } },
      participantes: { include: { user: { select: { nome: true } } } },
    },
    orderBy: { inicioEm: "asc" },
    take: 8,
  });

  return (
    <Card>
      <CardTitulo
        acao={
          <Link
            href="/agenda"
            className="text-[13px] text-azul-600 hover:underline"
          >
            Abrir agenda
          </Link>
        }
      >
        Hoje na agenda
      </CardTitulo>

      {eventos.length === 0 ? (
        <Vazio
          icone={CalendarDays}
          titulo="Nenhum compromisso hoje"
          className="m-4 border-0"
        />
      ) : (
        <ul className="divide-y divide-[var(--color-borda)]">
          {eventos.map((e) => (
            <li key={e.id}>
              <Link
                href={`/agenda/${e.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-fundo-hover)]"
              >
                <span className="tabular w-11 shrink-0 text-[12px] font-medium text-[var(--color-texto-2)]">
                  {e.diaInteiro ? "dia" : hora(e.inicioEm)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{e.titulo}</p>
                  <p className="truncate text-[12px] text-[var(--color-texto-3)]">
                    {e.client?.nomeFantasia ?? e.client?.razaoSocial ?? "Interno"}
                    {e.local ? ` · ${e.local}` : ""}
                  </p>
                </div>
                {e.tipo === "GRAVACAO" && e.statusGravacao && (
                  <StatusBadge status={e.statusGravacao} />
                )}
                <div className="flex -space-x-1.5">
                  {e.participantes.slice(0, 3).map((p) => (
                    <Avatar
                      key={p.id}
                      nome={p.user.nome}
                      tamanho={20}
                      className="ring-2 ring-[var(--color-fundo-elevado)]"
                    />
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

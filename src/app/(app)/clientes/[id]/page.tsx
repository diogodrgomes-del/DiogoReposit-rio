import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ListChecks, Target, Lightbulb, BarChart3 } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can, podeCliente } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Card, CardTitulo, Avatar } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Vazio } from "@/components/ui/Estados";
import { moeda, data, dataCurta, relativo } from "@/lib/formato";
import { FichaCliente } from "./FichaCliente";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "clientes:ler")) redirect("/");

  const { id } = await params;
  if (!podeCliente(ator, id)) notFound();

  const cliente = await prisma.client.findFirst({
    where: { id, organizationId: ator.organizationId, deletadoEm: null },
    include: {
      responsavel: { select: { id: true, nome: true } },
      contratos: {
        where: { deletadoEm: null },
        include: { plano: true },
        orderBy: { inicioEm: "desc" },
      },
      demandas: {
        where: { deletadoEm: null, concluidaEm: null },
        include: {
          stage: { select: { nome: true } },
          responsavel: { select: { nome: true } },
        },
        orderBy: [{ prazoEm: { sort: "asc", nulls: "last" } }],
        take: 8,
      },
      leads: {
        where: { deletadoEm: null },
        include: { contact: { select: { nome: true } } },
        take: 5,
      },
    },
  });

  if (!cliente) notFound();

  const verValores = can(ator, "clientes:ver_contrato");

  const [equipe, historico] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: ator.organizationId, ativo: true },
      select: { user: { select: { id: true, nome: true } } },
      orderBy: { user: { nome: "asc" } },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: ator.organizationId,
        entidadeTipo: "cliente",
        entidadeId: id,
      },
      include: { user: { select: { nome: true } } },
      orderBy: { em: "desc" },
      take: 25,
    }),
  ]);

  const contratoAtivo = cliente.contratos.find((c) => c.status === "ATIVO");

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Clientes
      </Link>

      <FichaCliente
        cliente={{
          id: cliente.id,
          razaoSocial: cliente.razaoSocial,
          nomeFantasia: cliente.nomeFantasia,
          cnpj: cliente.cnpj,
          segmento: cliente.segmento,
          telefone: cliente.telefone,
          whatsapp: cliente.whatsapp,
          email: cliente.email,
          cidade: cliente.cidade,
          uf: cliente.uf,
          endereco: cliente.endereco,
          instagram: cliente.instagram,
          site: cliente.site,
          gmnUrl: cliente.gmnUrl,
          observacoes: cliente.observacoes,
          status: cliente.status,
          saude: cliente.saude,
          responsavelId: cliente.responsavel?.id ?? "",
          entrouEm: cliente.entrouEm?.toISOString() ?? null,
        }}
        equipe={equipe.map((m) => m.user)}
        podeEditar={can(ator, "clientes:editar")}
        podeExcluir={can(ator, "clientes:excluir")}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {verValores && (
            <Card>
              <CardTitulo>Contrato</CardTitulo>
              {contratoAtivo ? (
                <dl className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-[12px] text-[var(--color-texto-3)]">
                      Plano
                    </dt>
                    <dd className="mt-0.5 text-[13.5px] font-medium">
                      {contratoAtivo.plano?.nome ?? "Personalizado"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-[var(--color-texto-3)]">
                      Mensalidade
                    </dt>
                    <dd className="tabular mt-0.5 text-[13.5px] font-medium">
                      {moeda(contratoAtivo.valorMensalCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-[var(--color-texto-3)]">
                      Vencimento
                    </dt>
                    <dd className="mt-0.5 text-[13.5px] font-medium">
                      dia {contratoAtivo.diaVencimento}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-[var(--color-texto-3)]">
                      Início
                    </dt>
                    <dd className="mt-0.5 text-[13.5px] font-medium">
                      {data(contratoAtivo.inicioEm)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <Vazio
                  titulo="Sem contrato ativo"
                  descricao="Contratos são criados na conversão de um lead ganho."
                  className="m-4 border-0"
                />
              )}
            </Card>
          )}

          <Card>
            <CardTitulo
              acao={
                <Link
                  href={`/demandas?cliente=${cliente.id}`}
                  className="text-[13px] text-azul-600 hover:underline"
                >
                  Ver todas
                </Link>
              }
            >
              Demandas em aberto
            </CardTitulo>
            {cliente.demandas.length === 0 ? (
              <Vazio
                icone={ListChecks}
                titulo="Nenhuma demanda aberta"
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-[var(--color-borda)]">
                {cliente.demandas.map((d) => {
                  const atrasada = d.prazoEm && d.prazoEm < new Date();
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/demandas/${d.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-fundo-hover)]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium">
                            {d.titulo}
                          </p>
                          <p className="text-[12px] text-[var(--color-texto-3)]">
                            {d.stage.nome}
                            {d.responsavel ? ` · ${d.responsavel.nome}` : ""}
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
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitulo>Áreas do cliente</CardTitulo>
            <div className="p-2">
              <Atalho
                href={`/clientes/${cliente.id}/estrategia`}
                icone={Lightbulb}
                titulo="Estratégia"
                detalhe="Objetivo, público, tom de voz, pilares"
              />
              <Atalho
                href={`/demandas?cliente=${cliente.id}`}
                icone={ListChecks}
                titulo="Demandas"
                detalhe="Produção e entregas"
              />
              <Atalho
                href="/trafego"
                icone={BarChart3}
                titulo="Tráfego"
                detalhe="Campanhas e resultados"
              />
              {cliente.leads.length > 0 && (
                <Atalho
                  href={`/vendas/lead/${cliente.leads[0].id}`}
                  icone={Target}
                  titulo="Lead de origem"
                  detalhe={cliente.leads[0].contact.nome}
                />
              )}
            </div>
          </Card>

          <Card>
            <CardTitulo>Histórico</CardTitulo>
            {historico.length === 0 ? (
              <p className="p-4 text-[13px] text-[var(--color-texto-3)]">
                Sem registros ainda.
              </p>
            ) : (
              <ul className="max-h-[400px] overflow-y-auto">
                {historico.map((h) => (
                  <li
                    key={h.id}
                    className="border-b border-[var(--color-borda)] px-4 py-2 last:border-0"
                  >
                    <p className="text-[12.5px]">{h.resumo ?? h.acao}</p>
                    <p className="text-[11.5px] text-[var(--color-texto-3)]">
                      {h.user?.nome ?? "Sistema"} · {relativo(h.em)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Atalho({
  href,
  icone: Icone,
  titulo,
  detalhe,
}: {
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  detalhe: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-2.5 py-2 hover:bg-[var(--color-fundo-hover)]"
    >
      <Icone className="h-4 w-4 shrink-0 text-[var(--color-texto-3)]" />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{titulo}</span>
        <span className="block truncate text-[12px] text-[var(--color-texto-3)]">
          {detalhe}
        </span>
      </span>
    </Link>
  );
}

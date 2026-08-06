import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  clientes,
  comContexto,
  contasAnuncio,
  contatos,
  leads,
  metricasDiarias,
  pipelineEtapas,
} from "@mark/db";
import { pode, type Contexto } from "./contexto";

/**
 * Painel Geral — o centro de comando.
 *
 * Duas regras governam esta tela:
 *
 * 1. **Todo número é clicável e leva à lista já filtrada.** Um indicador que
 *    não leva a lugar nenhum obriga a pessoa a procurar o que ele resumiu, e aí
 *    o painel virou enfeite. Os destinos ficam em `href` junto do número, para
 *    não se perderem quando alguém mexer na tela.
 *
 * 2. **Cada bloco respeita a permissão de quem olha.** Quem não vê financeiro
 *    não recebe o número financeiro nem zerado — o dado nem é consultado. E os
 *    blocos são independentes: um módulo indisponível não derruba o painel.
 */

export type Indicador = {
  rotulo: string;
  valor: string;
  href?: string;
  /** `atencao` e `risco` pintam o número; a cor nunca vem sozinha. */
  tom?: "normal" | "atencao" | "risco";
  detalhe?: string;
};

export type BlocoPainel = {
  titulo: string;
  indicadores: Indicador[];
};

const inteiro = new Intl.NumberFormat("pt-BR");
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Monta o painel inteiro.
 *
 * Cada bloco é embrulhado em try/catch por conta própria: uma tabela que ainda
 * não existe, ou uma consulta que falhou, tira aquele bloco da tela — não a
 * tela toda. É a mesma regra do error boundary por seção, aplicada no servidor.
 */
export async function montar(ctx: Contexto): Promise<BlocoPainel[]> {
  const blocos: BlocoPainel[] = [];

  const tentar = async (fn: () => Promise<BlocoPainel | null>) => {
    try {
      const bloco = await fn();
      if (bloco && bloco.indicadores.length > 0) blocos.push(bloco);
    } catch (e) {
      console.error("Bloco do painel indisponível:", e instanceof Error ? e.message : e);
    }
  };

  if (pode(ctx, "vendas.lead.ver")) await tentar(() => blocoComercial(ctx));
  if (pode(ctx, "clientes.cliente.ver")) await tentar(() => blocoClientes(ctx));
  if (pode(ctx, "trafego.painel.ver")) await tentar(() => blocoTrafego(ctx));

  return blocos;
}

async function blocoComercial(ctx: Contexto): Promise<BlocoPainel> {
  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        novos: sql<number>`count(*) FILTER (WHERE ${leads.criadoEm} >= now() - interval '7 days')::int`,
        emAberto: sql<number>`count(*) FILTER (WHERE ${leads.fechadoEm} IS NULL AND ${leads.perdidoEm} IS NULL)::int`,
        semRetorno: sql<number>`count(*) FILTER (WHERE ${leads.proximoContatoEm} < current_date AND ${leads.fechadoEm} IS NULL AND ${leads.perdidoEm} IS NULL)::int`,
        fechadosMes: sql<number>`count(*) FILTER (WHERE ${leads.fechadoEm} >= date_trunc('month', current_date))::int`,
        valorAberto: sql<string>`coalesce(sum(${leads.valorEstimado}) FILTER (WHERE ${leads.fechadoEm} IS NULL AND ${leads.perdidoEm} IS NULL), 0)`,
      })
      .from(leads)
      .where(and(eq(leads.organizacaoId, ctx.organizacaoId), isNull(leads.excluidoEm)));

    const r = linhas[0];

    return {
      titulo: "Comercial",
      indicadores: [
        {
          rotulo: "Leads novos (7 dias)",
          valor: inteiro.format(r?.novos ?? 0),
          href: "/vendas",
        },
        {
          rotulo: "Em aberto",
          valor: inteiro.format(r?.emAberto ?? 0),
          href: "/vendas",
        },
        {
          rotulo: "Sem retorno",
          valor: inteiro.format(r?.semRetorno ?? 0),
          href: "/vendas",
          tom: (r?.semRetorno ?? 0) > 0 ? "risco" : "normal",
          detalhe: (r?.semRetorno ?? 0) > 0 ? "A data de retorno já passou" : undefined,
        },
        {
          rotulo: "Fechados no mês",
          valor: inteiro.format(r?.fechadosMes ?? 0),
          href: "/vendas",
        },
        {
          rotulo: "Valor em aberto",
          valor: moeda.format(Number(r?.valorAberto ?? 0)),
          href: "/vendas",
        },
      ],
    };
  });
}

async function blocoClientes(ctx: Contexto): Promise<BlocoPainel> {
  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        ativos: sql<number>`count(*) FILTER (WHERE ${clientes.status} = 'ativo')::int`,
        onboarding: sql<number>`count(*) FILTER (WHERE ${clientes.status} = 'onboarding')::int`,
        inadimplentes: sql<number>`count(*) FILTER (WHERE ${clientes.status} = 'inadimplente')::int`,
        emRisco: sql<number>`count(*) FILTER (WHERE ${clientes.saude} = 'vermelho')::int`,
        atencao: sql<number>`count(*) FILTER (WHERE ${clientes.saude} = 'amarelo')::int`,
      })
      .from(clientes)
      .where(and(eq(clientes.organizacaoId, ctx.organizacaoId), isNull(clientes.excluidoEm)));

    const r = linhas[0];

    return {
      titulo: "Clientes",
      indicadores: [
        { rotulo: "Ativos", valor: inteiro.format(r?.ativos ?? 0), href: "/clientes?status=ativo" },
        {
          rotulo: "Em onboarding",
          valor: inteiro.format(r?.onboarding ?? 0),
          href: "/clientes?status=onboarding",
        },
        {
          rotulo: "Precisam de atenção",
          valor: inteiro.format(r?.atencao ?? 0),
          href: "/clientes",
          tom: (r?.atencao ?? 0) > 0 ? "atencao" : "normal",
        },
        {
          rotulo: "Em risco",
          valor: inteiro.format(r?.emRisco ?? 0),
          href: "/clientes",
          tom: (r?.emRisco ?? 0) > 0 ? "risco" : "normal",
        },
        {
          rotulo: "Inadimplentes",
          valor: inteiro.format(r?.inadimplentes ?? 0),
          href: "/clientes?status=inadimplente",
          tom: (r?.inadimplentes ?? 0) > 0 ? "risco" : "normal",
        },
      ],
    };
  });
}

async function blocoTrafego(ctx: Contexto): Promise<BlocoPainel> {
  const ate = new Date();
  const de = new Date(ate.getTime() - 7 * 86_400_000);

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        gasto: sql<string>`coalesce(sum(${metricasDiarias.gasto}), 0)`,
        conversas: sql<number>`coalesce(sum(${metricasDiarias.conversas}), 0)::int`,
      })
      .from(metricasDiarias)
      .where(
        and(
          eq(metricasDiarias.organizacaoId, ctx.organizacaoId),
          isNull(metricasDiarias.campanhaExternaId),
          gte(metricasDiarias.dia, iso(de)),
          lte(metricasDiarias.dia, iso(ate)),
        ),
      );

    const contas = await tx
      .select({
        total: sql<number>`count(*)::int`,
        comErro: sql<number>`count(*) FILTER (WHERE ${contasAnuncio.ultimoErro} IS NOT NULL)::int`,
        desatualizadas: sql<number>`count(*) FILTER (WHERE ${contasAnuncio.ultimaSincronizacao} IS NULL OR ${contasAnuncio.ultimaSincronizacao} < now() - interval '3 hours')::int`,
      })
      .from(contasAnuncio)
      .where(
        and(
          eq(contasAnuncio.organizacaoId, ctx.organizacaoId),
          eq(contasAnuncio.ativa, true),
          isNull(contasAnuncio.excluidoEm),
        ),
      );

    const m = linhas[0];
    const c = contas[0];
    const gasto = Number(m?.gasto ?? 0);
    const conversas = m?.conversas ?? 0;

    const indicadores: Indicador[] = [
      { rotulo: "Investido (7 dias)", valor: moeda.format(gasto) },
      { rotulo: "Conversas iniciadas", valor: inteiro.format(conversas) },
      {
        rotulo: "Custo por conversa",
        // Sem conversa não há custo por conversa. Mostrar R$ 0,00 seria mentira,
        // e mostrar infinito não ajuda ninguém.
        valor: conversas > 0 ? moeda.format(gasto / conversas) : "—",
        detalhe: conversas === 0 ? "Ainda sem conversas no período" : undefined,
      },
      { rotulo: "Contas ativas", valor: inteiro.format(c?.total ?? 0) },
    ];

    // Só aparece quando há problema. Indicador que fica sempre em zero ensina a
    // ignorar a região da tela onde ele mora.
    if ((c?.comErro ?? 0) > 0) {
      indicadores.push({
        rotulo: "Contas com erro",
        valor: inteiro.format(c?.comErro ?? 0),
        tom: "risco",
        detalhe: "Token vencido ou sem permissão",
      });
    } else if ((c?.desatualizadas ?? 0) > 0 && (c?.total ?? 0) > 0) {
      indicadores.push({
        rotulo: "Sem sincronizar",
        valor: inteiro.format(c?.desatualizadas ?? 0),
        tom: "atencao",
        detalhe: "O worker está rodando?",
      });
    }

    return { titulo: "Tráfego", indicadores };
  });
}

export type ItemAgenda = {
  id: string;
  titulo: string;
  detalhe: string | null;
  href: string;
  atrasado: boolean;
};

/**
 * O que exige ação hoje.
 *
 * Lista curta de propósito: um painel que mostra tudo não mostra nada. Vinte
 * itens no máximo, os mais atrasados primeiro.
 */
export async function precisaDeAtencao(ctx: Contexto): Promise<ItemAgenda[]> {
  if (!pode(ctx, "vendas.lead.ver")) return [];

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        id: leads.id,
        nome: contatos.nome,
        etapa: pipelineEtapas.nome,
        proximaAcao: leads.proximaAcao,
        quando: leads.proximoContatoEm,
      })
      .from(leads)
      .innerJoin(contatos, eq(contatos.id, leads.contatoId))
      .innerJoin(pipelineEtapas, eq(pipelineEtapas.id, leads.etapaId))
      .where(
        and(
          eq(leads.organizacaoId, ctx.organizacaoId),
          isNull(leads.excluidoEm),
          isNull(leads.fechadoEm),
          isNull(leads.perdidoEm),
          sql`${leads.proximoContatoEm} <= current_date`,
        ),
      )
      .orderBy(leads.proximoContatoEm)
      .limit(20);

    return linhas.map((l) => ({
      id: l.id,
      titulo: l.nome,
      detalhe: l.proximaAcao ?? l.etapa,
      href: `/vendas/${l.id}`,
      atrasado: Boolean(l.quando && l.quando < iso(new Date())),
    }));
  });
}

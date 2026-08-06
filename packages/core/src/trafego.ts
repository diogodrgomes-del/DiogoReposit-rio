import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { decifrar, type Envelope } from "@mark/cofre";
import { metaAds } from "@mark/integracoes";
import {
  clientes as tabelaClientes,
  comContexto,
  contasAnuncio,
  credenciais,
  metricasDiarias,
  novoId,
  syncExecucoes,
  type Transacao,
} from "@mark/db";
import { exigir, filtroDeClientes, type Contexto } from "./contexto";

/**
 * Gestão de tráfego.
 *
 * A decisão que sustenta este módulo: **a tela lê o banco, não a Graph API.**
 *
 * O painel atual consulta a Meta a cada requisição, e para um cliente por vez
 * está certo — o dado vive lá e copiar não ajudaria. Para a carteira inteira,
 * não: são vinte chamadas sequenciais a uma API de terceiro com limite de taxa,
 * oito a quinze segundos de espera, e uma queda da Meta derruba a tela.
 *
 * Com o worker sincronizando a série para cá, a consulta é indexada, funciona
 * com a Meta fora do ar, e o histórico passa a ser nosso — a Meta só devolve 37
 * meses.
 */

export type ContaAnuncio = {
  id: string;
  clienteId: string | null;
  plataforma: string;
  externoId: string;
  nome: string;
  moeda: string;
  ativa: boolean;
  ultimaSincronizacao: Date | null;
  ultimoErro: string | null;
};

export type PontoDiario = {
  dia: string;
  gasto: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  cliquesLink: number;
  conversas: number;
  resposta1: number;
  prof2: number;
  prof3: number;
  prof5: number;
};

/** Custo por conversa. `null` sem conversa: dividir por zero não é infinito, é "ainda não dá para dizer". */
export function custoPorConversa(gasto: number, conversas: number): number | null {
  return conversas > 0 ? gasto / conversas : null;
}

export async function listarContas(ctx: Contexto, clienteId?: string): Promise<ContaAnuncio[]> {
  exigir(ctx, "trafego.painel.ver", clienteId ? { clienteId } : undefined);
  const permitidos = filtroDeClientes(ctx);
  if (permitidos?.length === 0) return [];

  return comContexto(ctx, async (tx) => {
    const condicoes = [isNull(contasAnuncio.excluidoEm)];
    if (clienteId) condicoes.push(eq(contasAnuncio.clienteId, clienteId));
    else if (permitidos) condicoes.push(inArray(contasAnuncio.clienteId, permitidos));

    return tx
      .select({
        id: contasAnuncio.id,
        clienteId: contasAnuncio.clienteId,
        plataforma: contasAnuncio.plataforma,
        externoId: contasAnuncio.externoId,
        nome: contasAnuncio.nome,
        moeda: contasAnuncio.moeda,
        ativa: contasAnuncio.ativa,
        ultimaSincronizacao: contasAnuncio.ultimaSincronizacao,
        ultimoErro: contasAnuncio.ultimoErro,
      })
      .from(contasAnuncio)
      .where(and(...condicoes))
      .orderBy(contasAnuncio.nome);
  });
}

/**
 * Série diária de uma conta.
 *
 * Lê só as linhas de total (`campanha_externa_id IS NULL`), que é o que o
 * gráfico do painel mostra. O índice parcial cobre exatamente esta consulta.
 */
export async function serie(
  ctx: Contexto,
  contaId: string,
  de: string,
  ate: string,
): Promise<PontoDiario[]> {
  exigir(ctx, "trafego.painel.ver");

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        dia: metricasDiarias.dia,
        gasto: metricasDiarias.gasto,
        impressoes: metricasDiarias.impressoes,
        alcance: metricasDiarias.alcance,
        cliques: metricasDiarias.cliques,
        cliquesLink: metricasDiarias.cliquesLink,
        conversas: metricasDiarias.conversas,
        resposta1: metricasDiarias.resposta1,
        prof2: metricasDiarias.prof2,
        prof3: metricasDiarias.prof3,
        prof5: metricasDiarias.prof5,
      })
      .from(metricasDiarias)
      .where(
        and(
          eq(metricasDiarias.contaId, contaId),
          isNull(metricasDiarias.campanhaExternaId),
          gte(metricasDiarias.dia, de),
          lte(metricasDiarias.dia, ate),
        ),
      )
      .orderBy(metricasDiarias.dia);

    return linhas.map((l) => ({ ...l, gasto: Number(l.gasto) }));
  });
}

export type ResumoCarteira = {
  clienteId: string | null;
  clienteNome: string;
  gasto: number;
  conversas: number;
  custoConversa: number | null;
};

/**
 * A visão da carteira: cada cliente com seu custo por conversa, do mais barato
 * ao mais caro. É o número que decide para onde vai a verba.
 *
 * Uma consulta agregada no banco, não vinte chamadas à Meta.
 */
export async function carteira(
  ctx: Contexto,
  de: string,
  ate: string,
): Promise<ResumoCarteira[]> {
  exigir(ctx, "trafego.painel.ver");
  const permitidos = filtroDeClientes(ctx);
  if (permitidos?.length === 0) return [];

  return comContexto(ctx, async (tx) => {
    const condicoes = [
      isNull(metricasDiarias.campanhaExternaId),
      gte(metricasDiarias.dia, de),
      lte(metricasDiarias.dia, ate),
    ];
    if (permitidos) condicoes.push(inArray(contasAnuncio.clienteId, permitidos));

    const linhas = await tx
      .select({
        clienteId: contasAnuncio.clienteId,
        clienteNome: sql<string>`coalesce(${tabelaClientes.nome}, ${contasAnuncio.nome})`,
        gasto: sql<string>`sum(${metricasDiarias.gasto})`,
        conversas: sql<number>`sum(${metricasDiarias.conversas})::int`,
      })
      .from(metricasDiarias)
      .innerJoin(contasAnuncio, eq(contasAnuncio.id, metricasDiarias.contaId))
      .leftJoin(tabelaClientes, eq(tabelaClientes.id, contasAnuncio.clienteId))
      .where(and(...condicoes))
      .groupBy(contasAnuncio.clienteId, tabelaClientes.nome, contasAnuncio.nome);

    return linhas
      .map((l) => {
        const gasto = Number(l.gasto ?? 0);
        return {
          clienteId: l.clienteId,
          clienteNome: l.clienteNome,
          gasto,
          conversas: l.conversas,
          custoConversa: custoPorConversa(gasto, l.conversas),
        };
      })
      .sort((a, b) => {
        // Sem conversa não há custo por conversa — essas vão para o fim, em vez
        // de fingirem ser as mais baratas.
        if (a.custoConversa === null) return 1;
        if (b.custoConversa === null) return -1;
        return a.custoConversa - b.custoConversa;
      });
  });
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

export type ResultadoSync = {
  contaId: string;
  conta: string;
  linhas: number;
  erro?: string;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Sincroniza uma conta.
 *
 * Grava só as linhas de **total por dia** (campanha nula). Métrica por campanha
 * e por dia multiplica o volume por dezenas e ainda não tem tela que a use —
 * entra quando entrar.
 *
 * Refaz sempre uma janela dos últimos dias em vez de só o que falta: a Meta
 * revisa números retroativamente por causa da janela de atribuição de 7 dias,
 * então "já sincronizei esse dia" não significa que ele não mudou.
 */
export async function sincronizarConta(
  tx: Transacao,
  ctx: Contexto,
  conta: { id: string; externoId: string; nome: string; credencialId: string | null },
  dias: number,
): Promise<ResultadoSync> {
  const execucao = await tx
    .insert(syncExecucoes)
    .values({
      organizacaoId: ctx.organizacaoId,
      contaId: conta.id,
      origem: "cron",
      estado: "rodando",
      dias,
    })
    .returning({ id: syncExecucoes.id });

  const execucaoId = execucao[0]?.id;

  const encerrar = async (estado: "ok" | "erro", linhas: number, erro?: string) => {
    if (execucaoId === undefined) return;
    await tx
      .update(syncExecucoes)
      .set({ estado, linhas, erro: erro ?? null, terminadoEm: new Date() })
      .where(eq(syncExecucoes.id, execucaoId));
  };

  try {
    if (!conta.credencialId) throw new Error("Conta sem credencial associada.");

    const cred = await tx
      .select({
        segredoCifrado: credenciais.segredoCifrado,
        dekCifrada: credenciais.dekCifrada,
        versaoKek: credenciais.versaoKek,
      })
      .from(credenciais)
      .where(and(eq(credenciais.id, conta.credencialId), isNull(credenciais.excluidoEm)))
      .limit(1);

    const c = cred[0];
    if (!c) throw new Error("Credencial não encontrada ou removida.");

    const envelope: Envelope = {
      segredo: c.segredoCifrado,
      dek: c.dekCifrada,
      versaoKek: c.versaoKek,
    };
    const token = decifrar(envelope, `${ctx.organizacaoId}:${conta.credencialId}`);

    const ate = new Date();
    const de = new Date(ate.getTime() - dias * 86_400_000);

    const painel = await metaAds.carregarPainel({
      token,
      contaId: conta.externoId,
      preset: null,
      since: iso(de),
      until: iso(ate),
      dias,
    });

    let gravadas = 0;
    for (const ponto of painel.serie) {
      await tx
        .insert(metricasDiarias)
        .values({
          organizacaoId: ctx.organizacaoId,
          contaId: conta.id,
          campanhaExternaId: null,
          dia: ponto.data,
          gasto: ponto.gasto.toFixed(2),
          impressoes: ponto.impressoes,
          alcance: ponto.alcance,
          cliques: ponto.cliques,
          cliquesLink: ponto.cliquesLink,
          conversas: ponto.conversas,
          resposta1: ponto.resposta1,
          prof2: ponto.prof2,
          prof3: ponto.prof3,
          prof5: ponto.prof5,
        })
        .onConflictDoUpdate({
          target: [metricasDiarias.contaId, metricasDiarias.dia, metricasDiarias.campanhaExternaId],
          set: {
            gasto: ponto.gasto.toFixed(2),
            impressoes: ponto.impressoes,
            alcance: ponto.alcance,
            cliques: ponto.cliques,
            cliquesLink: ponto.cliquesLink,
            conversas: ponto.conversas,
            resposta1: ponto.resposta1,
            prof2: ponto.prof2,
            prof3: ponto.prof3,
            prof5: ponto.prof5,
            sincronizadoEm: new Date(),
          },
        });
      gravadas++;
    }

    await tx
      .update(contasAnuncio)
      .set({ ultimaSincronizacao: new Date(), ultimoErro: null })
      .where(eq(contasAnuncio.id, conta.id));

    await encerrar("ok", gravadas);
    return { contaId: conta.id, conta: conta.nome, linhas: gravadas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Erro fica registrado na conta e na execução, mas não derruba a
    // sincronização das outras — uma conta com token vencido não pode parar a
    // carteira inteira.
    await tx
      .update(contasAnuncio)
      .set({ ultimoErro: msg.slice(0, 500) })
      .where(eq(contasAnuncio.id, conta.id));

    await encerrar("erro", 0, msg.slice(0, 500));
    return { contaId: conta.id, conta: conta.nome, linhas: 0, erro: msg };
  }
}

/**
 * Descobre as contas acessíveis por uma credencial e as registra.
 *
 * Roda antes do primeiro sync de um cliente: no Business Manager, atribuir uma
 * conta nova ao usuário do sistema deve bastar para ela aparecer aqui — sem
 * ninguém cadastrar id à mão.
 */
export async function descobrirContas(
  tx: Transacao,
  ctx: Contexto,
  credencialId: string,
  clienteId: string | null,
): Promise<number> {
  const cred = await tx
    .select({
      segredoCifrado: credenciais.segredoCifrado,
      dekCifrada: credenciais.dekCifrada,
      versaoKek: credenciais.versaoKek,
    })
    .from(credenciais)
    .where(and(eq(credenciais.id, credencialId), isNull(credenciais.excluidoEm)))
    .limit(1);

  const c = cred[0];
  if (!c) return 0;

  const token = decifrar(
    { segredo: c.segredoCifrado, dek: c.dekCifrada, versaoKek: c.versaoKek },
    `${ctx.organizacaoId}:${credencialId}`,
  );

  const encontradas = await metaAds.listarContas(token);
  let novas = 0;

  for (const conta of encontradas) {
    const r = await tx
      .insert(contasAnuncio)
      .values({
        id: novoId(),
        organizacaoId: ctx.organizacaoId,
        clienteId,
        plataforma: "meta_ads",
        externoId: conta.id,
        nome: conta.nome,
        moeda: conta.moeda,
        credencialId,
      })
      .onConflictDoNothing()
      .returning({ id: contasAnuncio.id });

    if (r[0]) novas++;
  }

  return novas;
}

/** Últimas execuções, para responder "por que os números estão velhos". */
export async function ultimasExecucoes(ctx: Contexto, limite = 20) {
  exigir(ctx, "trafego.painel.ver");
  return comContexto(ctx, async (tx) =>
    tx
      .select({
        id: syncExecucoes.id,
        contaId: syncExecucoes.contaId,
        estado: syncExecucoes.estado,
        linhas: syncExecucoes.linhas,
        erro: syncExecucoes.erro,
        iniciadoEm: syncExecucoes.iniciadoEm,
        terminadoEm: syncExecucoes.terminadoEm,
      })
      .from(syncExecucoes)
      .orderBy(desc(syncExecucoes.iniciadoEm))
      .limit(limite),
  );
}

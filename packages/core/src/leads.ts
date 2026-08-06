import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  comContexto,
  contatos,
  leads,
  novoId,
  pipelineEtapas,
  pipelines,
  usuarios,
  type Transacao,
} from "@mark/db";
import { ErroDeValidacao } from "./clientes";
import { ETAPAS_VENDAS_PADRAO } from "./tipos";
import type { CardLead, Coluna, Etapa } from "./tipos";
import { exigir, pode, type Contexto } from "./contexto";
import { registrar } from "./eventos";
import { aoInicio, entre, precisaReequilibrar, reequilibrar } from "./ordem";
import { normalizarTelefone } from "./telefone";

/**
 * CRM de Vendas.
 *
 * Duas decisões governam este módulo:
 *
 * 1. **Só nome e telefone são obrigatórios.** É o requisito 7.3 do briefing, e
 *    ele está no esquema: nada mais é `NOT NULL`. O sistema não bloqueia a
 *    criação de um lead porque o vendedor ainda não sabe o segmento.
 *
 * 2. **O lead não guarda nome nem telefone.** Eles vivem no contato. É o que
 *    faz a conversa de WhatsApp seguir a mesma pessoa antes e depois de ela
 *    virar cliente, sem duplicar dado nem partir o histórico em dois.
 */

export type { CardLead, Coluna, Etapa };

/**
 * Garante que a organização tenha um pipeline de vendas com as etapas padrão.
 *
 * Chamado na primeira abertura do quadro em vez de no seed: uma organização
 * criada por qualquer caminho — seed, convite, importação — chega ao quadro com
 * ele pronto, sem depender de alguém ter lembrado de rodar um passo.
 */
export async function garantirPipeline(tx: Transacao, ctx: Contexto): Promise<string> {
  const existente = await tx
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(
      and(
        eq(pipelines.organizacaoId, ctx.organizacaoId),
        eq(pipelines.tipo, "vendas"),
        eq(pipelines.padrao, true),
      ),
    )
    .limit(1);

  if (existente[0]) return existente[0].id;

  const pipelineId = novoId();
  await tx.insert(pipelines).values({
    id: pipelineId,
    organizacaoId: ctx.organizacaoId,
    nome: "Comercial",
    tipo: "vendas",
    padrao: true,
  });

  await tx.insert(pipelineEtapas).values(
    ETAPAS_VENDAS_PADRAO.map((etapa, i) => ({
      id: novoId(),
      pipelineId,
      nome: etapa.nome,
      ordem: i + 1,
      tipo: etapa.tipo,
    })),
  );

  return pipelineId;
}

export type FiltrosQuadro = {
  responsavelId?: string;
  temperatura?: string;
  busca?: string;
};

/**
 * O quadro inteiro numa consulta só.
 *
 * Duas consultas, não uma por coluna: oito etapas dariam oito viagens ao banco
 * a cada abertura, e o agrupamento em memória custa menos que isso.
 */
export async function quadro(ctx: Contexto, filtros: FiltrosQuadro = {}): Promise<Coluna[]> {
  exigir(ctx, "vendas.lead.ver");

  return comContexto(ctx, async (tx) => {
    const pipelineId = await garantirPipeline(tx, ctx);

    const etapas = await tx
      .select({
        id: pipelineEtapas.id,
        nome: pipelineEtapas.nome,
        ordem: pipelineEtapas.ordem,
        tipo: pipelineEtapas.tipo,
        cor: pipelineEtapas.cor,
      })
      .from(pipelineEtapas)
      .where(eq(pipelineEtapas.pipelineId, pipelineId))
      .orderBy(asc(pipelineEtapas.ordem));

    const condicoes = [
      eq(leads.organizacaoId, ctx.organizacaoId),
      isNull(leads.excluidoEm),
    ];
    if (filtros.responsavelId) condicoes.push(eq(leads.responsavelId, filtros.responsavelId));
    if (filtros.temperatura) condicoes.push(eq(leads.temperatura, filtros.temperatura));
    if (filtros.busca?.trim()) {
      const alvo = `%${filtros.busca.trim()}%`;
      condicoes.push(
        sql`(${contatos.nome} ILIKE ${alvo} OR ${contatos.telefoneE164} ILIKE ${alvo} OR ${leads.empresa} ILIKE ${alvo})`,
      );
    }

    const cards = await tx
      .select({
        id: leads.id,
        nome: contatos.nome,
        telefone: contatos.telefoneE164,
        empresa: leads.empresa,
        valorEstimado: leads.valorEstimado,
        temperatura: leads.temperatura,
        responsavelId: leads.responsavelId,
        responsavelNome: usuarios.nome,
        proximaAcao: leads.proximaAcao,
        proximoContatoEm: leads.proximoContatoEm,
        etapaId: leads.etapaId,
        ordem: leads.ordem,
      })
      .from(leads)
      .innerJoin(contatos, eq(contatos.id, leads.contatoId))
      .leftJoin(usuarios, eq(usuarios.id, leads.responsavelId))
      .where(and(...condicoes))
      .orderBy(asc(leads.ordem));

    const porEtapa = new Map<string, CardLead[]>();
    for (const c of cards) {
      const lista = porEtapa.get(c.etapaId) ?? [];
      lista.push({
        ...c,
        valorEstimado: c.valorEstimado === null ? null : Number(c.valorEstimado),
        ordem: Number(c.ordem),
      });
      porEtapa.set(c.etapaId, lista);
    }

    return etapas.map((e) => ({
      ...e,
      tipo: e.tipo as Etapa["tipo"],
      cards: porEtapa.get(e.id) ?? [],
    }));
  });
}

export type DadosLead = {
  nome: string;
  telefone: string;
  empresa?: string | null;
  email?: string | null;
  origem?: string | null;
  servico?: string | null;
  valorEstimado?: number | null;
  temperatura?: string | null;
  responsavelId?: string | null;
  cidade?: string | null;
  observacoes?: string | null;
};

/**
 * Cria um lead.
 *
 * O telefone encontra — ou cria — o contato. É aqui que a âncora de identidade
 * age: se essa pessoa já falou com a agência pelo WhatsApp, o lead nasce ligado
 * à conversa que já existe, em vez de abrir um histórico paralelo.
 */
export async function criar(ctx: Contexto, dados: DadosLead): Promise<string> {
  exigir(ctx, "vendas.lead.criar");

  const nome = dados.nome.trim();
  if (!nome) throw new ErroDeValidacao("nome", "O nome é obrigatório.");

  const telefone = normalizarTelefone(dados.telefone);
  if (!telefone) {
    throw new ErroDeValidacao("telefone", "Telefone não reconhecido. Use DDD + número.");
  }

  return comContexto(ctx, async (tx) => {
    const pipelineId = await garantirPipeline(tx, ctx);

    const primeiraEtapa = await tx
      .select({ id: pipelineEtapas.id })
      .from(pipelineEtapas)
      .where(eq(pipelineEtapas.pipelineId, pipelineId))
      .orderBy(asc(pipelineEtapas.ordem))
      .limit(1);

    const etapaId = primeiraEtapa[0]?.id;
    if (!etapaId) throw new Error("Pipeline sem etapas — estado inconsistente.");

    // Contato existente pelo telefone, ou um novo. O índice único garante que
    // não há dois; esta consulta garante que não tentamos criar o segundo.
    const existente = await tx
      .select({ id: contatos.id })
      .from(contatos)
      .where(
        and(
          eq(contatos.organizacaoId, ctx.organizacaoId),
          eq(contatos.telefoneE164, telefone),
          isNull(contatos.excluidoEm),
        ),
      )
      .limit(1);

    let contatoId = existente[0]?.id;
    if (!contatoId) {
      contatoId = novoId();
      await tx.insert(contatos).values({
        id: contatoId,
        organizacaoId: ctx.organizacaoId,
        nome,
        telefoneE164: telefone,
        email: dados.email ?? null,
        criadoPor: ctx.usuarioId,
        atualizadoPor: ctx.usuarioId,
      });
    }

    // Card novo entra no topo da primeira coluna: é o que acabou de chegar, e é
    // para onde o olho vai primeiro.
    const primeiro = await tx
      .select({ ordem: leads.ordem })
      .from(leads)
      .where(and(eq(leads.etapaId, etapaId), isNull(leads.excluidoEm)))
      .orderBy(asc(leads.ordem))
      .limit(1);

    const id = novoId();
    await tx.insert(leads).values({
      id,
      organizacaoId: ctx.organizacaoId,
      contatoId,
      etapaId,
      ordem: String(aoInicio(primeiro[0] ? Number(primeiro[0].ordem) : null)),
      empresa: dados.empresa ?? null,
      origem: dados.origem ?? null,
      servico: dados.servico ?? null,
      valorEstimado: dados.valorEstimado == null ? null : String(dados.valorEstimado),
      temperatura: dados.temperatura ?? null,
      responsavelId: dados.responsavelId ?? ctx.usuarioId,
      cidade: dados.cidade ?? null,
      observacoes: dados.observacoes ?? null,
      criadoPor: ctx.usuarioId,
      atualizadoPor: ctx.usuarioId,
    });

    await registrar(tx, ctx, {
      tipo: "lead.criado",
      entidade: "lead",
      entidadeId: id,
      dados: { nome, contatoReaproveitado: Boolean(existente[0]) },
    });

    return id;
  });
}

/**
 * Move um card de coluna ou de posição.
 *
 * `antesDe` é o id do card que deve ficar logo abaixo do movido — `null` põe no
 * fim. A posição sai de `entre()`, então o movimento é UM update de UMA linha,
 * sem tocar nos vizinhos.
 *
 * Quando o espaço entre dois vizinhos se esgota, a coluna é reequilibrada na
 * mesma transação e o movimento é refeito. Raro, e invisível para quem arrasta.
 */
export async function mover(
  ctx: Contexto,
  leadId: string,
  etapaId: string,
  antesDe: string | null,
): Promise<void> {
  exigir(ctx, "vendas.lead.editar");

  await comContexto(ctx, async (tx) => {
    const atual = await tx
      .select({ etapaId: leads.etapaId })
      .from(leads)
      .where(and(eq(leads.id, leadId), isNull(leads.excluidoEm)))
      .limit(1);

    if (!atual[0]) throw new ErroDeValidacao("lead", "Lead não encontrado.");

    const destino = await tx
      .select({ id: leads.id, ordem: leads.ordem })
      .from(leads)
      .where(and(eq(leads.etapaId, etapaId), isNull(leads.excluidoEm), sql`${leads.id} <> ${leadId}`))
      .orderBy(asc(leads.ordem));

    const posicoes = destino.map((d) => Number(d.ordem));
    const alvo = antesDe ? destino.findIndex((d) => d.id === antesDe) : destino.length;
    const indice = alvo < 0 ? destino.length : alvo;

    const anterior = indice > 0 ? (posicoes[indice - 1] ?? null) : null;
    const proximo = indice < posicoes.length ? (posicoes[indice] ?? null) : null;

    let ordem = entre(anterior, proximo);

    if (ordem === null || precisaReequilibrar(posicoes)) {
      // Espaço esgotado: redistribui a coluna e recalcula. É o único momento em
      // que a coluna inteira é reescrita, e ele existe para que o arrasto do dia
      // a dia nunca precise fazer isso.
      const novas = reequilibrar(destino.map((d) => d.id));
      for (const n of novas) {
        await tx.update(leads).set({ ordem: String(n.ordem) }).where(eq(leads.id, n.id));
      }
      const recalculadas = novas.map((n) => n.ordem);
      const antes = indice > 0 ? (recalculadas[indice - 1] ?? null) : null;
      const depois = indice < recalculadas.length ? (recalculadas[indice] ?? null) : null;
      ordem = entre(antes, depois) ?? (recalculadas.length + 1) * 1000;
    }

    const mudouDeEtapa = atual[0].etapaId !== etapaId;

    await tx
      .update(leads)
      .set({ etapaId, ordem: String(ordem), atualizadoEm: new Date(), atualizadoPor: ctx.usuarioId })
      .where(eq(leads.id, leadId));

    // Reordenar dentro da mesma coluna não é história: só a mudança de etapa
    // entra na linha do tempo, senão ela vira um diário de arrastos.
    if (mudouDeEtapa) {
      const nomes = await tx
        .select({ id: pipelineEtapas.id, nome: pipelineEtapas.nome, tipo: pipelineEtapas.tipo })
        .from(pipelineEtapas)
        .where(sql`${pipelineEtapas.id} IN (${atual[0].etapaId}, ${etapaId})`);

      const de = nomes.find((n) => n.id === atual[0]!.etapaId);
      const para = nomes.find((n) => n.id === etapaId);

      await registrar(tx, ctx, {
        tipo: "lead.etapa_alterada",
        entidade: "lead",
        entidadeId: leadId,
        dados: { de: de?.nome ?? null, para: para?.nome ?? null },
      });

      // Etapa de ganho ou perda carimba a data, para a taxa de conversão e o
      // tempo médio de fechamento não dependerem de alguém preencher à mão.
      if (para?.tipo === "ganho") {
        await tx.update(leads).set({ fechadoEm: new Date(), perdidoEm: null }).where(eq(leads.id, leadId));
      } else if (para?.tipo === "perda") {
        await tx.update(leads).set({ perdidoEm: new Date(), fechadoEm: null }).where(eq(leads.id, leadId));
      } else {
        await tx.update(leads).set({ fechadoEm: null, perdidoEm: null }).where(eq(leads.id, leadId));
      }
    }
  });
}

/** Motivo de perda. Pode ser pulado — o briefing é explícito quanto a isso. */
export async function registrarPerda(
  ctx: Contexto,
  leadId: string,
  motivo: string | null,
): Promise<void> {
  exigir(ctx, "vendas.lead.editar");

  await comContexto(ctx, async (tx) => {
    await tx
      .update(leads)
      .set({ motivoPerda: motivo, atualizadoPor: ctx.usuarioId })
      .where(and(eq(leads.id, leadId), isNull(leads.excluidoEm)));

    await registrar(tx, ctx, {
      tipo: "lead.perdido",
      entidade: "lead",
      entidadeId: leadId,
      dados: { motivo },
    });
  });
}

export async function excluir(ctx: Contexto, leadId: string): Promise<boolean> {
  exigir(ctx, "vendas.lead.excluir");

  return comContexto(ctx, async (tx) => {
    const r = await tx
      .update(leads)
      .set({ excluidoEm: new Date(), atualizadoPor: ctx.usuarioId })
      .where(and(eq(leads.id, leadId), isNull(leads.excluidoEm)))
      .returning({ id: leads.id });

    if (!r[0]) return false;
    await registrar(tx, ctx, { tipo: "lead.excluido", entidade: "lead", entidadeId: leadId });
    return true;
  });
}

export type ResumoComercial = {
  emAberto: number;
  ganhos: number;
  perdidos: number;
  valorEmAberto: number;
  semRetorno: number;
};

/** Números do topo do quadro. Uma consulta agregada, não uma varredura. */
export async function resumo(ctx: Contexto): Promise<ResumoComercial> {
  exigir(ctx, "vendas.painel.ver");

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        emAberto: sql<number>`count(*) FILTER (WHERE ${leads.fechadoEm} IS NULL AND ${leads.perdidoEm} IS NULL)::int`,
        ganhos: sql<number>`count(*) FILTER (WHERE ${leads.fechadoEm} IS NOT NULL)::int`,
        perdidos: sql<number>`count(*) FILTER (WHERE ${leads.perdidoEm} IS NOT NULL)::int`,
        valorEmAberto: sql<string>`coalesce(sum(${leads.valorEstimado}) FILTER (WHERE ${leads.fechadoEm} IS NULL AND ${leads.perdidoEm} IS NULL), 0)`,
        semRetorno: sql<number>`count(*) FILTER (WHERE ${leads.proximoContatoEm} < current_date AND ${leads.fechadoEm} IS NULL AND ${leads.perdidoEm} IS NULL)::int`,
      })
      .from(leads)
      .where(and(eq(leads.organizacaoId, ctx.organizacaoId), isNull(leads.excluidoEm)));

    const r = linhas[0];
    return {
      emAberto: r?.emAberto ?? 0,
      ganhos: r?.ganhos ?? 0,
      perdidos: r?.perdidos ?? 0,
      valorEmAberto: Number(r?.valorEmAberto ?? 0),
      semRetorno: r?.semRetorno ?? 0,
    };
  });
}

export function permissoesDe(ctx: Contexto) {
  return {
    ver: pode(ctx, "vendas.lead.ver"),
    criar: pode(ctx, "vendas.lead.criar"),
    editar: pode(ctx, "vendas.lead.editar"),
    excluir: pode(ctx, "vendas.lead.excluir"),
    verPainel: pode(ctx, "vendas.painel.ver"),
  };
}

/** Ficha completa, para a tela do lead. */
export async function obter(ctx: Contexto, id: string) {
  exigir(ctx, "vendas.lead.ver");

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        id: leads.id,
        nome: contatos.nome,
        telefone: contatos.telefoneE164,
        email: contatos.email,
        contatoId: contatos.id,
        empresa: leads.empresa,
        site: leads.site,
        cidade: leads.cidade,
        segmento: leads.segmento,
        origem: leads.origem,
        servico: leads.servico,
        valorEstimado: leads.valorEstimado,
        temperatura: leads.temperatura,
        responsavelId: leads.responsavelId,
        etapaId: leads.etapaId,
        etapaNome: pipelineEtapas.nome,
        proximaAcao: leads.proximaAcao,
        proximoContatoEm: leads.proximoContatoEm,
        motivoPerda: leads.motivoPerda,
        fechadoEm: leads.fechadoEm,
        perdidoEm: leads.perdidoEm,
        observacoes: leads.observacoes,
        criadoEm: leads.criadoEm,
      })
      .from(leads)
      .innerJoin(contatos, eq(contatos.id, leads.contatoId))
      .innerJoin(pipelineEtapas, eq(pipelineEtapas.id, leads.etapaId))
      .where(and(eq(leads.id, id), isNull(leads.excluidoEm)))
      .limit(1);

    const l = linhas[0];
    if (!l) return null;

    return {
      ...l,
      valorEstimado: l.valorEstimado === null ? null : Number(l.valorEstimado),
    };
  });
}

/** Leads sem retorno, para o painel geral. */
export async function semRetorno(ctx: Contexto, limite = 20) {
  exigir(ctx, "vendas.lead.ver");

  return comContexto(ctx, async (tx) =>
    tx
      .select({
        id: leads.id,
        nome: contatos.nome,
        telefone: contatos.telefoneE164,
        proximoContatoEm: leads.proximoContatoEm,
        responsavelId: leads.responsavelId,
      })
      .from(leads)
      .innerJoin(contatos, eq(contatos.id, leads.contatoId))
      .where(
        and(
          eq(leads.organizacaoId, ctx.organizacaoId),
          isNull(leads.excluidoEm),
          isNull(leads.fechadoEm),
          isNull(leads.perdidoEm),
          sql`${leads.proximoContatoEm} < current_date`,
        ),
      )
      .orderBy(desc(leads.proximoContatoEm))
      .limit(limite),
  );
}

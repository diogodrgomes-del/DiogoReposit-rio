import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { atividades, comContexto, leads, novoId, usuarios } from "@mark/db";
import { ErroDeValidacao } from "./clientes";
import { exigir, type Contexto } from "./contexto";
import { registrar } from "./eventos";

/**
 * Atividades comerciais: ligação, reunião, follow-up, visita.
 *
 * O que faz esta tabela valer a pena não é registrar o que já aconteceu — é
 * marcar **o que vem a seguir**. Um CRM em que ninguém sabe qual é o próximo
 * passo de cada lead é uma lista de nomes.
 *
 * Por isso concluir uma atividade com data futura atualiza `proximo_contato_em`
 * do lead: o card do quadro e o painel geral leem esse campo, e mantê-lo à mão
 * seria a primeira coisa que a equipe deixaria de fazer.
 */

export const TIPOS_ATIVIDADE = [
  "ligacao",
  "reuniao",
  "follow_up",
  "mensagem",
  "visita",
  "apresentacao",
  "proposta",
  "tarefa",
] as const;

export type TipoAtividade = (typeof TIPOS_ATIVIDADE)[number];

export const ROTULO_ATIVIDADE: Record<TipoAtividade, string> = {
  ligacao: "Ligação",
  reuniao: "Reunião",
  follow_up: "Follow-up",
  mensagem: "Mensagem",
  visita: "Visita",
  apresentacao: "Apresentação",
  proposta: "Envio de proposta",
  tarefa: "Tarefa",
};

export type Atividade = {
  id: string;
  tipo: string;
  titulo: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  agendadaPara: Date | null;
  concluidaEm: Date | null;
  observacao: string | null;
  criadoEm: Date;
};

export type DadosAtividade = {
  leadId?: string | null;
  clienteId?: string | null;
  tipo: string;
  titulo: string;
  agendadaPara?: Date | null;
  responsavelId?: string | null;
  observacao?: string | null;
};

const COLUNAS = {
  id: atividades.id,
  tipo: atividades.tipo,
  titulo: atividades.titulo,
  responsavelId: atividades.responsavelId,
  responsavelNome: usuarios.nome,
  agendadaPara: atividades.agendadaPara,
  concluidaEm: atividades.concluidaEm,
  observacao: atividades.observacao,
  criadoEm: atividades.criadoEm,
};

export async function criar(ctx: Contexto, dados: DadosAtividade): Promise<string> {
  exigir(ctx, "vendas.atividade.editar");

  const titulo = dados.titulo.trim();
  if (!titulo) throw new ErroDeValidacao("titulo", "Descreva a atividade.");
  if (!dados.leadId && !dados.clienteId) {
    // O CHECK da tabela recusaria de todo jeito; falhar aqui dá uma mensagem
    // em português em vez de um erro do Postgres.
    throw new ErroDeValidacao("lead", "A atividade precisa pertencer a um lead ou cliente.");
  }

  const id = novoId();

  return comContexto(ctx, async (tx) => {
    await tx.insert(atividades).values({
      id,
      organizacaoId: ctx.organizacaoId,
      leadId: dados.leadId ?? null,
      clienteId: dados.clienteId ?? null,
      tipo: dados.tipo,
      titulo,
      responsavelId: dados.responsavelId ?? ctx.usuarioId,
      agendadaPara: dados.agendadaPara ?? null,
      observacao: dados.observacao ?? null,
      criadoPor: ctx.usuarioId,
    });

    // Agendar uma atividade futura é definir o próximo contato do lead. Deixar
    // os dois campos independentes faria o painel mostrar "sem retorno" para
    // quem tem reunião marcada para amanhã.
    if (dados.leadId && dados.agendadaPara) {
      await tx
        .update(leads)
        .set({
          proximoContatoEm: dados.agendadaPara.toISOString().slice(0, 10),
          proximaAcao: titulo,
          atualizadoPor: ctx.usuarioId,
        })
        .where(eq(leads.id, dados.leadId));
    }

    if (dados.leadId) {
      await registrar(tx, ctx, {
        tipo: "lead.atividade_criada",
        entidade: "lead",
        entidadeId: dados.leadId,
        dados: { titulo, tipo: dados.tipo },
      });
    }

    return id;
  });
}

/** Histórico e agenda de um lead, do mais recente para o mais antigo. */
export async function doLead(ctx: Contexto, leadId: string): Promise<Atividade[]> {
  exigir(ctx, "vendas.atividade.ver");

  return comContexto(ctx, async (tx) =>
    tx
      .select(COLUNAS)
      .from(atividades)
      .leftJoin(usuarios, eq(usuarios.id, atividades.responsavelId))
      .where(and(eq(atividades.leadId, leadId), isNull(atividades.excluidoEm)))
      .orderBy(desc(atividades.criadoEm))
      .limit(50),
  );
}

/**
 * Marca como concluída.
 *
 * Não limpa `proximo_contato_em` do lead: quem concluiu uma ligação normalmente
 * já agenda a próxima, e apagar a data faria o lead sumir do painel antes de a
 * pessoa decidir o que vem depois. Some quando outra atividade for agendada, ou
 * quando o lead fechar.
 */
export async function concluir(ctx: Contexto, id: string): Promise<boolean> {
  exigir(ctx, "vendas.atividade.editar");

  return comContexto(ctx, async (tx) => {
    const r = await tx
      .update(atividades)
      .set({ concluidaEm: new Date(), atualizadoEm: new Date() })
      .where(and(eq(atividades.id, id), isNull(atividades.concluidaEm)))
      .returning({ id: atividades.id, leadId: atividades.leadId, titulo: atividades.titulo });

    const alvo = r[0];
    if (!alvo) return false;

    if (alvo.leadId) {
      await registrar(tx, ctx, {
        tipo: "lead.atividade_concluida",
        entidade: "lead",
        entidadeId: alvo.leadId,
        dados: { titulo: alvo.titulo },
      });
    }
    return true;
  });
}

export async function excluir(ctx: Contexto, id: string): Promise<boolean> {
  exigir(ctx, "vendas.atividade.editar");

  return comContexto(ctx, async (tx) => {
    const r = await tx
      .update(atividades)
      .set({ excluidoEm: new Date() })
      .where(and(eq(atividades.id, id), isNull(atividades.excluidoEm)))
      .returning({ id: atividades.id });
    return r.length > 0;
  });
}

export type Pendencia = Atividade & { leadId: string | null; clienteId: string | null };

/**
 * O que está agendado para hoje ou já venceu, do responsável em questão.
 *
 * Alimenta o painel geral. Limite baixo de propósito: uma lista de cem itens
 * não é uma agenda, é um motivo para fechar a aba.
 */
export async function pendentes(
  ctx: Contexto,
  opcoes: { apenasMinhas?: boolean; limite?: number } = {},
): Promise<Pendencia[]> {
  exigir(ctx, "vendas.atividade.ver");

  return comContexto(ctx, async (tx) => {
    const condicoes = [
      eq(atividades.organizacaoId, ctx.organizacaoId),
      isNull(atividades.concluidaEm),
      isNull(atividades.excluidoEm),
      sql`${atividades.agendadaPara} IS NOT NULL`,
      sql`${atividades.agendadaPara} < (current_date + interval '1 day')`,
    ];
    if (opcoes.apenasMinhas) {
      const meu = or(
        eq(atividades.responsavelId, ctx.usuarioId),
        isNull(atividades.responsavelId),
      );
      if (meu) condicoes.push(meu);
    }

    return tx
      .select({ ...COLUNAS, leadId: atividades.leadId, clienteId: atividades.clienteId })
      .from(atividades)
      .leftJoin(usuarios, eq(usuarios.id, atividades.responsavelId))
      .where(and(...condicoes))
      .orderBy(asc(atividades.agendadaPara))
      .limit(opcoes.limite ?? 15);
  });
}

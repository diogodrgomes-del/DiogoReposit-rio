import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { cifrar, decifrar, mascarar, type Envelope } from "@mark/cofre";
import {
  comContexto,
  credenciais,
  credencialAcessos,
  novoId,
  type Transacao,
} from "@mark/db";
import { exigir, type Contexto } from "./contexto";

/**
 * Cofre de credenciais.
 *
 * Duas permissões distintas, de propósito:
 *
 *   `credenciais.credencial.ver`     — saber que existe acesso ao Google Ads
 *                                      do cliente, quem é o responsável e
 *                                      quando foi atualizado
 *   `credenciais.credencial.revelar` — ler o segredo
 *
 * A equipe precisa da primeira o tempo todo e da segunda quase nunca. Juntar as
 * duas numa só transformaria "listar acessos" em "distribuir senhas".
 */

export type Credencial = {
  id: string;
  clienteId: string | null;
  plataforma: string;
  rotulo: string | null;
  login: string | null;
  link: string | null;
  dica: string | null;
  expiraEm: string | null;
  observacoes: string | null;
  responsavelId: string | null;
  atualizadoEm: Date;
};

const COLUNAS = {
  id: credenciais.id,
  clienteId: credenciais.clienteId,
  plataforma: credenciais.plataforma,
  rotulo: credenciais.rotulo,
  login: credenciais.login,
  link: credenciais.link,
  dica: credenciais.dica,
  expiraEm: credenciais.expiraEm,
  observacoes: credenciais.observacoes,
  responsavelId: credenciais.responsavelId,
  atualizadoEm: credenciais.atualizadoEm,
};

/** O que amarra o envelope a esta linha. Ver `cifrar` em @mark/cofre. */
function aad(organizacaoId: string, credencialId: string): string {
  return `${organizacaoId}:${credencialId}`;
}

/**
 * Lista sem nunca tocar no segredo.
 *
 * As colunas cifradas não estão em COLUNAS: elas não são omitidas na
 * serialização, são omitidas na **consulta**. Segredo que não foi lido do banco
 * não vaza em log, em erro nem em resposta.
 */
export async function listar(ctx: Contexto, clienteId?: string): Promise<Credencial[]> {
  exigir(ctx, "credenciais.credencial.ver", clienteId ? { clienteId } : undefined);

  return comContexto(ctx, async (tx) => {
    const condicoes = [isNull(credenciais.excluidoEm)];
    if (clienteId) condicoes.push(eq(credenciais.clienteId, clienteId));

    return tx
      .select(COLUNAS)
      .from(credenciais)
      .where(and(...condicoes))
      .orderBy(desc(credenciais.atualizadoEm));
  }) as Promise<Credencial[]>;
}

export type Revelacao = { segredo: string; mascarado: string };

/**
 * Revela o segredo.
 *
 * A gravação da auditoria acontece **antes** de o segredo sair, e na mesma
 * transação. Se ela falhar, a transação inteira falha e o segredo não é
 * entregue. Auditoria gravada depois seria desligada exatamente pela falha que
 * se quer auditar.
 */
export async function revelar(
  ctx: Contexto,
  id: string,
  origem: { ip?: string | null } = {},
): Promise<Revelacao | null> {
  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        id: credenciais.id,
        clienteId: credenciais.clienteId,
        segredoCifrado: credenciais.segredoCifrado,
        dekCifrada: credenciais.dekCifrada,
        versaoKek: credenciais.versaoKek,
      })
      .from(credenciais)
      .where(and(eq(credenciais.id, id), isNull(credenciais.excluidoEm)))
      .limit(1);

    const linha = linhas[0];
    if (!linha) return null;

    // Só agora dá para conferir o escopo por cliente: ele depende de qual
    // cliente é o dono da credencial.
    exigir(ctx, "credenciais.credencial.revelar", { clienteId: linha.clienteId });

    await tx.insert(credencialAcessos).values({
      organizacaoId: ctx.organizacaoId,
      credencialId: id,
      usuarioId: ctx.usuarioId,
      acao: "revelou",
      ip: origem.ip ?? null,
    });

    const envelope: Envelope = {
      segredo: linha.segredoCifrado,
      dek: linha.dekCifrada,
      versaoKek: linha.versaoKek,
    };
    const segredo = decifrar(envelope, aad(ctx.organizacaoId, id));

    return { segredo, mascarado: mascarar(segredo) };
  });
}

export type DadosCredencial = {
  clienteId?: string | null;
  plataforma: string;
  rotulo?: string | null;
  login?: string | null;
  link?: string | null;
  segredo: string;
  dica?: string | null;
  observacoes?: string | null;
  responsavelId?: string | null;
};

export async function criar(ctx: Contexto, dados: DadosCredencial): Promise<Credencial> {
  exigir(ctx, "credenciais.credencial.editar", { clienteId: dados.clienteId });
  if (!dados.plataforma.trim()) throw new Error("A plataforma é obrigatória.");
  if (!dados.segredo) throw new Error("O segredo é obrigatório.");

  const id = novoId();
  const envelope = cifrar(dados.segredo, aad(ctx.organizacaoId, id));

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .insert(credenciais)
      .values({
        id,
        organizacaoId: ctx.organizacaoId,
        clienteId: dados.clienteId ?? null,
        plataforma: dados.plataforma.trim(),
        rotulo: dados.rotulo ?? null,
        login: dados.login ?? null,
        link: dados.link ?? null,
        segredoCifrado: envelope.segredo,
        dekCifrada: envelope.dek,
        versaoKek: envelope.versaoKek,
        dica: dados.dica ?? mascarar(dados.segredo),
        observacoes: dados.observacoes ?? null,
        responsavelId: dados.responsavelId ?? ctx.usuarioId,
        criadoPor: ctx.usuarioId,
        atualizadoPor: ctx.usuarioId,
      })
      .returning(COLUNAS);

    await tx.insert(credencialAcessos).values({
      organizacaoId: ctx.organizacaoId,
      credencialId: id,
      usuarioId: ctx.usuarioId,
      acao: "criou",
    });

    return linhas[0] as Credencial;
  });
}

/** Troca o segredo, mantendo a linha e o histórico de acesso. */
export async function trocarSegredo(
  ctx: Contexto,
  id: string,
  segredo: string,
): Promise<boolean> {
  if (!segredo) throw new Error("O segredo é obrigatório.");

  return comContexto(ctx, async (tx) => {
    const alvo = await tx
      .select({ clienteId: credenciais.clienteId })
      .from(credenciais)
      .where(and(eq(credenciais.id, id), isNull(credenciais.excluidoEm)))
      .limit(1);

    if (!alvo[0]) return false;
    exigir(ctx, "credenciais.credencial.editar", { clienteId: alvo[0].clienteId });

    const envelope = cifrar(segredo, aad(ctx.organizacaoId, id));

    await tx
      .update(credenciais)
      .set({
        segredoCifrado: envelope.segredo,
        dekCifrada: envelope.dek,
        versaoKek: envelope.versaoKek,
        dica: mascarar(segredo),
        atualizadoEm: new Date(),
        atualizadoPor: ctx.usuarioId,
      })
      .where(eq(credenciais.id, id));

    await tx.insert(credencialAcessos).values({
      organizacaoId: ctx.organizacaoId,
      credencialId: id,
      usuarioId: ctx.usuarioId,
      acao: "editou",
    });

    return true;
  });
}

export async function excluir(ctx: Contexto, id: string): Promise<boolean> {
  return comContexto(ctx, async (tx) => {
    const alvo = await tx
      .select({ clienteId: credenciais.clienteId })
      .from(credenciais)
      .where(and(eq(credenciais.id, id), isNull(credenciais.excluidoEm)))
      .limit(1);

    if (!alvo[0]) return false;
    exigir(ctx, "credenciais.credencial.editar", { clienteId: alvo[0].clienteId });

    await tx
      .update(credenciais)
      .set({ excluidoEm: new Date(), atualizadoPor: ctx.usuarioId })
      .where(eq(credenciais.id, id));

    await tx.insert(credencialAcessos).values({
      organizacaoId: ctx.organizacaoId,
      credencialId: id,
      usuarioId: ctx.usuarioId,
      acao: "excluiu",
    });

    return true;
  });
}

export type Acesso = {
  id: number;
  usuarioId: string | null;
  acao: string;
  criadoEm: Date;
};

/** Quem olhou o quê. A pergunta que se faz depois de um incidente. */
export async function historico(ctx: Contexto, credencialId: string): Promise<Acesso[]> {
  exigir(ctx, "config.auditoria.ver");

  return comContexto(ctx, async (tx) =>
    tx
      .select({
        id: credencialAcessos.id,
        usuarioId: credencialAcessos.usuarioId,
        acao: credencialAcessos.acao,
        criadoEm: credencialAcessos.criadoEm,
      })
      .from(credencialAcessos)
      .where(eq(credencialAcessos.credencialId, credencialId))
      .orderBy(desc(credencialAcessos.criadoEm))
      .limit(200),
  );
}

/**
 * Guarda um segredo dentro de uma transação já aberta, sem duplicar quando a
 * mesma plataforma e rótulo já existem para o cliente.
 *
 * Usada pela importação do `META_TOKENS`, que precisa ser idempotente: rodar
 * duas vezes não pode criar dois tokens para o mesmo cliente.
 */
export async function garantir(
  tx: Transacao,
  ctx: Contexto,
  dados: DadosCredencial,
): Promise<{ id: string; criado: boolean }> {
  const rotulo = dados.rotulo ?? null;

  const existente = await tx
    .select({ id: credenciais.id })
    .from(credenciais)
    .where(
      and(
        eq(credenciais.organizacaoId, ctx.organizacaoId),
        dados.clienteId
          ? eq(credenciais.clienteId, dados.clienteId)
          : isNull(credenciais.clienteId),
        eq(credenciais.plataforma, dados.plataforma),
        rotulo ? eq(credenciais.rotulo, rotulo) : isNull(credenciais.rotulo),
        isNull(credenciais.excluidoEm),
      ),
    )
    .limit(1);

  if (existente[0]) {
    const id = existente[0].id;
    const envelope = cifrar(dados.segredo, aad(ctx.organizacaoId, id));
    // Atualiza o segredo: reimportar existe justamente para trocar um token
    // que expirou.
    await tx
      .update(credenciais)
      .set({
        segredoCifrado: envelope.segredo,
        dekCifrada: envelope.dek,
        versaoKek: envelope.versaoKek,
        dica: mascarar(dados.segredo),
        atualizadoEm: new Date(),
        atualizadoPor: ctx.usuarioId,
      })
      .where(eq(credenciais.id, id));
    return { id, criado: false };
  }

  const id = novoId();
  const envelope = cifrar(dados.segredo, aad(ctx.organizacaoId, id));

  await tx.insert(credenciais).values({
    id,
    organizacaoId: ctx.organizacaoId,
    clienteId: dados.clienteId ?? null,
    plataforma: dados.plataforma,
    rotulo,
    login: dados.login ?? null,
    link: dados.link ?? null,
    segredoCifrado: envelope.segredo,
    dekCifrada: envelope.dek,
    versaoKek: envelope.versaoKek,
    dica: mascarar(dados.segredo),
    observacoes: dados.observacoes ?? null,
    responsavelId: dados.responsavelId ?? ctx.usuarioId,
    criadoPor: ctx.usuarioId,
    atualizadoPor: ctx.usuarioId,
  });

  await tx.insert(credencialAcessos).values({
    organizacaoId: ctx.organizacaoId,
    credencialId: id,
    usuarioId: ctx.usuarioId,
    acao: "criou",
  });

  return { id, criado: true };
}

/** Quantas credenciais existem por cliente, para o cartão da ficha. */
export async function contarPorCliente(ctx: Contexto): Promise<Map<string, number>> {
  exigir(ctx, "credenciais.credencial.ver");

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({ clienteId: credenciais.clienteId, total: sql<number>`count(*)::int` })
      .from(credenciais)
      .where(isNull(credenciais.excluidoEm))
      .groupBy(credenciais.clienteId);

    return new Map(linhas.filter((l) => l.clienteId).map((l) => [l.clienteId as string, l.total]));
  });
}

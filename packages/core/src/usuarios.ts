import { and, eq, isNull } from "drizzle-orm";
import { comContexto, membros, organizacoes, papeis, usuarios } from "@mark/db";
import { exigir, type Contexto } from "./contexto";

/** Quem está logado, para o cabeçalho e o menu. */
export type Perfil = {
  nome: string;
  email: string;
  papel: string;
  organizacao: string;
  ehProprietario: boolean;
};

export async function perfil(ctx: Contexto): Promise<Perfil | null> {
  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select({
        nome: usuarios.nome,
        email: usuarios.email,
        papel: papeis.nome,
        organizacao: organizacoes.nome,
      })
      .from(membros)
      .innerJoin(usuarios, eq(usuarios.id, membros.usuarioId))
      .innerJoin(papeis, eq(papeis.id, membros.papelId))
      .innerJoin(organizacoes, eq(organizacoes.id, membros.organizacaoId))
      .where(
        and(
          eq(membros.usuarioId, ctx.usuarioId),
          eq(membros.organizacaoId, ctx.organizacaoId),
          eq(membros.ativo, true),
        ),
      )
      .limit(1);

    const p = linhas[0];
    return p ? { ...p, ehProprietario: ctx.ehProprietario } : null;
  });
}

export type Colega = { id: string; nome: string };

/**
 * Quem pode ser responsável por um cliente ou uma demanda.
 *
 * Exige `config.usuario.ver`? Não: saber quem são os colegas é necessário para
 * atribuir trabalho, e todo mundo que usa o sistema precisa disso. O que exige
 * permissão é *editar* usuário.
 */
export async function colegas(ctx: Contexto): Promise<Colega[]> {
  return comContexto(ctx, async (tx) =>
    tx
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(membros)
      .innerJoin(usuarios, eq(usuarios.id, membros.usuarioId))
      .where(
        and(
          eq(membros.organizacaoId, ctx.organizacaoId),
          eq(membros.ativo, true),
          isNull(usuarios.excluidoEm),
        ),
      )
      .orderBy(usuarios.nome),
  );
}

export type MembroDaEquipe = Colega & {
  email: string;
  papel: string;
  cargo: string | null;
  ativo: boolean;
  ultimoAcesso: Date | null;
};

export async function equipe(ctx: Contexto): Promise<MembroDaEquipe[]> {
  exigir(ctx, "config.usuario.ver");

  return comContexto(ctx, async (tx) =>
    tx
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        papel: papeis.nome,
        cargo: membros.cargo,
        ativo: membros.ativo,
        ultimoAcesso: usuarios.ultimoAcesso,
      })
      .from(membros)
      .innerJoin(usuarios, eq(usuarios.id, membros.usuarioId))
      .innerJoin(papeis, eq(papeis.id, membros.papelId))
      .where(eq(membros.organizacaoId, ctx.organizacaoId))
      .orderBy(usuarios.nome),
  );
}

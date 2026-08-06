import { sql } from "drizzle-orm";
import { PAPEIS_PADRAO, concedivel } from "@mark/core";
import { comoAdmin } from "./cliente";
import { novoId } from "./id";
import { membros, organizacoes, papeis, papelPermissoes, usuarios } from "./esquema/nucleo";

/**
 * Seed idempotente: cria a organização, os papéis padrão e o proprietário.
 *
 * Rodável quantas vezes for preciso. Não sobrescreve senha nem papel de quem já
 * existe — o objetivo é poder rodar depois de cada migração sem pensar duas
 * vezes, inclusive em produção.
 */

export type DadosSeed = {
  organizacao: string;
  slug: string;
  proprietarioEmail: string;
  proprietarioNome: string;
  /** Já derivado por @mark/auth. O seed nunca vê a senha em texto. */
  proprietarioSenhaHash: string;
};

export async function semear(dados: DadosSeed): Promise<{ organizacaoId: string; usuarioId: string }> {
  return comoAdmin(async (tx) => {
    // 1. Organização
    const orgExistente = await tx
      .select({ id: organizacoes.id })
      .from(organizacoes)
      .where(sql`${organizacoes.slug} = ${dados.slug}`)
      .limit(1);

    const organizacaoId = orgExistente[0]?.id ?? novoId();
    if (!orgExistente[0]) {
      await tx.insert(organizacoes).values({
        id: organizacaoId,
        nome: dados.organizacao,
        slug: dados.slug,
      });
    }

    // 2. Papéis padrão e suas permissões
    for (const papel of PAPEIS_PADRAO) {
      const existente = await tx
        .select({ id: papeis.id })
        .from(papeis)
        .where(sql`${papeis.organizacaoId} = ${organizacaoId} AND ${papeis.chave} = ${papel.chave}`)
        .limit(1);

      const papelId = existente[0]?.id ?? novoId();
      if (!existente[0]) {
        await tx.insert(papeis).values({
          id: papelId,
          organizacaoId,
          chave: papel.chave,
          nome: papel.nome,
          descricao: papel.descricao,
          sistema: true,
        });
      }

      // `concedivel` filtra financeiro.pessoal.* — que o CHECK da tabela também
      // recusaria. Filtrar aqui deixa o erro ser de programação, não de banco.
      const permissoes = papel.permissoes.filter(concedivel);
      if (permissoes.length > 0) {
        await tx
          .insert(papelPermissoes)
          .values(permissoes.map((permissao) => ({ papelId, permissao })))
          .onConflictDoNothing();
      }
    }

    // 3. Proprietário
    const usuarioExistente = await tx
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(sql`${usuarios.email} = ${dados.proprietarioEmail}`)
      .limit(1);

    const usuarioId = usuarioExistente[0]?.id ?? novoId();
    if (!usuarioExistente[0]) {
      await tx.insert(usuarios).values({
        id: usuarioId,
        email: dados.proprietarioEmail,
        nome: dados.proprietarioNome,
        senhaHash: dados.proprietarioSenhaHash,
      });
    }

    // 4. Vínculo e posse
    const papelProprietario = await tx
      .select({ id: papeis.id })
      .from(papeis)
      .where(sql`${papeis.organizacaoId} = ${organizacaoId} AND ${papeis.chave} = 'proprietario'`)
      .limit(1);

    const papelId = papelProprietario[0]?.id;
    if (!papelId) throw new Error("papel 'proprietario' não foi criado — seed inconsistente");

    await tx
      .insert(membros)
      .values({ id: novoId(), organizacaoId, usuarioId, papelId, cargo: "Proprietário" })
      .onConflictDoNothing();

    // O que decide o acesso ao financeiro pessoal. Não é papel, é esta coluna.
    await tx
      .update(organizacoes)
      .set({ proprietarioId: usuarioId })
      .where(sql`${organizacoes.id} = ${organizacaoId}`);

    return { organizacaoId, usuarioId };
  });
}

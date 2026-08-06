import { and, eq, isNull, sql } from "drizzle-orm";
import { autenticando, comUsuario, membros, usuarios } from "@mark/db";
import { derivar, verificar } from "./senha";
import * as sessao from "./sessao";

/**
 * Autenticação por e-mail e senha.
 *
 * A ordem dos passos é deliberada:
 *
 *   1. busca o usuário — numa transação curta, que fecha antes do trabalho caro
 *   2. confere a senha — argon2id leva ~100ms de propósito; segurar transação
 *      aberta durante isso desperdiça conexão do pool
 *   3. descobre a organização — precisa do id do usuário, que só existe agora
 *   4. cria a sessão
 *
 * Nenhuma resposta distingue "usuário não existe" de "senha errada", e o custo
 * de tempo é o mesmo nos dois casos. Distinguir entregaria uma lista de quem
 * tem conta.
 */

export type ResultadoLogin =
  | { ok: true; token: string; usuarioId: string; organizacaoId: string; nome: string }
  | { ok: false; motivo: "credenciais" | "sem_organizacao" | "inativo" };

export async function autenticar(
  email: string,
  senha: string,
  origem: { ip?: string | null; agente?: string | null } = {},
): Promise<ResultadoLogin> {
  const alvo = email.trim().toLowerCase();
  if (!alvo || !senha) return { ok: false, motivo: "credenciais" };

  const encontrado = await autenticando(async (tx) => {
    const linhas = await tx
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        senhaHash: usuarios.senhaHash,
        ativo: usuarios.ativo,
      })
      .from(usuarios)
      .where(and(sql`lower(${usuarios.email}) = ${alvo}`, isNull(usuarios.excluidoEm)))
      .limit(1);
    return linhas[0] ?? null;
  });

  // Verifica mesmo sem usuário: `verificar` gasta o mesmo tempo com hash nulo,
  // e é isso que impede medir o tempo de resposta para descobrir quem existe.
  const conferencia = await verificar(senha, encontrado?.senhaHash ?? null);
  if (!encontrado || !conferencia.confere) return { ok: false, motivo: "credenciais" };
  if (!encontrado.ativo) return { ok: false, motivo: "inativo" };

  const usuarioId = encontrado.id;

  // Hash herdado do painel: regrava em argon2id agora que a senha em claro está
  // à mão. Falhar aqui não pode impedir o login — é melhoria, não requisito.
  if (conferencia.precisaRegravar) {
    try {
      const novo = await derivar(senha);
      await comUsuario(usuarioId, (tx) =>
        tx.update(usuarios).set({ senhaHash: novo }).where(eq(usuarios.id, usuarioId)),
      );
    } catch (e) {
      console.error("Não foi possível migrar o hash da senha:", e instanceof Error ? e.message : e);
    }
  }

  const vinculo = await comUsuario(usuarioId, async (tx) => {
    const linhas = await tx
      .select({ organizacaoId: membros.organizacaoId })
      .from(membros)
      .where(and(eq(membros.usuarioId, usuarioId), eq(membros.ativo, true)))
      .limit(1);
    return linhas[0] ?? null;
  });

  // Senha certa e nenhuma organização ativa: a conta existe mas não dá acesso a
  // nada. Motivo próprio, porque a mensagem para quem digitou é diferente.
  if (!vinculo) return { ok: false, motivo: "sem_organizacao" };

  const token = await sessao.criar(
    { usuarioId, organizacaoId: vinculo.organizacaoId },
    origem,
  );

  await comUsuario(usuarioId, (tx) =>
    tx.update(usuarios).set({ ultimoAcesso: new Date() }).where(eq(usuarios.id, usuarioId)),
  );

  return {
    ok: true,
    token,
    usuarioId,
    organizacaoId: vinculo.organizacaoId,
    nome: encontrado.nome,
  };
}

/**
 * Troca a própria senha e derruba as outras sessões.
 *
 * Derrubar é o ponto: trocar senha porque se suspeita de acesso indevido não
 * adianta nada se a sessão de quem invadiu continuar de pé.
 */
export async function trocarSenha(
  ctx: { usuarioId: string; organizacaoId: string },
  senhaAtual: string,
  senhaNova: string,
): Promise<{ ok: true } | { ok: false; motivo: "credenciais" | "fraca" }> {
  if (senhaNova.length < 12) return { ok: false, motivo: "fraca" };

  const atual = await comUsuario(ctx.usuarioId, async (tx) => {
    const linhas = await tx
      .select({ senhaHash: usuarios.senhaHash })
      .from(usuarios)
      .where(eq(usuarios.id, ctx.usuarioId))
      .limit(1);
    return linhas[0] ?? null;
  });

  const conferencia = await verificar(senhaAtual, atual?.senhaHash ?? null);
  if (!conferencia.confere) return { ok: false, motivo: "credenciais" };

  const hash = await derivar(senhaNova);
  await comUsuario(ctx.usuarioId, (tx) =>
    tx.update(usuarios).set({ senhaHash: hash }).where(eq(usuarios.id, ctx.usuarioId)),
  );

  await sessao.revogarTodas(ctx);
  return { ok: true };
}

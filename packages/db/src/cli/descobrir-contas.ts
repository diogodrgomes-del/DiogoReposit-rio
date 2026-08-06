import { and, eq, isNull } from "drizzle-orm";
import { trafego } from "@mark/core";
import { comoAdmin, fechar } from "../cliente";
import { credenciais } from "../esquema/clientes";
import { organizacoes } from "../esquema/nucleo";

/**
 * `npm run db:descobrir-contas`
 *
 * Para cada credencial do Meta importada, pergunta à Graph API quais contas de
 * anúncio aquele token alcança e registra cada uma.
 *
 * Roda depois de `db:importar-meta` e antes do primeiro sync — sem contas
 * registradas, o worker não tem o que sincronizar.
 *
 * Idempotente. Rodar de novo pega contas atribuídas no Business Manager desde a
 * última vez, que é o comportamento que o painel já tinha: atribuir uma conta
 * nova ao usuário do sistema basta para ela aparecer.
 */
async function principal(): Promise<void> {
  const slug = process.env.SEED_SLUG ?? "marktiva";

  await comoAdmin(async (tx) => {
    const orgs = await tx
      .select({ id: organizacoes.id, proprietarioId: organizacoes.proprietarioId })
      .from(organizacoes)
      .where(eq(organizacoes.slug, slug))
      .limit(1);

    const org = orgs[0];
    if (!org?.proprietarioId) {
      throw new Error(`Organização "${slug}" não encontrada. Rode npm run db:semear antes.`);
    }

    const ctx = {
      organizacaoId: org.id,
      usuarioId: org.proprietarioId,
      permissoes: new Set(["*"]),
      clientesPermitidos: null,
      ehProprietario: true,
    };

    const tokens = await tx
      .select({ id: credenciais.id, clienteId: credenciais.clienteId })
      .from(credenciais)
      .where(and(eq(credenciais.plataforma, "meta_ads"), isNull(credenciais.excluidoEm)));

    if (tokens.length === 0) {
      console.log("Nenhuma credencial do Meta. Rode npm run db:importar-meta antes.");
      return;
    }

    let total = 0;
    for (const t of tokens) {
      try {
        const novas = await trafego.descobrirContas(tx, ctx, t.id, t.clienteId);
        total += novas;
        console.log(`credencial ${t.id.slice(0, 8)} → ${novas} conta(s) nova(s)`);
      } catch (e) {
        // Token vencido de um cliente não pode impedir a descoberta dos outros.
        console.error(
          `credencial ${t.id.slice(0, 8)} falhou: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    console.log(`\n${total} conta(s) registrada(s). O worker sincroniza a partir da próxima volta.`);
  });
}

principal()
  .then(fechar)
  .catch(async (e: unknown) => {
    console.error("falha ao descobrir contas:", e instanceof Error ? e.message : e);
    await fechar().catch(() => {});
    process.exitCode = 1;
  });

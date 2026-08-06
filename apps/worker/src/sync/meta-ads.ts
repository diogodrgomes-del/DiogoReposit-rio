import { and, eq, isNull } from "drizzle-orm";
import { trafego } from "@mark/core";
import { comContexto, contasAnuncio, listarOrganizacoesAtivas } from "@mark/db";

/**
 * Sincronização do Meta Ads.
 *
 * Roda a cada 30 minutos. Percorre as organizações, e dentro de cada uma as
 * contas ativas, gravando a série diária no banco. O painel passa a ler daqui.
 *
 * Janela de 7 dias por padrão, e não "só o que falta": a Meta revisa números
 * retroativamente por causa da janela de atribuição de 7 dias das conversas
 * iniciadas. Um dia já sincronizado continua mudando.
 *
 * Uma conta por transação, de propósito. Token vencido de um cliente não pode
 * desfazer o que já foi gravado dos outros.
 */

const JANELA_DIAS = Number(process.env.SYNC_JANELA_DIAS ?? 7);

export type ResumoSync = {
  contas: number;
  linhas: number;
  falhas: number;
};

export async function sincronizarMetaAds(): Promise<ResumoSync> {
  const resumo: ResumoSync = { contas: 0, linhas: 0, falhas: 0 };

  // Função estreita em @mark/db em vez de `comoAdmin` aqui: descobrir quais
  // organizações existem é o único passo que antecede o contexto, e ele merece
  // um nome próprio em vez de uma válvula genérica solta no worker.
  const orgs = await listarOrganizacoesAtivas();

  for (const org of orgs) {
    if (!org.proprietarioId) continue;

    // Contexto do sistema com identidade do proprietário: o que importa aqui é
    // a autoria correta no registro de execução. As permissões vêm abertas
    // porque o sync não atende ninguém — ele alimenta o que as telas depois
    // vão ler já filtrado.
    const ctx = {
      organizacaoId: org.id,
      usuarioId: org.proprietarioId,
      permissoes: new Set(["trafego.sincronizar", "trafego.painel.ver"]),
      clientesPermitidos: null,
      ehProprietario: false,
    };

    const contas = await comContexto(ctx, async (tx) =>
      tx
        .select({
          id: contasAnuncio.id,
          externoId: contasAnuncio.externoId,
          nome: contasAnuncio.nome,
          credencialId: contasAnuncio.credencialId,
        })
        .from(contasAnuncio)
        .where(and(eq(contasAnuncio.ativa, true), isNull(contasAnuncio.excluidoEm))),
    );

    for (const conta of contas) {
      resumo.contas++;
      // Transação por conta: a falha de uma não desfaz o que já foi gravado.
      const r = await comContexto(ctx, (tx) =>
        trafego.sincronizarConta(tx, ctx, conta, JANELA_DIAS),
      );

      resumo.linhas += r.linhas;
      if (r.erro) {
        resumo.falhas++;
        console.error(`[sync] ${r.conta}: ${r.erro}`);
      }
    }
  }

  return resumo;
}

import { eq } from "drizzle-orm";
import { clientes as regraClientes, credenciais as regraCredenciais } from "@mark/core";
import { cofreConfigurado } from "@mark/cofre";
import { comoAdmin, fechar } from "../cliente.js";
import { organizacoes } from "../esquema/nucleo.js";

/**
 * `npm run db:importar-meta`
 *
 * Tira a carteira de clientes de `META_TOKENS` e a coloca no banco: um registro
 * em `clientes` por cliente, e o token cifrado em `credenciais`.
 *
 * É o primeiro passo real da migração — o painel hoje descobre os clientes por
 * variável de ambiente, e o sistema inteiro gira em torno da entidade cliente.
 * Ela não pode continuar morando num `.env`.
 *
 * Idempotente: rodar de novo não duplica cliente e atualiza o token de quem já
 * existe, que é justamente o que se quer quando um token expira.
 *
 * O painel continua lendo `META_TOKENS` até a fase em que passar a ler do
 * banco. As duas fontes convivem de propósito: nada quebra no meio do caminho.
 */

/**
 * Mesmo formato aceito pelo painel: uma linha por cliente, `Nome = TOKEN`,
 * separador `=` ou `|`, linhas separadas por quebra ou ponto-e-vírgula. Isso
 * cobre tanto o campo multilinha da Vercel quanto um valor colado numa linha só.
 */
function lerTokens(): { nome: string; token: string }[] {
  const bruto = process.env.META_TOKENS ?? "";
  const unico = process.env.META_ACCESS_TOKEN ?? "";
  const lista: { nome: string; token: string }[] = [];

  for (const linha of bruto.split(/[\n;]+/)) {
    const texto = linha.trim();
    if (!texto || texto.startsWith("#")) continue;
    const corte = texto.search(/[=|]/);
    if (corte < 1) continue;
    const nome = texto.slice(0, corte).trim();
    const token = texto.slice(corte + 1).trim();
    if (nome && token) lista.push({ nome, token });
  }

  if (unico.trim() && !lista.some((c) => c.token === unico.trim())) {
    lista.push({
      nome: process.env.META_ACCESS_TOKEN_NOME || "Marktiva",
      token: unico.trim(),
    });
  }

  return lista;
}

async function principal(): Promise<void> {
  if (!cofreConfigurado()) {
    throw new Error(
      "COFRE_KEKS ausente. Sem ela os tokens iriam para o banco em texto puro — o script recusa.\n" +
        "Gere com: node -e \"console.log('1:' + require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }

  const carteira = lerTokens();
  if (carteira.length === 0) {
    console.log("Nenhum cliente em META_TOKENS. Nada a importar.");
    return;
  }

  const slug = process.env.SEED_SLUG ?? "marktiva";

  await comoAdmin(async (tx) => {
    const orgs = await tx
      .select({ id: organizacoes.id, proprietarioId: organizacoes.proprietarioId })
      .from(organizacoes)
      .where(eq(organizacoes.slug, slug))
      .limit(1);

    const org = orgs[0];
    if (!org?.proprietarioId) {
      throw new Error(`Organização "${slug}" não encontrada ou sem proprietário. Rode npm run db:semear antes.`);
    }

    // Contexto de importação: identidade do proprietário, permissões abertas.
    // A transação já roda com app_admin, então a RLS está de lado — o que vale
    // aqui é registrar autoria correta nos eventos e na auditoria.
    const ctx = {
      organizacaoId: org.id,
      usuarioId: org.proprietarioId,
      permissoes: new Set(["*"]),
      clientesPermitidos: null,
      ehProprietario: true,
    };

    let novos = 0;
    let atualizados = 0;

    for (const { nome, token } of carteira) {
      const cliente = await regraClientes.garantirPorNome(tx, ctx, nome);
      const credencial = await regraCredenciais.garantir(tx, ctx, {
        clienteId: cliente.id,
        plataforma: "meta_ads",
        rotulo: "Token do painel",
        segredo: token,
        observacoes: "Importado de META_TOKENS.",
      });

      if (cliente.criado) novos++;
      if (!credencial.criado) atualizados++;

      // O token nunca aparece no log — só o nome e o que aconteceu.
      console.log(
        `${cliente.criado ? "criado    " : "existente "} ${nome}` +
          `${credencial.criado ? "  + token" : "  ~ token atualizado"}`,
      );
    }

    console.log(
      `\n${carteira.length} clientes processados: ${novos} novos, ` +
        `${atualizados} tokens atualizados.`,
    );
    console.log("Os tokens estão cifrados. META_TOKENS pode continuar onde está até a fase 1 terminar.");
  });
}

principal()
  .then(fechar)
  .catch(async (e: unknown) => {
    console.error("falha na importação:", e instanceof Error ? e.message : e);
    await fechar().catch(() => {});
    process.exitCode = 1;
  });

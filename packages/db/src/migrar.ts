import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { comoAdmin, db } from "./cliente";

/**
 * Migrador.
 *
 * Aplica os `.sql` de `migracoes/` em ordem, cada um dentro de uma transação, e
 * registra o que aplicou. Rodar duas vezes não repete nada.
 *
 * Cinquenta linhas em vez de uma ferramenta: o que precisamos dela é aplicar
 * arquivo em ordem e não repetir. Em troca, o SQL é exatamente o que está no
 * arquivo — sem journal a sincronizar, e sem uma ferramenta propondo desfazer
 * política de RLS que ela não entende.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, "..", "migracoes");

async function jaAplicadas(): Promise<Set<string>> {
  const banco = db();
  await banco.execute(sql`
    CREATE TABLE IF NOT EXISTS _migracoes (
      nome       text PRIMARY KEY,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  const r = await banco.execute<{ nome: string }>(sql`SELECT nome FROM _migracoes`);
  const linhas = Array.isArray(r) ? r : (r as { rows: { nome: string }[] }).rows;
  return new Set(linhas.map((l) => l.nome));
}

export async function migrar(): Promise<string[]> {
  const arquivos = (await readdir(PASTA))
    .filter((n) => n.endsWith(".sql"))
    .sort(); // 0001, 0002… a ordem lexicográfica é a cronológica por convenção

  const aplicadas = await jaAplicadas();
  const novas: string[] = [];

  for (const nome of arquivos) {
    if (aplicadas.has(nome)) continue;

    const conteudo = await readFile(join(PASTA, nome), "utf8");

    // Uma transação por arquivo: falhou no meio, não aplica nada dele.
    await comoAdmin(async (tx) => {
      await tx.execute(sql.raw(conteudo));
      await tx.execute(sql`INSERT INTO _migracoes (nome) VALUES (${nome})`);
    });

    novas.push(nome);
    console.log(`aplicada  ${nome}`);
  }

  if (novas.length === 0) console.log("banco já está atualizado");
  return novas;
}

/**
 * Quantas migrações já foram aplicadas, ou `null` se o banco não responde.
 *
 * Existe para o diagnóstico distinguir três estados que, na tela de login,
 * parecem o mesmo: sem banco, banco vazio e banco pronto. Nunca lança — a
 * falha é a resposta.
 */
export async function migracoesAplicadas(): Promise<number | null> {
  try {
    const r = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM _migracoes`);
    const linhas = Array.isArray(r) ? r : (r as { rows: { n: number }[] }).rows;
    return linhas[0]?.n ?? 0;
  } catch (e) {
    // Tabela ausente é o caso normal de banco novo, ainda sem migrar.
    if (e instanceof Error && /_migracoes/.test(e.message)) return 0;
    return null;
  }
}

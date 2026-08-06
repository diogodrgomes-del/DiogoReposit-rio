import { Pool as PoolNeon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool as PoolPg } from "pg";
import * as esquema from "./esquema/index";

/**
 * Conexão com o Postgres e o contexto de RLS.
 *
 * Dois drivers, escolhidos pela URL — mesma decisão do painel de campanhas, por
 * um motivo parecido: em serverless cada invocação abre a própria conexão, e o
 * driver da Neon existe para isso.
 *
 * Diferença importante em relação ao painel: lá bastava o driver HTTP da Neon,
 * que não tem transação. Aqui **não serve**. A RLS depende de `set_config(...,
 * true)`, que é válido só dentro de uma transação; sobre HTTP cada consulta é
 * uma conexão nova e o contexto se perde entre elas. Por isso usamos o Pool
 * sobre WebSocket, que mantém transação de verdade.
 */

export type Esquema = typeof esquema;

function urlBanco(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ausente. Copie apps/web/.env.example para .env.local e preencha.",
    );
  }
  return url;
}

const ehNeon = (url: string) => /neon\.tech|vercel-storage\.com/.test(url);

type BancoNeon = ReturnType<typeof drizzleNeon<Esquema>>;
type BancoPg = ReturnType<typeof drizzlePg<Esquema>>;

/** União dos dois drivers. As consultas do sistema só usam o que há em comum. */
export type Banco = BancoNeon | BancoPg;
export type Transacao = Parameters<Parameters<BancoPg["transaction"]>[0]>[0];

let banco: Banco | null = null;

export function db(): Banco {
  if (banco) return banco;

  const url = urlBanco();

  if (ehNeon(url)) {
    // Node 22 e os runtimes da Vercel já trazem WebSocket global; em ambientes
    // mais antigos o driver avisa em vez de falhar silenciosamente.
    if (typeof globalThis.WebSocket === "undefined") {
      throw new Error(
        "WebSocket indisponível neste runtime. O driver da Neon precisa dele para abrir transação.",
      );
    }
    neonConfig.webSocketConstructor = globalThis.WebSocket;
    banco = drizzleNeon({ client: new PoolNeon({ connectionString: url }), schema: esquema });
  } else {
    banco = drizzlePg({ client: new PoolPg({ connectionString: url, max: 5 }), schema: esquema });
  }

  return banco;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Roda `fn` numa transação com o contexto de RLS definido.
 *
 * `set_config(..., true)` — e não `SET` — é o detalhe que impede vazamento
 * entre organizações: o valor morre com a transação. Com `SET` comum, a
 * próxima requisição a reaproveitar a conexão do pool herdaria a organização da
 * anterior, e o isolamento inteiro cairia de um jeito difícil de notar.
 *
 * `SET LOCAL app.x = $1` não existe: SET não aceita parâmetro. Daí set_config,
 * que aceita — e portanto não precisa de interpolação de string.
 */
export async function comContexto<T>(
  ctx: { organizacaoId: string; usuarioId: string },
  fn: (tx: Transacao) => Promise<T>,
): Promise<T> {
  if (!UUID.test(ctx.organizacaoId) || !UUID.test(ctx.usuarioId)) {
    throw new Error("Contexto inválido: organizacaoId e usuarioId devem ser uuid.");
  }

  return (db() as BancoPg).transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.organizacao_id', ${ctx.organizacaoId}, true),
                 set_config('app.usuario_id',     ${ctx.usuarioId},     true)`,
    );
    return fn(tx);
  });
}

/**
 * Abre `usuarios` e `sessoes` para o caminho de login, onde ainda não há
 * usuário conhecido. Nenhuma outra tabela responde a esta variável.
 *
 * Uso restrito a @mark/auth. Se aparecer chamada fora de lá, é bug.
 */
export async function autenticando<T>(fn: (tx: Transacao) => Promise<T>): Promise<T> {
  return (db() as BancoPg).transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.autenticando', 'sim', true)`);
    return fn(tx);
  });
}

/**
 * Contexto parcial: identidade sem organização.
 *
 * Existe para o passo do login em que já se sabe quem é o usuário mas ainda não
 * a que organização ele pertence — a resposta está em `membros`, cuja política
 * aceita `usuario_id = app_usuario()` justamente para isto. Sem organização
 * definida, nenhuma outra tabela devolve linha.
 */
export async function comUsuario<T>(
  usuarioId: string,
  fn: (tx: Transacao) => Promise<T>,
): Promise<T> {
  if (!UUID.test(usuarioId)) throw new Error("usuarioId deve ser uuid.");

  return (db() as BancoPg).transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.usuario_id', ${usuarioId}, true)`);
    return fn(tx);
  });
}

/**
 * Ignora a RLS por completo. Só para migração, seed e manutenção pela CLI.
 * Nunca importar isto de apps/web.
 */
export async function comoAdmin<T>(fn: (tx: Transacao) => Promise<T>): Promise<T> {
  return (db() as BancoPg).transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.admin', 'sim', true)`);
    return fn(tx);
  });
}

/** Encerra o pool. Necessário para a CLI e o worker saírem sem travar. */
export async function fechar(): Promise<void> {
  const atual = banco as unknown as { $client?: { end?: () => Promise<void> } } | null;
  await atual?.$client?.end?.();
  banco = null;
}

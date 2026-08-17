import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/**
 * Acesso ao Postgres, compartilhado por quem precisa gravar algo.
 *
 * Nasceu dentro de registro.ts, quando as anotacoes eram o unico dado do
 * painel que nao vinha da Meta. Com o financeiro isso deixou de ser verdade —
 * e duas copias da mesma escolha de driver seria uma a mais do que o
 * necessario.
 *
 * Sem DATABASE_URL configurada nada quebra: `conexao()` devolve null e cada
 * modulo decide o que fazer com isso. O painel de campanhas continua servindo
 * a Meta normalmente, e o financeiro avisa na tela que falta o banco.
 */

function urlBanco(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

/** Consulta parametrizada, no formato de template tag. */
export type Consulta = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...valores: unknown[]
) => Promise<T[]>;

let pool: Pool | null = null;

/**
 * Dois drivers, escolhidos pela URL.
 *
 * Em Neon (o Postgres da Vercel) vale o driver HTTP: sem conexao persistente,
 * que e o que estoura o limite de conexoes quando cada invocacao serverless
 * abre a sua. Para qualquer outro Postgres — inclusive um local em
 * desenvolvimento — cai no driver padrao. Sem isso, rodar o painel na maquina
 * exigiria uma conta na Neon.
 */
export function conexao(): Consulta | null {
  const url = urlBanco();
  if (!url) return null;

  if (/neon\.tech|vercel-storage\.com/.test(url)) {
    const sql = neon(url);
    return ((strings, ...valores) =>
      sql(strings, ...valores) as unknown as Promise<never[]>) as Consulta;
  }

  pool ??= new Pool({ connectionString: url, max: 3 });
  return (async <T>(strings: TemplateStringsArray, ...valores: unknown[]) => {
    // Monta $1, $2… na ordem dos valores interpolados.
    const texto = strings.reduce(
      (acc, parte, i) => acc + parte + (i < valores.length ? `$${i + 1}` : ""),
      ""
    );
    const r = await pool!.query(texto, valores);
    return r.rows as T[];
  }) as Consulta;
}

/**
 * So olha a variavel, sem abrir driver: /api/saude chama isso a cada consulta e
 * nao ha por que instanciar um Pool para responder uma pergunta de configuracao.
 */
export function bancoConfigurado(): boolean {
  return urlBanco() !== null;
}

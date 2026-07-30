import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/**
 * Anotacoes de teste, por cliente.
 *
 * Guardadas em Postgres (Neon, o banco nativo da Vercel). Aqui um banco se
 * justifica: e o unico dado do painel que nasce dentro dele — todo o resto vem
 * da Meta a cada consulta e nao faz sentido copiar.
 *
 * Sem DATABASE_URL configurada, as funcoes devolvem vazio em vez de quebrar:
 * o painel continua servindo a linha do tempo automatica, e as anotacoes ligam
 * sozinhas quando a variavel aparecer.
 */

export type Anotacao = {
  id: number;
  clienteId: string;
  autor: string;
  texto: string;
  criadoEm: string;
};

function urlBanco(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

/** Consulta parametrizada, no formato de template tag. */
type Consulta = <T = Record<string, unknown>>(
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
function conexao(): Consulta | null {
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

export function bancoConfigurado(): boolean {
  return conexao() !== null;
}

/**
 * Cria a tabela na primeira escrita.
 *
 * Migracao preguicosa em vez de script separado: e uma tabela so, e assim o
 * deploy nao depende de alguem lembrar de rodar um comando antes.
 */
let tabelaPronta = false;
async function garantirTabela(sql: Consulta) {
  if (tabelaPronta) return;
  await sql`
    CREATE TABLE IF NOT EXISTS anotacoes (
      id         SERIAL PRIMARY KEY,
      cliente_id TEXT        NOT NULL,
      autor      TEXT        NOT NULL,
      texto      TEXT        NOT NULL,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS anotacoes_cliente_data
      ON anotacoes (cliente_id, criado_em DESC)
  `;
  tabelaPronta = true;
}

type Linha = {
  id: number;
  cliente_id: string;
  autor: string;
  texto: string;
  criado_em: string | Date;
};

const paraAnotacao = (l: Linha): Anotacao => ({
  id: l.id,
  clienteId: l.cliente_id,
  autor: l.autor,
  texto: l.texto,
  criadoEm: new Date(l.criado_em).toISOString(),
});

export async function listarAnotacoes(
  clienteId: string,
  limite = 200
): Promise<Anotacao[]> {
  const sql = conexao();
  if (!sql) return [];
  await garantirTabela(sql);
  const linhas = (await sql`
    SELECT id, cliente_id, autor, texto, criado_em
      FROM anotacoes
     WHERE cliente_id = ${clienteId}
     ORDER BY criado_em DESC
     LIMIT ${limite}
  `) as Linha[];
  return linhas.map(paraAnotacao);
}

export async function criarAnotacao(
  clienteId: string,
  autor: string,
  texto: string
): Promise<Anotacao | null> {
  const sql = conexao();
  if (!sql) return null;
  await garantirTabela(sql);
  const linhas = (await sql`
    INSERT INTO anotacoes (cliente_id, autor, texto)
    VALUES (${clienteId}, ${autor}, ${texto})
    RETURNING id, cliente_id, autor, texto, criado_em
  `) as Linha[];
  return linhas[0] ? paraAnotacao(linhas[0]) : null;
}

/** Só o próprio autor apaga o que escreveu. */
export async function apagarAnotacao(
  id: number,
  autor: string
): Promise<boolean> {
  const sql = conexao();
  if (!sql) return false;
  await garantirTabela(sql);
  const linhas = (await sql`
    DELETE FROM anotacoes
     WHERE id = ${id} AND autor = ${autor}
    RETURNING id
  `) as { id: number }[];
  return linhas.length > 0;
}

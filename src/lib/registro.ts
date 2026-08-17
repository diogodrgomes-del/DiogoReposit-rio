import { bancoConfigurado, conexao, type Consulta } from "./banco";

/**
 * Anotacoes de teste, por cliente.
 *
 * Guardadas em Postgres (Neon, o banco nativo da Vercel). Aqui um banco se
 * justifica: e o unico dado do painel de campanhas que nasce dentro dele —
 * todo o resto vem da Meta a cada consulta e nao faz sentido copiar.
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

// Reexportado porque /api/saude e /api/registro sempre importaram daqui.
export { bancoConfigurado };

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

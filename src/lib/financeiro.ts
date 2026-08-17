import { bancoConfigurado, conexao, type Consulta } from "./banco";
import {
  ehArea,
  ehTipo,
  type Area,
  type Categoria,
  type Lancamento,
  type Recorrencia,
  type Resumo,
  type SaldoMes,
  type Tipo,
} from "./financeiro-comum";
import { hojeISO } from "./presets";
import {
  competenciasEntre,
  ehFrequencia,
  somarMeses,
  vencimentoDe,
  type Frequencia,
} from "./recorrencia";

/**
 * Financeiro: entradas, saidas e contratos recorrentes.
 *
 * Duas areas que nunca se misturam — "marktiva" (a empresa) e "pessoal"
 * (Diogo). A separacao e por coluna e nao por tabela: as duas guardam
 * exatamente os mesmos campos, e toda consulta ja filtra por area de qualquer
 * jeito. Tabela dobrada so dobraria a migracao.
 *
 * Valores sao sempre positivos; quem da o sinal e o `tipo`. Assim o total de
 * despesas nao depende de ninguem lembrar de digitar o menos.
 *
 * Sem DATABASE_URL, tudo devolve vazio em vez de estourar — a tela mostra o
 * aviso de configuracao e o resto do painel segue funcionando.
 */

// Tipos e constantes ficam em financeiro-comum.ts, que a tela tambem importa;
// aqui vao so as funcoes que falam com o banco. O reexport mantem um unico
// ponto de import para quem roda no servidor.
export type {
  Area,
  Categoria,
  Lancamento,
  Recorrencia,
  Resumo,
  SaldoMes,
  Tipo,
} from "./financeiro-comum";
export {
  AREAS,
  CATEGORIAS,
  DESCRICAO_AREA,
  ehArea,
  ehTipo,
  FORMAS,
  ROTULO_AREA,
  valorDe,
} from "./financeiro-comum";

/** Quanto tempo para tras a geracao automatica olha, ao ligar um contrato antigo. */
const MESES_RETROATIVOS = 12;
/** Quanto para frente: o mes que vem ja aparece na agenda de cobranca. */
const MESES_ADIANTE = 2;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Cria as tabelas na primeira consulta.
 *
 * Mesma migracao preguicosa das anotacoes: o deploy nao depende de alguem
 * lembrar de rodar um script antes de abrir a tela.
 */
let tabelasProntas = false;
async function garantirTabelas(sql: Consulta) {
  if (tabelasProntas) return;

  await sql`
    CREATE TABLE IF NOT EXISTS fin_recorrencias (
      id              SERIAL PRIMARY KEY,
      area            TEXT        NOT NULL,
      tipo            TEXT        NOT NULL,
      descricao       TEXT        NOT NULL,
      categoria       TEXT        NOT NULL DEFAULT 'Outros',
      cliente         TEXT,
      valor           NUMERIC(14,2) NOT NULL,
      frequencia      TEXT        NOT NULL DEFAULT 'mensal',
      dia_vencimento  INTEGER     NOT NULL DEFAULT 10,
      inicio          DATE        NOT NULL,
      fim             DATE,
      lembrete_dias   INTEGER     NOT NULL DEFAULT 3,
      ajusta_dia_util BOOLEAN     NOT NULL DEFAULT TRUE,
      ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
      criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fin_lancamentos (
      id             SERIAL PRIMARY KEY,
      area           TEXT        NOT NULL,
      tipo           TEXT        NOT NULL,
      descricao      TEXT        NOT NULL,
      categoria      TEXT        NOT NULL DEFAULT 'Outros',
      cliente        TEXT,
      valor          NUMERIC(14,2) NOT NULL,
      competencia    TEXT        NOT NULL,
      vencimento     DATE        NOT NULL,
      pago_em        DATE,
      forma          TEXT,
      observacao     TEXT,
      cobrado_em     TIMESTAMPTZ,
      recorrencia_id INTEGER     REFERENCES fin_recorrencias(id) ON DELETE SET NULL,
      criado_por     TEXT,
      criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS fin_lanc_area_venc
      ON fin_lancamentos (area, vencimento)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS fin_lanc_area_comp
      ON fin_lancamentos (area, competencia)
  `;
  // Um contrato so gera uma cobranca por competencia. E o que deixa a geracao
  // automatica rodar a cada abertura da tela sem duplicar nada. Em Postgres
  // varios NULL nao colidem, entao lancamento avulso segue livre.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS fin_lanc_recorrencia_competencia
      ON fin_lancamentos (recorrencia_id, competencia)
  `;

  tabelasProntas = true;
}

type LinhaLancamento = {
  id: number;
  area: string;
  tipo: string;
  descricao: string;
  categoria: string;
  cliente: string | null;
  valor: string | number;
  competencia: string;
  vencimento: string;
  pago_em: string | null;
  forma: string | null;
  observacao: string | null;
  cobrado_em: string | Date | null;
  recorrencia_id: number | null;
  criado_em: string | Date;
};

const paraLancamento = (l: LinhaLancamento): Lancamento => ({
  id: l.id,
  area: (ehArea(l.area) ? l.area : "marktiva") as Area,
  tipo: (ehTipo(l.tipo) ? l.tipo : "entrada") as Tipo,
  descricao: l.descricao,
  categoria: l.categoria,
  cliente: l.cliente,
  valor: num(l.valor),
  competencia: l.competencia,
  vencimento: l.vencimento,
  pagoEm: l.pago_em,
  forma: l.forma,
  observacao: l.observacao,
  cobradoEm: l.cobrado_em ? new Date(l.cobrado_em).toISOString() : null,
  recorrenciaId: l.recorrencia_id,
  criadoEm: new Date(l.criado_em).toISOString(),
});

type LinhaRecorrencia = {
  id: number;
  area: string;
  tipo: string;
  descricao: string;
  categoria: string;
  cliente: string | null;
  valor: string | number;
  frequencia: string;
  dia_vencimento: number;
  inicio: string;
  fim: string | null;
  lembrete_dias: number;
  ajusta_dia_util: boolean;
  ativo: boolean;
  criado_em: string | Date;
};

const paraRecorrencia = (l: LinhaRecorrencia): Recorrencia => ({
  id: l.id,
  area: (ehArea(l.area) ? l.area : "marktiva") as Area,
  tipo: (ehTipo(l.tipo) ? l.tipo : "entrada") as Tipo,
  descricao: l.descricao,
  categoria: l.categoria,
  cliente: l.cliente,
  valor: num(l.valor),
  frequencia: (ehFrequencia(l.frequencia) ? l.frequencia : "mensal") as Frequencia,
  diaVencimento: l.dia_vencimento,
  inicio: l.inicio,
  fim: l.fim,
  lembreteDias: l.lembrete_dias,
  ajustaDiaUtil: l.ajusta_dia_util,
  ativo: l.ativo,
  criadoEm: new Date(l.criado_em).toISOString(),
});

/**
 * Duas convencoes valem para todas as consultas daqui para baixo.
 *
 * Datas saem como texto (`to_char`): o driver `pg` converteria DATE para um
 * Date do JavaScript no fuso da maquina — "2026-08-01" viraria 31/07 21:00 em
 * Brasilia, e o lancamento apareceria no mes errado.
 *
 * E a lista de colunas vai escrita em cada consulta, nunca numa constante
 * interpolada: dentro de uma template tag `${...}` vira parametro ($1), o que
 * mandaria os nomes das colunas como se fossem um valor.
 */
export { bancoConfigurado };

// ------------------------------------------------------------------
// Lancamentos
// ------------------------------------------------------------------

export type NovoLancamento = {
  area: Area;
  tipo: Tipo;
  descricao: string;
  categoria: string;
  cliente: string | null;
  valor: number;
  competencia: string;
  vencimento: string;
  pagoEm: string | null;
  forma: string | null;
  observacao: string | null;
};

export async function criarLancamento(
  dados: NovoLancamento,
  autor: string
): Promise<Lancamento | null> {
  const sql = conexao();
  if (!sql) return null;
  await garantirTabelas(sql);
  const linhas = (await sql`
    INSERT INTO fin_lancamentos
      (area, tipo, descricao, categoria, cliente, valor, competencia,
       vencimento, pago_em, forma, observacao, criado_por)
    VALUES
      (${dados.area}, ${dados.tipo}, ${dados.descricao}, ${dados.categoria},
       ${dados.cliente}, ${dados.valor}, ${dados.competencia},
       ${dados.vencimento}, ${dados.pagoEm}, ${dados.forma},
       ${dados.observacao}, ${autor})
    RETURNING id, area, tipo, descricao, categoria, cliente, valor, competencia,
           to_char(vencimento, 'YYYY-MM-DD') AS vencimento,
           to_char(pago_em,    'YYYY-MM-DD') AS pago_em,
           forma, observacao, cobrado_em, recorrencia_id, criado_em
  `) as LinhaLancamento[];
  return linhas[0] ? paraLancamento(linhas[0]) : null;
}

/** Marca (ou desmarca, com `pagoEm` nulo) o pagamento de um lancamento. */
export async function registrarPagamento(
  id: number,
  pagoEm: string | null,
  forma: string | null
): Promise<Lancamento | null> {
  const sql = conexao();
  if (!sql) return null;
  await garantirTabelas(sql);
  const linhas = (await sql`
    UPDATE fin_lancamentos
       SET pago_em = ${pagoEm},
           -- ::text porque o Postgres nao consegue inferir o tipo de um
           -- parametro nulo dentro de COALESCE.
           forma   = COALESCE(${forma}::text, forma)
     WHERE id = ${id}
    RETURNING id, area, tipo, descricao, categoria, cliente, valor, competencia,
           to_char(vencimento, 'YYYY-MM-DD') AS vencimento,
           to_char(pago_em,    'YYYY-MM-DD') AS pago_em,
           forma, observacao, cobrado_em, recorrencia_id, criado_em
  `) as LinhaLancamento[];
  return linhas[0] ? paraLancamento(linhas[0]) : null;
}

/**
 * Anota que a cobranca foi enviada.
 *
 * Nao mexe no pagamento: serve para o lembrete parar de pedir a mesma coisa
 * todo dia sem fingir que o dinheiro entrou.
 */
export async function marcarCobrado(
  id: number,
  cobrado: boolean
): Promise<Lancamento | null> {
  const sql = conexao();
  if (!sql) return null;
  await garantirTabelas(sql);
  const linhas = (await sql`
    UPDATE fin_lancamentos
       SET cobrado_em = ${cobrado ? new Date().toISOString() : null}
     WHERE id = ${id}
    RETURNING id, area, tipo, descricao, categoria, cliente, valor, competencia,
           to_char(vencimento, 'YYYY-MM-DD') AS vencimento,
           to_char(pago_em,    'YYYY-MM-DD') AS pago_em,
           forma, observacao, cobrado_em, recorrencia_id, criado_em
  `) as LinhaLancamento[];
  return linhas[0] ? paraLancamento(linhas[0]) : null;
}

export async function apagarLancamento(id: number): Promise<boolean> {
  const sql = conexao();
  if (!sql) return false;
  await garantirTabelas(sql);
  const linhas = (await sql`
    DELETE FROM fin_lancamentos WHERE id = ${id} RETURNING id
  `) as { id: number }[];
  return linhas.length > 0;
}

// ------------------------------------------------------------------
// Recorrencias
// ------------------------------------------------------------------

export type NovaRecorrencia = {
  area: Area;
  tipo: Tipo;
  descricao: string;
  categoria: string;
  cliente: string | null;
  valor: number;
  frequencia: Frequencia;
  diaVencimento: number;
  inicio: string;
  fim: string | null;
  lembreteDias: number;
  ajustaDiaUtil: boolean;
};

export async function listarRecorrencias(area: Area): Promise<Recorrencia[]> {
  const sql = conexao();
  if (!sql) return [];
  await garantirTabelas(sql);
  const linhas = (await sql`
    SELECT id, area, tipo, descricao, categoria, cliente, valor, frequencia,
           dia_vencimento,
           to_char(inicio, 'YYYY-MM-DD') AS inicio,
           to_char(fim,    'YYYY-MM-DD') AS fim,
           lembrete_dias, ajusta_dia_util, ativo, criado_em
      FROM fin_recorrencias
     WHERE area = ${area}
     ORDER BY ativo DESC, dia_vencimento, descricao
  `) as LinhaRecorrencia[];
  return linhas.map(paraRecorrencia);
}

export async function criarRecorrencia(
  dados: NovaRecorrencia
): Promise<Recorrencia | null> {
  const sql = conexao();
  if (!sql) return null;
  await garantirTabelas(sql);
  const linhas = (await sql`
    INSERT INTO fin_recorrencias
      (area, tipo, descricao, categoria, cliente, valor, frequencia,
       dia_vencimento, inicio, fim, lembrete_dias, ajusta_dia_util)
    VALUES
      (${dados.area}, ${dados.tipo}, ${dados.descricao}, ${dados.categoria},
       ${dados.cliente}, ${dados.valor}, ${dados.frequencia},
       ${dados.diaVencimento}, ${dados.inicio}, ${dados.fim},
       ${dados.lembreteDias}, ${dados.ajustaDiaUtil})
    RETURNING id, area, tipo, descricao, categoria, cliente, valor, frequencia,
           dia_vencimento,
           to_char(inicio, 'YYYY-MM-DD') AS inicio,
           to_char(fim,    'YYYY-MM-DD') AS fim,
           lembrete_dias, ajusta_dia_util, ativo, criado_em
  `) as LinhaRecorrencia[];
  return linhas[0] ? paraRecorrencia(linhas[0]) : null;
}

/** Liga ou desliga um contrato. Desligado para de gerar cobranca nova. */
export async function alternarRecorrencia(
  id: number,
  ativo: boolean
): Promise<Recorrencia | null> {
  const sql = conexao();
  if (!sql) return null;
  await garantirTabelas(sql);
  const linhas = (await sql`
    UPDATE fin_recorrencias SET ativo = ${ativo} WHERE id = ${id}
    RETURNING id, area, tipo, descricao, categoria, cliente, valor, frequencia,
           dia_vencimento,
           to_char(inicio, 'YYYY-MM-DD') AS inicio,
           to_char(fim,    'YYYY-MM-DD') AS fim,
           lembrete_dias, ajusta_dia_util, ativo, criado_em
  `) as LinhaRecorrencia[];
  return linhas[0] ? paraRecorrencia(linhas[0]) : null;
}

/**
 * Apaga o contrato e as cobrancas dele que ainda nao foram pagas.
 *
 * O que ja foi pago fica: e historico de caixa, e o contrato ter acabado nao
 * apaga o dinheiro que entrou. Esses viram lancamentos avulsos (a FK e
 * `ON DELETE SET NULL`).
 */
export async function apagarRecorrencia(id: number): Promise<boolean> {
  const sql = conexao();
  if (!sql) return false;
  await garantirTabelas(sql);
  await sql`
    DELETE FROM fin_lancamentos
     WHERE recorrencia_id = ${id} AND pago_em IS NULL
  `;
  const linhas = (await sql`
    DELETE FROM fin_recorrencias WHERE id = ${id} RETURNING id
  `) as { id: number }[];
  return linhas.length > 0;
}

/**
 * Materializa as cobrancas dos contratos ativos.
 *
 * Roda a cada abertura da tela, em vez de depender de um agendador: assim o
 * lembrete existe mesmo que ninguem tenha configurado cron nenhum.
 *
 * Comeca perguntando o que ja existe, numa consulta so, e insere apenas o que
 * falta. Sem isso, cada abertura da tela dispararia um INSERT por contrato e
 * por competencia — dezenas de idas ao banco para, quase sempre, nao criar
 * nada. O indice unico continua sendo a garantia de que duas abas abertas ao
 * mesmo tempo nao duplicam a cobranca.
 *
 * Devolve quantas cobrancas nasceram agora — a tela avisa quando aparecem.
 */
export async function gerarCobrancas(area: Area): Promise<number> {
  const sql = conexao();
  if (!sql) return 0;
  await garantirTabelas(sql);

  const contratos = (await listarRecorrencias(area)).filter((r) => r.ativo);
  if (contratos.length === 0) return 0;

  const mesAtual = hojeISO().slice(0, 7);
  const de = somarMeses(mesAtual, -MESES_RETROATIVOS);
  const ate = somarMeses(mesAtual, MESES_ADIANTE);

  const existentes = (await sql`
    SELECT recorrencia_id, competencia
      FROM fin_lancamentos
     WHERE area = ${area}
       AND recorrencia_id IS NOT NULL
       AND competencia BETWEEN ${de} AND ${ate}
  `) as { recorrencia_id: number; competencia: string }[];

  const jaTem = new Set(
    existentes.map((l) => `${l.recorrencia_id}|${l.competencia}`)
  );

  let criadas = 0;
  for (const r of contratos) {
    const competencias = competenciasEntre(r.inicio, r.fim, de, ate, r.frequencia);
    for (const competencia of competencias) {
      if (jaTem.has(`${r.id}|${competencia}`)) continue;
      const vencimento = vencimentoDe(
        competencia,
        r.diaVencimento,
        r.ajustaDiaUtil
      );
      const linhas = (await sql`
        INSERT INTO fin_lancamentos
          (area, tipo, descricao, categoria, cliente, valor, competencia,
           vencimento, recorrencia_id, criado_por)
        VALUES
          (${r.area}, ${r.tipo}, ${r.descricao}, ${r.categoria}, ${r.cliente},
           ${r.valor}, ${competencia}, ${vencimento}, ${r.id}, 'recorrência')
        ON CONFLICT (recorrencia_id, competencia) DO NOTHING
        RETURNING id
      `) as { id: number }[];
      criadas += linhas.length;
    }
  }
  return criadas;
}

// ------------------------------------------------------------------
// Consultas da tela
// ------------------------------------------------------------------

export async function lancamentosDoMes(
  area: Area,
  competencia: string
): Promise<Lancamento[]> {
  const sql = conexao();
  if (!sql) return [];
  await garantirTabelas(sql);
  const linhas = (await sql`
    SELECT id, area, tipo, descricao, categoria, cliente, valor, competencia,
           to_char(vencimento, 'YYYY-MM-DD') AS vencimento,
           to_char(pago_em,    'YYYY-MM-DD') AS pago_em,
           forma, observacao, cobrado_em, recorrencia_id, criado_em
      FROM fin_lancamentos
     WHERE area = ${area} AND competencia = ${competencia}
     ORDER BY vencimento, id
  `) as LinhaLancamento[];
  return linhas.map(paraLancamento);
}

/**
 * Tudo que esta em aberto ate um horizonte, de qualquer competencia.
 *
 * A agenda de cobranca nao pode olhar so o mes escolhido: a fatura de marco
 * que ninguem pagou continua sendo dinheiro a receber em agosto.
 */
export async function pendentesAte(
  area: Area,
  limite: string
): Promise<Lancamento[]> {
  const sql = conexao();
  if (!sql) return [];
  await garantirTabelas(sql);
  const linhas = (await sql`
    SELECT id, area, tipo, descricao, categoria, cliente, valor, competencia,
           to_char(vencimento, 'YYYY-MM-DD') AS vencimento,
           to_char(pago_em,    'YYYY-MM-DD') AS pago_em,
           forma, observacao, cobrado_em, recorrencia_id, criado_em
      FROM fin_lancamentos
     WHERE area = ${area}
       AND pago_em IS NULL
       AND vencimento <= ${limite}
     ORDER BY vencimento, id
  `) as LinhaLancamento[];
  return linhas.map(paraLancamento);
}

/** Saldo mes a mes, para o grafico da evolucao. */
export async function serieMensal(
  area: Area,
  de: string,
  ate: string
): Promise<SaldoMes[]> {
  const sql = conexao();
  if (!sql) return [];
  await garantirTabelas(sql);
  const linhas = (await sql`
    SELECT competencia,
           COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS entradas,
           COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0)   AS saidas,
           COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'
                                         AND pago_em IS NOT NULL), 0) AS recebido,
           COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'
                                         AND pago_em IS NOT NULL), 0) AS pago
      FROM fin_lancamentos
     WHERE area = ${area} AND competencia BETWEEN ${de} AND ${ate}
     GROUP BY competencia
     ORDER BY competencia
  `) as Record<string, string | number>[];
  return linhas.map((l) => ({
    competencia: String(l.competencia),
    entradas: num(l.entradas),
    saidas: num(l.saidas),
    recebido: num(l.recebido),
    pago: num(l.pago),
  }));
}

/** Todos os totais do mes, somados uma vez so a partir da lista. */
export function resumoDe(lancamentos: Lancamento[], hoje = hojeISO()): Resumo {
  const r: Resumo = {
    entradasPrevistas: 0,
    entradasRecebidas: 0,
    saidasPrevistas: 0,
    saidasPagas: 0,
    saldoPrevisto: 0,
    saldoRealizado: 0,
    aReceber: 0,
    aPagar: 0,
    vencidoReceber: 0,
    vencidoPagar: 0,
  };

  for (const l of lancamentos) {
    const pago = l.pagoEm !== null;
    const vencido = !pago && l.vencimento < hoje;
    if (l.tipo === "entrada") {
      r.entradasPrevistas += l.valor;
      if (pago) r.entradasRecebidas += l.valor;
      else {
        r.aReceber += l.valor;
        if (vencido) r.vencidoReceber += l.valor;
      }
    } else {
      r.saidasPrevistas += l.valor;
      if (pago) r.saidasPagas += l.valor;
      else {
        r.aPagar += l.valor;
        if (vencido) r.vencidoPagar += l.valor;
      }
    }
  }

  r.saldoPrevisto = r.entradasPrevistas - r.saidasPrevistas;
  r.saldoRealizado = r.entradasRecebidas - r.saidasPagas;
  return r;
}

/** Despesas agrupadas por categoria, da maior para a menor. */
export function despesasPorCategoria(lancamentos: Lancamento[]): Categoria[] {
  const mapa = new Map<string, Categoria>();
  for (const l of lancamentos) {
    if (l.tipo !== "saida") continue;
    const atual = mapa.get(l.categoria) ?? {
      categoria: l.categoria,
      previsto: 0,
      pago: 0,
      itens: 0,
    };
    atual.previsto += l.valor;
    if (l.pagoEm) atual.pago += l.valor;
    atual.itens += 1;
    mapa.set(l.categoria, atual);
  }
  return [...mapa.values()].sort((a, b) => b.previsto - a.previsto);
}

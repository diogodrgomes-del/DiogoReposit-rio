/**
 * Calendario brasileiro: feriados nacionais e dias uteis.
 *
 * Calculado, nao tabelado. Uma lista fixa de datas envelhece — em janeiro de
 * cada ano alguem teria que lembrar de acrescentar o Carnaval seguinte, e a
 * primeira cobranca a cair num feriado nao previsto passaria batida. Aqui os
 * moveis saem da Pascoa, entao qualquer ano futuro ja nasce correto.
 *
 * Inclui o 20 de novembro (Consciencia Negra), nacional desde a Lei
 * 14.759/2023.
 */

export type TipoFeriado = "nacional" | "bancario";

export type Feriado = {
  data: string; // YYYY-MM-DD
  nome: string;
  /**
   * "nacional" e feriado por lei; "bancario" e ponto facultativo em que banco
   * nao compensa — para vencimento de boleto, os dois valem igual.
   */
  tipo: TipoFeriado;
};

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Domingo de Pascoa pelo algoritmo de Gauss/Meeus (calendario gregoriano). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somar(base: Date, dias: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

const cache = new Map<number, Feriado[]>();

/** Feriados de um ano, em ordem de data. */
export function feriadosDoAno(ano: number): Feriado[] {
  const guardado = cache.get(ano);
  if (guardado) return guardado;

  const p = pascoa(ano);
  const fixo = (mes: number, dia: number) =>
    `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  const lista: Feriado[] = [
    { data: fixo(1, 1), nome: "Confraternização Universal", tipo: "nacional" },
    { data: iso(somar(p, -48)), nome: "Carnaval", tipo: "bancario" },
    { data: iso(somar(p, -47)), nome: "Carnaval", tipo: "bancario" },
    { data: iso(somar(p, -46)), nome: "Quarta-feira de Cinzas", tipo: "bancario" },
    { data: iso(somar(p, -2)), nome: "Sexta-feira Santa", tipo: "nacional" },
    { data: fixo(4, 21), nome: "Tiradentes", tipo: "nacional" },
    { data: fixo(5, 1), nome: "Dia do Trabalho", tipo: "nacional" },
    { data: iso(somar(p, 60)), nome: "Corpus Christi", tipo: "bancario" },
    { data: fixo(9, 7), nome: "Independência do Brasil", tipo: "nacional" },
    { data: fixo(10, 12), nome: "Nossa Senhora Aparecida", tipo: "nacional" },
    { data: fixo(11, 2), nome: "Finados", tipo: "nacional" },
    { data: fixo(11, 15), nome: "Proclamação da República", tipo: "nacional" },
    { data: fixo(11, 20), nome: "Consciência Negra", tipo: "nacional" },
    { data: fixo(12, 25), nome: "Natal", tipo: "nacional" },
  ];

  // Ordena depois de declarar: encadear `.sort` na expressao tiraria a
  // tipagem por contexto e cada `tipo` viraria um `string` solto.
  lista.sort((a, b) => a.data.localeCompare(b.data));
  cache.set(ano, lista);
  return lista;
}

/** Feriados de um mes "YYYY-MM". */
export function feriadosDoMes(mes: string): Feriado[] {
  const ano = Number(mes.slice(0, 4));
  if (!Number.isFinite(ano)) return [];
  return feriadosDoAno(ano).filter((f) => f.data.startsWith(mes));
}

/** Nome do feriado naquela data, se houver. */
export function feriadoEm(data: string): Feriado | null {
  const ano = Number(data.slice(0, 4));
  if (!Number.isFinite(ano)) return null;
  return feriadosDoAno(ano).find((f) => f.data === data) ?? null;
}

/** Domingo (0) ou sabado (6) no fuso de Brasilia. */
export function fimDeSemana(data: string): boolean {
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay();
  return dia === 0 || dia === 6;
}

/** Dia em que o dinheiro anda: nem fim de semana, nem feriado. */
export function diaUtil(data: string): boolean {
  return !fimDeSemana(data) && feriadoEm(data) === null;
}

/**
 * Primeiro dia util a partir da data (inclusive).
 *
 * E o comportamento de boleto: vencimento em sabado, domingo ou feriado
 * empurra a compensacao para o proximo dia util. Cobrar o cliente na data
 * cheia quando o banco esta fechado so gera "paguei mas nao caiu".
 */
export function proximoDiaUtil(data: string): string {
  let atual = data;
  // 10 tentativas cobrem qualquer emenda real (Natal + fim de semana + ano novo).
  for (let i = 0; i < 10 && !diaUtil(atual); i++) {
    const d = new Date(`${atual}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    atual = d.toISOString().slice(0, 10);
  }
  return atual;
}

/** Quantos dias uteis existem entre duas datas, incluindo as pontas. */
export function diasUteisEntre(inicio: string, fim: string): number {
  let total = 0;
  let atual = inicio;
  while (atual <= fim) {
    if (diaUtil(atual)) total++;
    const d = new Date(`${atual}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    atual = d.toISOString().slice(0, 10);
  }
  return total;
}

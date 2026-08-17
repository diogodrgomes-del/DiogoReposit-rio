import { proximoDiaUtil } from "./feriados";
import { hojeISO } from "./presets";

/**
 * Regras de repeticao e de pontualidade — sem banco, sem rede.
 *
 * Ficam separadas do repositorio porque sao a parte que decide dinheiro: em
 * que dia a cobranca vence, se o pagamento entrou em dia, quando o lembrete
 * acende. Isolado assim, da para conferir cada regra lendo uma funcao.
 */

export type Frequencia =
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

/** Quantos meses cada frequencia pula. */
export const PASSO_MESES: Record<Frequencia, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export const ROTULO_FREQUENCIA: Record<Frequencia, string> = {
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const FREQUENCIAS = Object.keys(PASSO_MESES) as Frequencia[];

export function ehFrequencia(v: unknown): v is Frequencia {
  return typeof v === "string" && v in PASSO_MESES;
}

/** "2026-08" -> indice absoluto de mes, para somar e comparar sem Date. */
function indiceMes(competencia: string): number {
  const [a, m] = competencia.split("-").map(Number);
  return a * 12 + (m - 1);
}

function competenciaDe(indice: number): string {
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function somarMeses(competencia: string, meses: number): string {
  return competenciaDe(indiceMes(competencia) + meses);
}

export function ultimoDiaDoMes(competencia: string): number {
  const [a, m] = competencia.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/**
 * Data de vencimento de uma competencia.
 *
 * Dia 31 num mes de 30 vira o ultimo dia — o contrato diz "todo dia 31", e o
 * mes e que nao tem. E, quando o contrato pede, empurra para o proximo dia
 * util: boleto em domingo nao compensa em domingo.
 */
export function vencimentoDe(
  competencia: string,
  diaVencimento: number,
  ajustaDiaUtil = true
): string {
  const dia = Math.min(Math.max(1, diaVencimento), ultimoDiaDoMes(competencia));
  const data = `${competencia}-${String(dia).padStart(2, "0")}`;
  return ajustaDiaUtil ? proximoDiaUtil(data) : data;
}

/**
 * Competencias que uma recorrencia deve ter geradas entre duas pontas.
 *
 * Ancorado no mes de inicio: um contrato trimestral que comecou em fevereiro
 * cobra em fevereiro, maio, agosto — nao no trimestre do calendario.
 */
export function competenciasEntre(
  inicio: string, // YYYY-MM-DD
  fim: string | null, // YYYY-MM-DD ou null (sem fim)
  de: string, // YYYY-MM
  ate: string, // YYYY-MM
  frequencia: Frequencia
): string[] {
  const passo = PASSO_MESES[frequencia];
  const base = indiceMes(inicio.slice(0, 7));
  const limiteFim = fim ? indiceMes(fim.slice(0, 7)) : Infinity;
  const primeiro = Math.max(base, indiceMes(de));
  const ultimo = Math.min(indiceMes(ate), limiteFim);

  const fora: string[] = [];
  // Alinha o primeiro ciclo >= primeiro, mantendo o passo a partir do inicio.
  const ciclos = Math.max(0, Math.ceil((primeiro - base) / passo));
  for (let i = base + ciclos * passo; i <= ultimo; i += passo) {
    fora.push(competenciaDe(i));
  }
  return fora;
}

export function diasEntreDatas(de: string, ate: string): number {
  const a = Date.parse(`${de}T00:00:00Z`);
  const b = Date.parse(`${ate}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export type Pontualidade = "adiantado" | "em_dia" | "atrasado";

export const ROTULO_PONTUALIDADE: Record<Pontualidade, string> = {
  adiantado: "Adiantado",
  em_dia: "Em dia",
  atrasado: "Atrasado",
};

/** Como o pagamento entrou, comparado ao vencimento. */
export function pontualidadeDe(
  vencimento: string,
  pagoEm: string
): { pontualidade: Pontualidade; dias: number } {
  const dias = diasEntreDatas(vencimento, pagoEm);
  if (dias > 0) return { pontualidade: "atrasado", dias };
  if (dias < 0) return { pontualidade: "adiantado", dias: -dias };
  return { pontualidade: "em_dia", dias: 0 };
}

export type Situacao =
  | "pago"
  | "vencido" // passou do vencimento e ninguem pagou
  | "vence_hoje"
  | "a_vencer";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  pago: "Pago",
  vencido: "Vencido",
  vence_hoje: "Vence hoje",
  a_vencer: "A vencer",
};

export function situacaoDe(
  vencimento: string,
  pagoEm: string | null,
  hoje = hojeISO()
): Situacao {
  if (pagoEm) return "pago";
  if (vencimento < hoje) return "vencido";
  if (vencimento === hoje) return "vence_hoje";
  return "a_vencer";
}

/**
 * Hora de cobrar?
 *
 * Acende quando falta `lembreteDias` ou menos para vencer — e continua aceso
 * depois do vencimento, que e justamente quando o cliente precisa ser
 * lembrado. Sai da lista quando o pagamento e marcado.
 */
export function precisaCobrar(
  vencimento: string,
  pagoEm: string | null,
  lembreteDias: number,
  hoje = hojeISO()
): boolean {
  if (pagoEm) return false;
  return diasEntreDatas(hoje, vencimento) <= lembreteDias;
}

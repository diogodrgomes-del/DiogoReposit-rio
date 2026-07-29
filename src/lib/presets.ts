/**
 * Periodos equivalentes aos do Gerenciador de Anuncios.
 *
 * Quando ha `preset`, ele vai para a API como `date_preset` — assim a Meta
 * resolve o intervalo no fuso da conta, que e o comportamento correto. As datas
 * calculadas aqui servem so para rotular a tela.
 */
export type Periodo = {
  id: string;
  rotulo: string;
  preset?: string;
  dias: number | null; // usado para escolher a granularidade da serie
};

export const PERIODOS: Periodo[] = [
  { id: "today", rotulo: "Hoje", preset: "today", dias: 1 },
  { id: "yesterday", rotulo: "Ontem", preset: "yesterday", dias: 1 },
  { id: "last_7d", rotulo: "Últimos 7 dias", preset: "last_7d", dias: 7 },
  { id: "last_14d", rotulo: "Últimos 14 dias", preset: "last_14d", dias: 14 },
  { id: "last_28d", rotulo: "Últimos 28 dias", preset: "last_28d", dias: 28 },
  { id: "last_30d", rotulo: "Últimos 30 dias", preset: "last_30d", dias: 30 },
  { id: "this_month", rotulo: "Este mês", preset: "this_month", dias: 31 },
  { id: "last_month", rotulo: "Mês passado", preset: "last_month", dias: 31 },
  { id: "last_90d", rotulo: "Últimos 90 dias", preset: "last_90d", dias: 90 },
  { id: "this_year", rotulo: "Este ano", preset: "this_year", dias: 365 },
  { id: "maximum", rotulo: "Máximo", preset: "maximum", dias: null },
];

export const PERIODO_PADRAO = "last_30d";

const FUSO = "America/Sao_Paulo";

/** Data de hoje no fuso de Brasilia, como YYYY-MM-DD. */
export function hojeISO(): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Intervalo aproximado do preset, apenas para exibicao. */
export function intervaloAproximado(id: string): { since: string; until: string } | null {
  const hoje = hojeISO();
  const ontem = somarDias(hoje, -1);
  const [ano, mes] = hoje.split("-").map(Number);

  switch (id) {
    case "today":
      return { since: hoje, until: hoje };
    case "yesterday":
      return { since: ontem, until: ontem };
    case "last_7d":
      return { since: somarDias(hoje, -7), until: ontem };
    case "last_14d":
      return { since: somarDias(hoje, -14), until: ontem };
    case "last_28d":
      return { since: somarDias(hoje, -28), until: ontem };
    case "last_30d":
      return { since: somarDias(hoje, -30), until: ontem };
    case "last_90d":
      return { since: somarDias(hoje, -90), until: ontem };
    case "this_month":
      return { since: `${hoje.slice(0, 7)}-01`, until: hoje };
    case "last_month": {
      const anoAnt = mes === 1 ? ano - 1 : ano;
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const p = `${anoAnt}-${String(mesAnt).padStart(2, "0")}`;
      const ultimo = new Date(Date.UTC(anoAnt, mesAnt, 0)).getUTCDate();
      return { since: `${p}-01`, until: `${p}-${ultimo}` };
    }
    case "this_year":
      return { since: `${ano}-01-01`, until: hoje };
    default:
      return null;
  }
}

export function diasEntre(since: string, until: string): number {
  const a = Date.parse(`${since}T00:00:00Z`);
  const b = Date.parse(`${until}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function validarData(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
    ? v
    : null;
}

/**
 * Granularidade da serie temporal: dia para janelas curtas, mes para longas.
 * `time_increment=1` num periodo de dois anos devolveria centenas de pontos.
 */
export function granularidade(dias: number | null): "1" | "monthly" {
  if (dias === null) return "monthly";
  return dias <= 92 ? "1" : "monthly";
}

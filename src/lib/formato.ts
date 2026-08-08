/**
 * Dinheiro e sempre inteiro de centavos. Nunca float: 0.1 + 0.2 !== 0.3 em
 * ponto flutuante binario, e o lugar onde isso aparece e o fechamento do mes.
 */
export function moeda(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Sem o "R$", para tabelas onde a coluna ja diz que e dinheiro. */
export function moedaCurta(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "12.500" vira 1250000 centavos. Aceita o que a pessoa realmente digita. */
export function paraCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return 0;
  // Ultimo separador manda: "1.234,56" -> vírgula decimal; "1,234.56" -> ponto.
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado = limpo;
  if (ultimaVirgula > ultimoPonto) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula) {
    normalizado = limpo.replace(/,/g, "");
  } else {
    normalizado = limpo.replace(/[.,]/g, "");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function numero(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function percentual(n: number, casas = 1): string {
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

const TZ = "America/Sao_Paulo";

export function data(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function dataHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dataCurta(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  });
}

/** "há 3 dias", "em 2 h". Relativo e o que se lê rápido numa lista. */
export function relativo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const alvo = new Date(d).getTime();
  const diff = alvo - Date.now();
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  const min = 60_000, h = 3_600_000, dia = 86_400_000;
  if (abs < min) return "agora";
  if (abs < h) return fmt.format(Math.round(diff / min), "minute");
  if (abs < dia) return fmt.format(Math.round(diff / h), "hour");
  if (abs < 30 * dia) return fmt.format(Math.round(diff / dia), "day");
  if (abs < 365 * dia) return fmt.format(Math.round(diff / (30 * dia)), "month");
  return fmt.format(Math.round(diff / (365 * dia)), "year");
}

/** Dias inteiros de atraso. Negativo = ainda no prazo. */
export function diasDeAtraso(vencimento: Date | string): number {
  const v = new Date(vencimento);
  v.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((hoje.getTime() - v.getTime()) / 86_400_000);
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function apelido(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Telefone brasileiro em E.164, para casar com o que o WhatsApp entrega. */
export function telefoneE164(bruto: string): string | null {
  const d = bruto.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if (d.length > 13) return null;
  return `+${d}`;
}

export function telefoneBonito(e164: string | null | undefined): string {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "");
  const sem55 = d.startsWith("55") ? d.slice(2) : d;
  if (sem55.length === 11)
    return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 7)}-${sem55.slice(7)}`;
  if (sem55.length === 10)
    return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 6)}-${sem55.slice(6)}`;
  return e164;
}

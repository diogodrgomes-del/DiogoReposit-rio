const ptBR = "pt-BR";

export function brl(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `R$ ${v.toLocaleString(ptBR, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}`;
}

export function inteiro(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString(ptBR);
}

export function decimal(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString(ptBR, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function pct(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${decimal(v, casas)}%`;
}

/** "2026-07-29" -> "29/07"; "2026-07" -> "jul/26" */
export function dataCurta(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [a, m] = iso.split("-");
    const meses = ["jan", "fev", "mar", "abr", "mai", "jun",
                   "jul", "ago", "set", "out", "nov", "dez"];
    return `${meses[Number(m) - 1]}/${a.slice(2)}`;
  }
  return iso;
}

export function dataLonga(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const ROTULO_STATUS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CAMPAIGN_PAUSED: "Pausada",
  ADSET_PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
  IN_PROCESS: "Em análise",
  WITH_ISSUES: "Com problema",
  PENDING_REVIEW: "Em revisão",
  DISAPPROVED: "Reprovada",
};

export function statusPt(s: string): string {
  return ROTULO_STATUS[s] ?? s.replace(/_/g, " ").toLowerCase();
}

const ROTULO_OBJETIVO: Record<string, string> = {
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Cadastros",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_APP_PROMOTION: "App",
  LINK_CLICKS: "Tráfego",
  POST_ENGAGEMENT: "Engajamento",
  MESSAGES: "Mensagens",
  CONVERSIONS: "Conversões",
  REACH: "Alcance",
  BRAND_AWARENESS: "Reconhecimento",
  VIDEO_VIEWS: "Vídeo",
  LEAD_GENERATION: "Cadastros",
};

export function objetivoPt(o: string): string {
  return ROTULO_OBJETIVO[o] ?? o.replace(/_/g, " ").toLowerCase();
}

export function tempoRelativo(iso: string): string {
  const seg = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seg < 10) return "agora";
  if (seg < 60) return `há ${seg}s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h`;
}

import { PERIODOS, diasEntre, validarData } from "./presets";

export type JanelaResolvida = {
  preset: string | null;
  since: string | null;
  until: string | null;
  dias: number | null;
};

/**
 * Traduz os parametros de URL num intervalo valido, ou devolve o motivo da
 * recusa. Fica separado das rotas porque /api/insights e /api/carteira precisam
 * exatamente da mesma validacao, e duplicar isso e como as duas telas acabariam
 * discordando sobre o que "este mes" significa.
 */
export function resolverJanela(
  params: URLSearchParams
): { ok: true; janela: JanelaResolvida } | { ok: false; erro: string } {
  const id = params.get("periodo") ?? "last_30d";
  const since = validarData(params.get("since"));
  const until = validarData(params.get("until"));

  if (id === "custom") {
    if (!since || !until) {
      return { ok: false, erro: "Período personalizado exige as duas datas." };
    }
    if (since > until) {
      return { ok: false, erro: "A data inicial não pode ser depois da final." };
    }
    return {
      ok: true,
      janela: { preset: null, since, until, dias: diasEntre(since, until) },
    };
  }

  const p = PERIODOS.find((x) => x.id === id);
  if (!p) return { ok: false, erro: "Período desconhecido." };

  return {
    ok: true,
    janela: { preset: p.preset ?? null, since: null, until: null, dias: p.dias },
  };
}

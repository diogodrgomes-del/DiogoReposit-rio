import { granularidade } from "./presets";

const API = "https://graph.facebook.com/v21.0";

export const ACAO = {
  conversas: "onsite_conversion.messaging_conversation_started_7d",
  conexoes: "onsite_conversion.total_messaging_connection",
  resposta1: "onsite_conversion.messaging_first_reply",
  prof2: "onsite_conversion.messaging_user_depth_2_message_send",
  prof3: "onsite_conversion.messaging_user_depth_3_message_send",
  prof5: "onsite_conversion.messaging_user_depth_5_message_send",
  linkClick: "link_click",
  engajamento: "post_engagement",
} as const;

const CAMPOS_BASE =
  "spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions";

export type Conta = { id: string; nome: string; moeda: string };

export type Metricas = {
  gasto: number;
  impressoes: number;
  alcance: number;
  frequencia: number;
  cliques: number;
  cliquesLink: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversas: number;
  resposta1: number;
  prof2: number;
  prof3: number;
  prof5: number;
  custoConversa: number | null;
};

export type Campanha = Metricas & {
  id: string;
  nome: string;
  objetivo: string;
  status: string;
  conta: string;
  contaId: string;
};

export type PontoSerie = Metricas & { data: string };

export type Painel = {
  /** Percentual de imposto configurado; null quando não há. */
  aliquotaImposto?: number | null;
  orcamentos?: Orcamento[];
  contas: Conta[];
  resumo: Metricas;
  campanhas: Campanha[];
  serie: PontoSerie[];
  granularidade: "1" | "monthly";
  atualizadoEm: string;
};

class ErroMeta extends Error {
  constructor(msg: string, readonly codigo?: number) {
    super(msg);
  }
}

/** Remove o token de qualquer texto antes que ele chegue a um log ou a tela. */
function limpar(texto: string, token: string): string {
  return token ? texto.split(token).join("<TOKEN>") : texto;
}

async function buscar<T>(
  caminho: string,
  token: string,
  params: Record<string, string>
): Promise<T[]> {
  if (!token) throw new ErroMeta("Cliente sem token configurado no servidor.");
  const url = new URL(`${API}/${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);

  const itens: T[] = [];
  let proxima: string | null = url.toString();

  while (proxima) {
    const r: Response = await fetch(proxima, { cache: "no-store" });
    const corpo = await r.json().catch(() => ({}));

    if (corpo?.error) {
      const e = corpo.error;
      throw new ErroMeta(limpar(`Meta: ${e.message ?? "erro desconhecido"}`, token), e.code);
    }
    if (!r.ok) {
      throw new ErroMeta(`Meta respondeu ${r.status}.`);
    }

    itens.push(...((corpo.data ?? []) as T[]));
    // O cursor 'next' ja carrega todos os parametros, o token incluso.
    proxima = corpo.paging?.next ?? null;
  }
  return itens;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type LinhaBruta = Record<string, unknown> & {
  actions?: { action_type: string; value: string }[];
};

function metricas(l: LinhaBruta): Metricas {
  const a = new Map((l.actions ?? []).map((x) => [x.action_type, num(x.value)]));
  const gasto = num(l.spend);
  const conversas = a.get(ACAO.conversas) ?? 0;
  return {
    gasto,
    impressoes: num(l.impressions),
    alcance: num(l.reach),
    frequencia: num(l.frequency),
    cliques: num(l.clicks),
    cliquesLink: num(l.inline_link_clicks),
    ctr: num(l.ctr),
    cpc: num(l.cpc),
    cpm: num(l.cpm),
    conversas,
    resposta1: a.get(ACAO.resposta1) ?? 0,
    prof2: a.get(ACAO.prof2) ?? 0,
    prof3: a.get(ACAO.prof3) ?? 0,
    prof5: a.get(ACAO.prof5) ?? 0,
    custoConversa: conversas > 0 ? gasto / conversas : null,
  };
}

const VAZIO: Metricas = {
  gasto: 0, impressoes: 0, alcance: 0, frequencia: 0, cliques: 0,
  cliquesLink: 0, ctr: 0, cpc: 0, cpm: 0, conversas: 0,
  resposta1: 0, prof2: 0, prof3: 0, prof5: 0, custoConversa: null,
};

/**
 * Soma metricas de varias linhas. Taxas (CTR, CPC, CPM, frequencia) sao
 * recalculadas a partir dos totais — somar taxas produziria numero sem sentido.
 * Alcance nao e somavel de verdade (a mesma pessoa aparece em campanhas
 * diferentes), entao o total e um limite superior; a frequencia derivada dele
 * herda a mesma ressalva.
 */
export function agregar(linhas: Metricas[]): Metricas {
  const t = { ...VAZIO };
  for (const l of linhas) {
    t.gasto += l.gasto;
    t.impressoes += l.impressoes;
    t.alcance += l.alcance;
    t.cliques += l.cliques;
    t.cliquesLink += l.cliquesLink;
    t.conversas += l.conversas;
    t.resposta1 += l.resposta1;
    t.prof2 += l.prof2;
    t.prof3 += l.prof3;
    t.prof5 += l.prof5;
  }
  t.ctr = t.impressoes ? (t.cliques / t.impressoes) * 100 : 0;
  t.cpc = t.cliques ? t.gasto / t.cliques : 0;
  t.cpm = t.impressoes ? (t.gasto / t.impressoes) * 1000 : 0;
  t.frequencia = t.alcance ? t.impressoes / t.alcance : 0;
  t.custoConversa = t.conversas ? t.gasto / t.conversas : null;
  return t;
}

/**
 * A Meta so devolve dias em que houve veiculacao. Sem preencher as lacunas, um
 * intervalo parado desaparece do eixo e o grafico liga 03/07 direto em 22/07
 * como se fossem dias seguidos. Preenche so o miolo — entre o primeiro e o
 * ultimo dia com dados — porque as bordas dependem do fuso da conta, que e a
 * Meta quem resolve.
 */
function preencherLacunas(
  serie: PontoSerie[],
  gran: "1" | "monthly"
): PontoSerie[] {
  if (gran !== "1" || serie.length < 2) return serie;

  const dia = 86_400_000;
  const primeiro = Date.parse(`${serie[0].data}T00:00:00Z`);
  const ultimo = Date.parse(`${serie[serie.length - 1].data}T00:00:00Z`);
  if (Number.isNaN(primeiro) || Number.isNaN(ultimo)) return serie;

  // Um intervalo absurdo so pode vir de data malformada: devolve como veio.
  const total = Math.round((ultimo - primeiro) / dia) + 1;
  if (total < 2 || total > 400) return serie;

  const existente = new Map(serie.map((p) => [p.data, p]));
  const saida: PontoSerie[] = [];
  for (let t = primeiro; t <= ultimo; t += dia) {
    const iso = new Date(t).toISOString().slice(0, 10);
    saida.push(existente.get(iso) ?? { data: iso, ...VAZIO });
  }
  return saida;
}

export async function listarContas(token: string): Promise<Conta[]> {
  const dados = await buscar<{ id: string; name?: string; currency?: string }>(
    "me/adaccounts",
    token,
    { fields: "id,name,currency", limit: "100" }
  );
  return dados.map((c) => ({
    id: c.id,
    nome: c.name ?? c.id,
    moeda: c.currency ?? "BRL",
  }));
}

function janela(
  preset: string | null,
  since: string | null,
  until: string | null
): Record<string, string> {
  return preset
    ? { date_preset: preset }
    : { time_range: JSON.stringify({ since, until }) };
}

export async function carregarPainel(opcoes: {
  token: string;
  contaId: string | null; // null = todas
  preset: string | null;
  since: string | null;
  until: string | null;
  dias: number | null;
}): Promise<Painel> {
  const token = opcoes.token;
  const todas = await listarContas(token);
  const alvo = opcoes.contaId
    ? todas.filter((c) => c.id === opcoes.contaId)
    : todas;

  if (alvo.length === 0) {
    throw new ErroMeta(
      "Nenhuma conta de anúncios acessível por este token. Atribua as contas ao usuário do sistema no Gerenciador de Negócios."
    );
  }

  const gran = granularidade(opcoes.dias);
  const periodo = janela(opcoes.preset, opcoes.since, opcoes.until);

  const porConta = await Promise.all(
    alvo.map(async (conta) => {
      const [linhasCamp, statusCamp, linhasSerie] = await Promise.all([
        buscar<LinhaBruta>(`${conta.id}/insights`, token, {
          ...periodo,
          level: "campaign",
          fields: `campaign_id,campaign_name,objective,${CAMPOS_BASE}`,
          limit: "500",
        }),
        buscar<{ id: string; effective_status?: string }>(`${conta.id}/campaigns`, token, {
          fields: "id,effective_status",
          limit: "500",
        }),
        buscar<LinhaBruta>(`${conta.id}/insights`, token, {
          ...periodo,
          level: "account",
          fields: CAMPOS_BASE,
          time_increment: gran,
          limit: "500",
        }),
      ]);

      const status = new Map(
        statusCamp.map((c) => [c.id, c.effective_status ?? "—"])
      );

      const campanhas: Campanha[] = linhasCamp.map((l) => ({
        id: String(l.campaign_id ?? ""),
        nome: String(l.campaign_name ?? ""),
        objetivo: String(l.objective ?? ""),
        status: status.get(String(l.campaign_id ?? "")) ?? "—",
        conta: conta.nome,
        contaId: conta.id,
        ...metricas(l),
      }));

      const serie = linhasSerie.map((l) => ({
        data: String(l.date_start ?? ""),
        ...metricas(l),
      }));

      return { campanhas, serie };
    })
  );

  const campanhas = porConta
    .flatMap((c) => c.campanhas)
    .sort((a, b) => b.gasto - a.gasto);

  // Une as series das contas somando por data.
  const porData = new Map<string, Metricas[]>();
  for (const { serie } of porConta) {
    for (const p of serie) {
      const lista = porData.get(p.data) ?? [];
      lista.push(p);
      porData.set(p.data, lista);
    }
  }
  const serie: PontoSerie[] = preencherLacunas(
    [...porData.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, linhas]) => ({ data, ...agregar(linhas) })),
    gran
  );

  const orcamentos = await Promise.all(
    alvo.map((c) => carregarOrcamento(token, c).catch(() => null))
  );

  return {
    contas: todas,
    orcamentos: orcamentos.filter((o): o is Orcamento => o !== null),
    resumo: agregar(campanhas),
    campanhas,
    serie,
    granularidade: gran,
    atualizadoEm: new Date().toISOString(),
  };
}

export { ErroMeta };

// ===================== visao consolidada da carteira =====================

export type ResumoCliente = Metricas & {
  aliquotaImposto?: number | null;
  clienteId: string;
  cliente: string;
  contas: number;
  /** Preenchido quando este cliente falhou sozinho, sem derrubar os demais. */
  erro?: string;
};

/**
 * Roda tarefas com um teto de paralelismo. Oito clientes disparando todas as
 * chamadas de uma vez encosta no limite de requisicoes da Meta e derruba o
 * carregamento inteiro; em blocos, o custo e alguns segundos a mais.
 */
async function comLimite<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<R>
): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  const operarios = Array.from(
    { length: Math.min(limite, itens.length) },
    async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        saida[i] = await tarefa(itens[i]);
      }
    }
  );
  await Promise.all(operarios);
  return saida;
}

/**
 * Totais de cada cliente no periodo, para a tela de carteira.
 *
 * Um cliente que falha nao derruba os outros: o erro fica no proprio registro e
 * a tela mostra a linha marcada. Perder a carteira toda porque um token expirou
 * seria pior do que ver sete linhas boas e uma com problema.
 */
export async function carregarCarteira(
  clientes: { id: string; nome: string; token: string }[],
  opcoes: {
    preset: string | null;
    since: string | null;
    until: string | null;
  }
): Promise<{ clientes: ResumoCliente[]; atualizadoEm: string }> {
  const periodo = janela(opcoes.preset, opcoes.since, opcoes.until);

  const resultados = await comLimite(clientes, 3, async (c) => {
    const base = { clienteId: c.id, cliente: c.nome };
    try {
      const contas = await listarContas(c.token);
      if (contas.length === 0) {
        return {
          ...base, ...VAZIO, contas: 0,
          erro: "Nenhuma conta atribuída ao usuário do sistema.",
        } as ResumoCliente;
      }

      // Nivel de campanha, e nao de conta, de proposito.
      //
      // Numa janela longa com muito volume, a Meta corta tipos de acao do
      // agregado de conta: uma conta com 5.428 conversas no historico devolve
      // um `actions` sem nenhuma entrada de messaging, e o painel mostraria
      // zero conversas e "sem retorno" para o maior cliente da carteira. O
      // mesmo pedido no nivel de campanha devolve os 5.428.
      //
      // Custa algumas linhas a mais por conta e mantem a carteira concordando
      // com a tela de cliente, que ja somava por campanha.
      const porConta = await comLimite(contas, 3, (conta) =>
        buscar<LinhaBruta>(`${conta.id}/insights`, c.token, {
          ...periodo,
          level: "campaign",
          fields: CAMPOS_BASE,
          limit: "500",
        })
      );

      return {
        ...base,
        ...agregar(porConta.flat().map(metricas)),
        contas: contas.length,
      } as ResumoCliente;
    } catch (e) {
      return {
        ...base, ...VAZIO, contas: 0,
        erro: (e as Error).message,
      } as ResumoCliente;
    }
  });

  return { clientes: resultados, atualizadoEm: new Date().toISOString() };
}

// ===================== detalhamento por nivel =====================

export type Nivel = "adset" | "ad";

export type NoDetalhe = Metricas & {
  id: string;
  nome: string;
  status: string;
};

/**
 * Filhos de uma campanha (conjuntos) ou de um conjunto (anuncios).
 *
 * A busca e feita no proprio no pai — `/{campanha}/insights?level=adset` —
 * em vez de puxar a conta inteira e filtrar. Assim cada expansao custa uma
 * chamada pequena, e o painel nao precisa carregar todos os anuncios da conta
 * so porque o usuario abriu uma campanha.
 */
export async function carregarFilhos(opcoes: {
  token: string;
  paiId: string;
  nivel: Nivel;
  preset: string | null;
  since: string | null;
  until: string | null;
}): Promise<NoDetalhe[]> {
  const { token, paiId, nivel } = opcoes;
  const periodo = janela(opcoes.preset, opcoes.since, opcoes.until);

  const idCampo = nivel === "adset" ? "adset_id" : "ad_id";
  const nomeCampo = nivel === "adset" ? "adset_name" : "ad_name";

  const [linhas, estados] = await Promise.all([
    buscar<LinhaBruta>(`${paiId}/insights`, token, {
      ...periodo,
      level: nivel,
      fields: `${idCampo},${nomeCampo},${CAMPOS_BASE}`,
      limit: "500",
    }),
    // O endpoint de insights nao devolve status; vem do edge correspondente.
    buscar<{ id: string; effective_status?: string }>(
      `${paiId}/${nivel === "adset" ? "adsets" : "ads"}`,
      token,
      { fields: "id,effective_status", limit: "500" }
    ).catch(() => [] as { id: string; effective_status?: string }[]),
  ]);

  const status = new Map(estados.map((e) => [e.id, e.effective_status ?? "—"]));

  return linhas
    .map((l) => {
      const id = String(l[idCampo] ?? "");
      return {
        id,
        nome: String(l[nomeCampo] ?? ""),
        status: status.get(id) ?? "—",
        ...metricas(l),
      };
    })
    .sort((a, b) => b.gasto - a.gasto);
}

// ===================== orcamento e aportes =====================

export type Aporte = { data: string; valor: number };

export type Orcamento = {
  contaId: string;
  conta: string;
  /** Total ja gasto na conta, desde sempre. */
  gastoAcumulado: number;
  /** Teto de gasto. Em conta pre-paga equivale ao total aportado. */
  teto: number | null;
  /** Quanto ainda ha para gastar. */
  disponivel: number | null;
  ultimoAporte: Aporte | null;
  aportes: Aporte[];
};

/**
 * Orcamento da conta e historico de aportes.
 *
 * Os aportes saem do log de atividades, no evento `funding_event_successful` —
 * cada PIX que entra na conta gera um. O disponivel vem de spend_cap menos
 * amount_spent: em conta pre-paga o teto acompanha o total aportado, entao a
 * diferenca e o que sobra para gastar.
 *
 * Contas sem teto definido devolvem `disponivel: null`, e nao zero: nao saber
 * quanto resta e diferente de nao restar nada.
 */
export async function carregarOrcamento(
  token: string,
  conta: Conta
): Promise<Orcamento> {
  const centavos = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n / 100 : null;
  };

  const [detalhe, atividades] = await Promise.all([
    fetch(
      `${API}/${conta.id}?fields=amount_spent,spend_cap&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .catch(() => ({})),
    buscar<{ event_type?: string; event_time?: string; extra_data?: string }>(
      `${conta.id}/activities`,
      token,
      { fields: "event_type,event_time,extra_data", limit: "500" }
    ).catch(() => []),
  ]);

  const gasto = centavos(detalhe?.amount_spent) ?? 0;
  const tetoBruto = centavos(detalhe?.spend_cap);
  // spend_cap zero significa "sem teto", e nao teto de zero.
  const teto = tetoBruto && tetoBruto > 0 ? tetoBruto : null;

  const aportes: Aporte[] = [];
  for (const a of atividades) {
    if (a.event_type !== "funding_event_successful") continue;
    let extra: { amount?: number } = {};
    try {
      extra =
        typeof a.extra_data === "string" ? JSON.parse(a.extra_data) : (a.extra_data ?? {});
    } catch {
      continue;
    }
    const valor = centavos(extra.amount);
    if (valor === null || !a.event_time) continue;
    aportes.push({ data: a.event_time.slice(0, 10), valor });
  }
  aportes.sort((a, b) => b.data.localeCompare(a.data));

  return {
    contaId: conta.id,
    conta: conta.nome,
    gastoAcumulado: gasto,
    teto,
    disponivel: teto === null ? null : Math.max(teto - gasto, 0),
    ultimoAporte: aportes[0] ?? null,
    aportes: aportes.slice(0, 12),
  };
}

// ===================== linha do tempo de alteracoes =====================

export type Alteracao = {
  quando: string;
  tipo: string;
  /** Frase pronta para a tela. */
  descricao: string;
  alvo: string | null;
  autor: string | null;
  /** Importancia: 1 muda entrega, 2 muda conteudo, 3 rotina. */
  peso: 1 | 2 | 3;
};

/**
 * Traducao dos eventos do log da Meta.
 *
 * Nem todo evento vira linha: `first_delivery_event` e
 * `ad_account_billing_charge` acontecem sozinhos, varias vezes por dia, e
 * afogariam as alteracoes que alguem de fato fez. Ficam de fora de proposito —
 * o aporte, que interessa, ja aparece no bloco de orcamento.
 */
const EVENTOS: Record<string, { rotulo: string; peso: 1 | 2 | 3 }> = {
  update_ad_run_status: { rotulo: "Anúncio pausado ou reativado", peso: 1 },
  update_ad_set_run_status: { rotulo: "Conjunto pausado ou reativado", peso: 1 },
  update_campaign_run_status: { rotulo: "Campanha pausada ou reativada", peso: 1 },
  update_ad_set_budget: { rotulo: "Orçamento do conjunto alterado", peso: 1 },
  update_campaign_budget: { rotulo: "Orçamento da campanha alterado", peso: 1 },
  update_ad_set_bid_strategy: { rotulo: "Estratégia de lance alterada", peso: 1 },
  update_ad_set_optimization_goal: { rotulo: "Objetivo de otimização alterado", peso: 1 },
  update_ad_set_target_spec: { rotulo: "Público do conjunto alterado", peso: 1 },
  update_ad_targets_spec: { rotulo: "Público do anúncio alterado", peso: 1 },
  update_ad_set_duration: { rotulo: "Período de veiculação alterado", peso: 1 },

  update_ad_creative: { rotulo: "Criativo trocado", peso: 2 },
  create_ad: { rotulo: "Anúncio criado", peso: 2 },
  create_ad_set: { rotulo: "Conjunto criado", peso: 2 },
  create_campaign_group: { rotulo: "Campanha criada", peso: 2 },
  create_audience: { rotulo: "Público criado", peso: 2 },
  add_images: { rotulo: "Imagens adicionadas", peso: 2 },
  edit_images: { rotulo: "Imagens editadas", peso: 2 },

  update_ad_friendly_name: { rotulo: "Anúncio renomeado", peso: 3 },
  update_ad_set_name: { rotulo: "Conjunto renomeado", peso: 3 },
  update_campaign_name: { rotulo: "Campanha renomeada", peso: 3 },
  ad_account_add_user_to_role: { rotulo: "Usuário adicionado à conta", peso: 3 },
  ad_account_remove_user_from_role: { rotulo: "Usuário removido da conta", peso: 3 },
  funding_event_successful: { rotulo: "Aporte recebido", peso: 1 },
};

type LinhaAtividade = {
  event_type?: string;
  event_time?: string;
  object_name?: string;
  actor_name?: string;
  extra_data?: string;
};

export async function carregarAlteracoes(
  token: string,
  contas: Conta[],
  desde: string | null
): Promise<Alteracao[]> {
  const porConta = await Promise.all(
    contas.map((c) =>
      buscar<LinhaAtividade>(`${c.id}/activities`, token, {
        fields: "event_type,event_time,object_name,actor_name,extra_data",
        limit: "300",
        ...(desde ? { since: desde } : {}),
      }).catch(() => [] as LinhaAtividade[])
    )
  );

  const saida: Alteracao[] = [];
  for (const linhas of porConta) {
    for (const l of linhas) {
      const tipo = l.event_type ?? "";
      const def = EVENTOS[tipo];
      if (!def || !l.event_time) continue;

      let descricao = def.rotulo;
      if (tipo === "funding_event_successful") {
        try {
          const e =
            typeof l.extra_data === "string"
              ? JSON.parse(l.extra_data)
              : (l.extra_data ?? {});
          const v = Number(e?.amount);
          if (Number.isFinite(v)) {
            descricao = `Aporte recebido de R$ ${(v / 100).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          }
        } catch {
          /* mantém o rótulo genérico */
        }
      }

      saida.push({
        quando: l.event_time,
        tipo,
        descricao,
        alvo: l.object_name || null,
        autor: l.actor_name || null,
        peso: def.peso,
      });
    }
  }

  return saida.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 300);
}

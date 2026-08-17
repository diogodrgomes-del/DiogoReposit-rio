"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Cliente } from "@/lib/clientes";
import type { Painel as DadosPainel, ResumoCliente } from "@/lib/meta";
import {
  PERIODOS,
  PERIODO_PADRAO,
  hojeISO,
  intervaloAproximado,
  somarDias,
} from "@/lib/presets";
import {
  brl,
  dataLonga,
  decimal,
  inteiro,
  pct,
  tempoRelativo,
} from "@/lib/format";
import {
  GraficoConversas,
  GraficoCustoConversa,
  GraficoInvestimento,
} from "./Graficos";
import TabelaCampanhas from "./TabelaCampanhas";
import Calendario from "./Calendario";
import Diagnostico from "./Diagnostico";
import Imposto from "./Imposto";
import Orcamento from "./Orcamento";
import Registro from "./Registro";
import Carteira from "./Carteira";

const INTERVALO_MS = 60_000;

type Visao = "carteira" | "cliente";

export default function Painel() {
  const router = useRouter();

  const [visao, setVisao] = useState<Visao>("carteira");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<string>("");

  const [periodo, setPeriodo] = useState(PERIODO_PADRAO);
  const [since, setSince] = useState(somarDias(hojeISO(), -7));
  const [until, setUntil] = useState(hojeISO());
  const [conta, setConta] = useState("todas");
  const [auto, setAuto] = useState(true);
  const [calAberto, setCalAberto] = useState(false);

  const [dados, setDados] = useState<DadosPainel | null>(null);
  const [carteira, setCarteira] = useState<ResumoCliente[] | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tick, setTick] = useState(0); // só recalcula o "há X min"

  // Descarta respostas fora de ordem quando o filtro muda rápido.
  const emVoo = useRef<AbortController | null>(null);

  // --- carteira de clientes (uma vez) ---
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/clientes", { cache: "no-store" });
        if (r.status === 401) {
          router.replace("/login");
          return;
        }
        const corpo = await r.json();
        if (!vivo) return;
        const lista: Cliente[] = corpo.clientes ?? [];
        setClientes(lista);
        if (lista.length > 0) setCliente((c) => c || lista[0].id);
        // Com um cliente só, a tela de carteira não acrescenta nada.
        if (lista.length <= 1) setVisao("cliente");
      } catch {
        /* o erro aparece no carregamento dos dados */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  const parametros = useCallback(() => {
    const q = new URLSearchParams({ periodo });
    if (periodo === "custom") {
      q.set("since", since);
      q.set("until", until);
    }
    return q;
  }, [periodo, since, until]);

  const buscar = useCallback(async () => {
    if (visao === "cliente" && !cliente) return;

    emVoo.current?.abort();
    const ctrl = new AbortController();
    emVoo.current = ctrl;
    setCarregando(true);

    const q = parametros();
    let url: string;
    if (visao === "carteira") {
      url = `/api/carteira?${q}`;
    } else {
      q.set("cliente", cliente);
      q.set("conta", conta);
      url = `/api/insights?${q}`;
    }

    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (r.status === 401) {
        router.replace("/login");
        return;
      }
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(corpo?.erro ?? "Não foi possível carregar os dados.");
      } else if (visao === "carteira") {
        setCarteira(corpo.clientes ?? []);
        setAtualizadoEm(corpo.atualizadoEm ?? null);
        setErro(null);
      } else {
        setDados(corpo as DadosPainel);
        setAtualizadoEm(corpo.atualizadoEm ?? null);
        setErro(null);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setErro("Falha de conexão com o servidor.");
      }
    } finally {
      if (!ctrl.signal.aborted) setCarregando(false);
    }
  }, [visao, cliente, conta, parametros, router]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => void buscar(), INTERVALO_MS);
    return () => clearInterval(id);
  }, [auto, buscar]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // Trocar de cliente precisa zerar o filtro de conta: os ids não se repetem
  // entre clientes, e manter o antigo devolveria uma tela vazia.
  function trocarCliente(id: string) {
    setCliente(id);
    setConta("todas");
    setDados(null);
  }

  function abrirCliente(id: string) {
    trocarCliente(id);
    setVisao("cliente");
  }

  const intervalo = useMemo(
    () =>
      periodo === "custom" ? { since, until } : intervaloAproximado(periodo),
    [periodo, since, until]
  );

  const rotuloPeriodo = useMemo(
    () =>
      periodo === "custom"
        ? `${dataLonga(since)} a ${dataLonga(until)}`
        : (PERIODOS.find((p) => p.id === periodo)?.rotulo ?? periodo),
    [periodo, since, until]
  );

  const nomeCliente =
    clientes.find((c) => c.id === cliente)?.nome ?? "—";

  const r = dados?.resumo;

  /**
   * Profundidade das conversas — deliberadamente NÃO é um funil.
   *
   * "Conversa iniciada" vem de messaging_conversation_started_7d, com janela de
   * atribuição de 7 dias. As métricas de profundidade não têm janela: contam
   * eventos ocorridos no período, mesmo de conversas iniciadas antes dele. Como
   * as bases de contagem diferem, uma etapa pode superar a anterior, e tratá-las
   * como etapas encaixadas produziria percentuais acima de 100%.
   */
  const profundidade = useMemo(() => {
    if (!r) return [];
    return [
      { rot: "Conversa iniciada", v: r.conversas },
      { rot: "1ª resposta", v: r.resposta1 },
      { rot: "2ª mensagem", v: r.prof2 },
      { rot: "3ª mensagem", v: r.prof3 },
      { rot: "5ª mensagem", v: r.prof5 },
    ];
  }, [r]);

  const maxProfundidade = useMemo(
    () => Math.max(1, ...profundidade.map((f) => f.v)),
    [profundidade]
  );

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function alternarTema() {
    const raiz = document.documentElement;
    const atual =
      raiz.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    raiz.dataset.theme = atual === "dark" ? "light" : "dark";
  }

  const titulo = visao === "carteira" ? "Carteira de clientes" : nomeCliente;

  return (
    <div className="app">
      <header className="topo nao-imprime">
        <div className="topo-linha">
          <div className="marca">
            Marktiva <span>Meta Ads</span>
          </div>

          {clientes.length > 1 && (
            <div className="abas" role="tablist">
              <button
                className="aba"
                role="tab"
                aria-selected={visao === "carteira"}
                onClick={() => setVisao("carteira")}
              >
                Carteira
              </button>
              <button
                className="aba"
                role="tab"
                aria-selected={visao === "cliente"}
                onClick={() => setVisao("cliente")}
              >
                Cliente
              </button>
            </div>
          )}

          <Link className="btn" href="/financeiro">
            Financeiro
          </Link>
          <button className="btn btn-icone" onClick={alternarTema} title="Alternar tema">
            ◐
          </button>
          <button className="btn" onClick={() => window.print()}>
            Gerar PDF
          </button>
          <button className="btn" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <div className="controles nao-imprime">
        {visao === "cliente" && (
          <>
            <select
              value={cliente}
              onChange={(e) => trocarCliente(e.target.value)}
              aria-label="Cliente"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <select
              value={conta}
              onChange={(e) => setConta(e.target.value)}
              aria-label="Conta de anúncios"
            >
              <option value="todas">Todas as contas</option>
              {dados?.contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </>
        )}

        <select
          value={periodo}
          onChange={(e) => {
            setPeriodo(e.target.value);
            setCalAberto(e.target.value === "custom");
          }}
          aria-label="Período"
        >
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
          <option value="custom">Personalizado…</option>
        </select>

        {periodo === "custom" && (
          <div className="cal-ancora">
            <button
              className="btn"
              onClick={() => setCalAberto((v) => !v)}
              aria-expanded={calAberto}
            >
              {dataLonga(since)} — {dataLonga(until)}
            </button>
            {calAberto && (
              <Calendario
                since={since}
                until={until}
                onChange={(a, b) => {
                  setSince(a);
                  setUntil(b);
                }}
                onFechar={() => setCalAberto(false)}
              />
            )}
          </div>
        )}

        <button className="btn" onClick={() => void buscar()} disabled={carregando}>
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>

        <label
          className="btn"
          style={{ cursor: "pointer", gap: 8 }}
          title="Atualiza sozinho a cada 60 segundos"
        >
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            style={{ margin: 0, width: 15, height: 15 }}
          />
          Tempo real
        </label>
      </div>

      {/* cabeçalho que só aparece no PDF */}
      <div className="so-impressao cabecalho-pdf">
        <h1>Marktiva — {titulo}</h1>
        <div className="meta">
          <span>{rotuloPeriodo}</span>
          {intervalo && (
            <span>
              {dataLonga(intervalo.since)} – {dataLonga(intervalo.until)}
            </span>
          )}
          <span>
            Emitido em{" "}
            {new Date().toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>

      <div className="status-linha nao-imprime" data-tick={tick}>
        <span className={`ponto ${carregando ? "carregando" : ""}`} />
        {carregando
          ? "buscando dados na Meta…"
          : atualizadoEm
            ? `atualizado ${tempoRelativo(atualizadoEm)}`
            : "—"}
        {intervalo && (
          <span>
            · {dataLonga(intervalo.since)} a {dataLonga(intervalo.until)}
          </span>
        )}
        {visao === "cliente" && dados && (
          <span>· {dados.campanhas.length} campanhas</span>
        )}
        {visao === "carteira" && carteira && (
          <span>· {carteira.length} clientes</span>
        )}
      </div>

      {erro && (
        <div className="aviso erro" role="alert">
          <h3>Não foi possível carregar</h3>
          <p>{erro}</p>
        </div>
      )}

      {!erro && ((visao === "carteira" && !carteira) || (visao === "cliente" && !dados)) && (
        <div className="tiles">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="tile" key={i}>
              <span className="rot">carregando</span>
              <div className="esqueleto" style={{ height: 30, marginTop: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* ---------------- visão de carteira ---------------- */}
      {visao === "carteira" && carteira && (
        <Carteira clientes={carteira} aoAbrir={abrirCliente} />
      )}

      {/* ---------------- visão de um cliente ---------------- */}
      {visao === "cliente" && r && (
        <>
          <div className="tiles">
            <div className="tile">
              <span className="rot">Investimento</span>
              <div className="val">{brl(r.gasto)}</div>
              <div className="obs">CPM de {brl(r.cpm)}</div>
            </div>
            <div className="tile destaque">
              <span className="rot">Conversas iniciadas</span>
              <div className="val">{inteiro(r.conversas)}</div>
              <div className="obs">
                {r.cliquesLink
                  ? `${pct((r.conversas / r.cliquesLink) * 100)} dos cliques no link`
                  : "sem cliques no link"}
              </div>
            </div>
            <div className="tile destaque">
              <span className="rot">Custo por conversa</span>
              <div className="val">{brl(r.custoConversa)}</div>
              <div className="obs">
                {r.conversas ? `${inteiro(r.conversas)} conversas` : "sem conversas"}
              </div>
            </div>
            <div className="tile">
              <span className="rot">Alcance</span>
              <div className="val">{inteiro(r.alcance)}</div>
              <div className="obs">frequência de {decimal(r.frequencia)}</div>
            </div>
            <div className="tile">
              <span className="rot">Cliques</span>
              <div className="val">{inteiro(r.cliques)}</div>
              <div className="obs">
                CTR de {pct(r.ctr)} · CPC de {brl(r.cpc)}
              </div>
            </div>
          </div>

          <Orcamento
            orcamentos={dados?.orcamentos ?? []}
            gastoDiario={
              dados && dados.serie.length > 0
                ? r.gasto / dados.serie.length
                : null
            }
          />

          <Imposto
            gastoLiquido={r.gasto}
            aliquota={dados?.aliquotaImposto ?? null}
          />

          <div className="grade">
            <div className="painel">
              <h2>Conversas iniciadas</h2>
              <p className="desc">
                Volume de conversas por{" "}
                {dados?.granularidade === "1" ? "dia" : "mês"} no período.
              </p>
              <GraficoConversas serie={dados!.serie} />
            </div>

            <div className="painel">
              <h2>Custo por conversa</h2>
              <p className="desc">
                Em laranja, os períodos acima da média de {brl(r.custoConversa)}.
              </p>
              <GraficoCustoConversa serie={dados!.serie} media={r.custoConversa} />
            </div>

            <div className="painel">
              <h2>Investimento</h2>
              <p className="desc">Verba aplicada em cada período.</p>
              <GraficoInvestimento serie={dados!.serie} />
            </div>

            <div className="painel">
              <h2>Profundidade das conversas</h2>
              <p className="desc">
                Até onde as conversas avançaram — o indicador de qualidade do lead.
              </p>
              {profundidade.every((f) => f.v === 0) ? (
                <div className="vazio" style={{ padding: "48px 12px", fontSize: 14 }}>
                  Nenhuma conversa iniciada neste período.
                </div>
              ) : (
                <>
                  <div className="funil">
                    {profundidade.map((f) => (
                      <div className="funil-linha" key={f.rot}>
                        <span className="funil-rot">{f.rot}</span>
                        <div className="funil-trilho">
                          <div
                            className="funil-barra"
                            style={{ width: `${(f.v / maxProfundidade) * 100}%` }}
                          />
                        </div>
                        <span className="funil-val">{inteiro(f.v)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="nota-metrica">
                    Não é um funil: &ldquo;conversa iniciada&rdquo; usa janela de
                    atribuição de 7 dias e as demais não, então contam bases
                    diferentes e uma etapa pode superar a anterior.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="quebra-pagina">
            <div className="painel" style={{ padding: 0, border: 0, boxShadow: "none" }}>
              <h2 style={{ marginBottom: 3 }}>Campanhas</h2>
              <p className="desc">
                Clique na seta para abrir os conjuntos, e neles para ver os
                anúncios. Ordene por qualquer coluna no cabeçalho.
              </p>
            </div>
            <TabelaCampanhas
              campanhas={dados!.campanhas}
              clienteId={cliente}
              periodoQuery={parametros().toString()}
            />
            <Diagnostico campanhas={dados!.campanhas} />
          </div>

          <Registro clienteId={cliente} nomeCliente={nomeCliente} />
        </>
      )}
    </div>
  );
}

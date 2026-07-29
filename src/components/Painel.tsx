"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Painel as DadosPainel } from "@/lib/meta";
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

const INTERVALO_MS = 60_000;

export default function Painel() {
  const router = useRouter();

  const [periodo, setPeriodo] = useState(PERIODO_PADRAO);
  const [since, setSince] = useState(somarDias(hojeISO(), -7));
  const [until, setUntil] = useState(hojeISO());
  const [conta, setConta] = useState("todas");
  const [auto, setAuto] = useState(true);

  const [dados, setDados] = useState<DadosPainel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tick, setTick] = useState(0); // só para recalcular "há X min"

  // Guarda a requisição em voo para descartar respostas fora de ordem.
  const emVoo = useRef<AbortController | null>(null);

  const buscar = useCallback(async () => {
    emVoo.current?.abort();
    const ctrl = new AbortController();
    emVoo.current = ctrl;

    setCarregando(true);
    const q = new URLSearchParams({ periodo, conta });
    if (periodo === "custom") {
      q.set("since", since);
      q.set("until", until);
    }

    try {
      const r = await fetch(`/api/insights?${q}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });

      if (r.status === 401) {
        router.replace("/login");
        return;
      }

      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(corpo?.erro ?? "Não foi possível carregar os dados.");
      } else {
        setDados(corpo as DadosPainel);
        setErro(null);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setErro("Falha de conexão com o servidor.");
      }
    } finally {
      if (!ctrl.signal.aborted) setCarregando(false);
    }
  }, [periodo, conta, since, until, router]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => void buscar(), INTERVALO_MS);
    return () => clearInterval(id);
  }, [auto, buscar]);

  // Mantém o "atualizado há X" correndo sem refazer a requisição.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const intervalo = useMemo(() => {
    if (periodo === "custom") return { since, until };
    return intervaloAproximado(periodo);
  }, [periodo, since, until]);

  const rotuloPeriodo = useMemo(() => {
    if (periodo === "custom") {
      return `${dataLonga(since)} a ${dataLonga(until)}`;
    }
    return PERIODOS.find((p) => p.id === periodo)?.rotulo ?? periodo;
  }, [periodo, since, until]);

  const r = dados?.resumo;

  /**
   * Profundidade das conversas — deliberadamente NÃO é um funil.
   *
   * "Conversa iniciada" vem de messaging_conversation_started_7d, com janela de
   * atribuição de 7 dias. As métricas de profundidade não têm janela: contam
   * eventos ocorridos no período, mesmo de conversas iniciadas antes dele. Como
   * as bases de contagem são diferentes, uma etapa pode superar a anterior, e
   * tratá-las como etapas encaixadas produziria percentuais acima de 100%.
   * Por isso as barras são escaladas pelo maior valor, não pelo topo.
   */
  const profundidade = useMemo(() => {
    if (!r) return [];
    return [
      { rot: "Conversa iniciada", v: r.conversas, base: true },
      { rot: "1ª resposta", v: r.resposta1, base: false },
      { rot: "2ª mensagem", v: r.prof2, base: false },
      { rot: "3ª mensagem", v: r.prof3, base: false },
      { rot: "5ª mensagem", v: r.prof5, base: false },
    ];
  }, [r]);

  const maxProfundidade = useMemo(
    () => Math.max(1, ...profundidade.map((f) => f.v)),
    [profundidade]
  );

  const nomeConta =
    conta === "todas"
      ? "Todas as contas"
      : (dados?.contas.find((c) => c.id === conta)?.nome ?? conta);

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

  return (
    <div className="app">
      {/* ---------------- barra superior ---------------- */}
      <header className="topo nao-imprime">
        <div className="topo-linha">
          <div className="marca">
            Marktiva <span>Meta Ads</span>
          </div>

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

      {/* ---------------- filtros ---------------- */}
      <div className="controles nao-imprime">
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

        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
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
          <div className="chip-datas">
            <label htmlFor="d1">de</label>
            <input
              id="d1"
              type="date"
              value={since}
              max={until}
              onChange={(e) => setSince(e.target.value)}
            />
            <label htmlFor="d2">até</label>
            <input
              id="d2"
              type="date"
              value={until}
              min={since}
              max={hojeISO()}
              onChange={(e) => setUntil(e.target.value)}
            />
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

      {/* ---------------- cabeçalho do PDF ---------------- */}
      <div className="so-impressao cabecalho-pdf">
        <h1>Marktiva — Relatório de Campanhas</h1>
        <div className="meta">
          <span>{nomeConta}</span>
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

      {/* ---------------- estado ---------------- */}
      <div className="status-linha nao-imprime" data-tick={tick}>
        <span className={`ponto ${carregando ? "carregando" : ""}`} />
        {carregando
          ? "buscando dados na Meta…"
          : dados
            ? `atualizado ${tempoRelativo(dados.atualizadoEm)}`
            : "—"}
        {intervalo && (
          <span>
            · {dataLonga(intervalo.since)} a {dataLonga(intervalo.until)}
          </span>
        )}
        {dados && <span>· {dados.campanhas.length} campanhas</span>}
      </div>

      {erro && (
        <div className="aviso erro" role="alert">
          <h3>Não foi possível carregar</h3>
          <p>{erro}</p>
        </div>
      )}

      {!dados && !erro && (
        <div className="tiles">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="tile" key={i}>
              <span className="rot">carregando</span>
              <div className="esqueleto" style={{ height: 30, marginTop: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* ---------------- indicadores ---------------- */}
      {r && (
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

          {/* ---------------- gráficos ---------------- */}
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
              <GraficoCustoConversa
                serie={dados!.serie}
                media={r.custoConversa}
              />
            </div>

            <div className="painel">
              <h2>Investimento</h2>
              <p className="desc">Verba aplicada em cada período.</p>
              <GraficoInvestimento serie={dados!.serie} />
            </div>

            <div className="painel">
              <h2>Profundidade das conversas</h2>
              <p className="desc">
                Até onde as conversas avançaram — o indicador de qualidade do
                lead.
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

          {/* ---------------- tabela ---------------- */}
          <div className="quebra-pagina">
            <div className="painel" style={{ padding: 0, border: 0, boxShadow: "none" }}>
              <h2 style={{ marginBottom: 3 }}>Campanhas</h2>
              <p className="desc">
                Clique num cabeçalho para reordenar. Em verde o melhor custo por
                conversa, em vermelho o pior e as que não converteram.
              </p>
            </div>
            <TabelaCampanhas campanhas={dados!.campanhas} />
          </div>
        </>
      )}
    </div>
  );
}

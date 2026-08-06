"use client";

import { useCallback, useMemo, useState } from "react";
import type { Campanha, Metricas, NoDetalhe } from "@mark/integracoes/meta-ads";
import {
  brl,
  decimal,
  inteiro,
  objetivoPt,
  pct,
  statusPt,
} from "@/lib/format";

type Props = {
  campanhas: Campanha[];
  clienteId: string;
  /** Query string do período em vigor, para os filhos virem da mesma janela. */
  periodoQuery: string;
};

type Coluna = {
  id: string;
  rot: string;
  valor: (m: Metricas) => string;
  menorMelhor?: boolean;
};

const COLUNAS: Coluna[] = [
  { id: "gasto", rot: "Investido", valor: (m) => brl(m.gasto) },
  { id: "conversas", rot: "Conversas", valor: (m) => inteiro(m.conversas) },
  {
    id: "custoConversa",
    rot: "R$/conversa",
    valor: (m) => (m.conversas ? brl(m.custoConversa) : "sem retorno"),
    menorMelhor: true,
  },
  { id: "alcance", rot: "Alcance", valor: (m) => inteiro(m.alcance) },
  { id: "frequencia", rot: "Freq.", valor: (m) => decimal(m.frequencia) },
  { id: "impressoes", rot: "Impressões", valor: (m) => inteiro(m.impressoes) },
  { id: "cliques", rot: "Cliques", valor: (m) => inteiro(m.cliques) },
  { id: "ctr", rot: "CTR", valor: (m) => pct(m.ctr) },
  { id: "cpc", rot: "CPC", valor: (m) => brl(m.cpc), menorMelhor: true },
  { id: "cpm", rot: "CPM", valor: (m) => brl(m.cpm), menorMelhor: true },
];

function classeStatus(s: string): string {
  if (s === "ACTIVE") return "ativa";
  if (s === "DISAPPROVED" || s === "WITH_ISSUES") return "problema";
  return "pausada";
}

type EstadoRamo = {
  aberto: boolean;
  carregando: boolean;
  erro?: string;
  filhos?: NoDetalhe[];
};

export default function TabelaCampanhas({
  campanhas,
  clienteId,
  periodoQuery,
}: Props) {
  const [ordem, setOrdem] = useState<{ col: string; asc: boolean }>({
    col: "gasto",
    asc: false,
  });
  const [ramos, setRamos] = useState<Record<string, EstadoRamo>>({});
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  const buscarFilhos = useCallback(
    async (id: string, nivel: "adset" | "ad") => {
      setRamos((r) => ({
        ...r,
        [id]: { ...(r[id] ?? {}), aberto: true, carregando: true, erro: undefined },
      }));
      try {
        const q = new URLSearchParams(periodoQuery);
        q.set("cliente", clienteId);
        q.set("nivel", nivel);
        q.set("pai", id);
        const r = await fetch(`/api/detalhe?${q}`, { cache: "no-store" });
        const corpo = await r.json().catch(() => ({}));
        if (!r.ok) {
          setRamos((s) => ({
            ...s,
            [id]: { aberto: true, carregando: false, erro: corpo?.erro ?? "Falhou." },
          }));
          return;
        }
        setRamos((s) => ({
          ...s,
          [id]: { aberto: true, carregando: false, filhos: corpo.filhos ?? [] },
        }));
      } catch {
        setRamos((s) => ({
          ...s,
          [id]: { aberto: true, carregando: false, erro: "Falha de conexão." },
        }));
      }
    },
    [clienteId, periodoQuery]
  );

  const alternar = useCallback(
    (id: string, nivel: "adset" | "ad") => {
      const atual = ramos[id];
      if (atual?.aberto) {
        setRamos((r) => ({ ...r, [id]: { ...atual, aberto: false } }));
        return;
      }
      // Já carregado antes: reabre sem nova requisição.
      if (atual?.filhos) {
        setRamos((r) => ({ ...r, [id]: { ...atual, aberto: true } }));
        return;
      }
      void buscarFilhos(id, nivel);
    },
    [ramos, buscarFilhos]
  );

  const ordenadas = useMemo(() => {
    const lista = [...campanhas];
    lista.sort((a, b) => {
      if (ordem.col === "nome") {
        return ordem.asc
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : b.nome.localeCompare(a.nome, "pt-BR");
      }
      const va = a[ordem.col as keyof Campanha];
      const vb = b[ordem.col as keyof Campanha];
      // Sem conversa não há custo por conversa: essas linhas vão para o fim.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return ordem.asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
    return lista;
  }, [campanhas, ordem]);

  /**
   * Soma só das campanhas marcadas.
   *
   * O custo por lead é recalculado sobre os totais da seleção, nunca pela média
   * dos custos individuais: uma campanha de R$ 500 com 100 leads e outra de
   * R$ 10 com 1 lead têm custos de R$ 5 e R$ 10, cuja média (R$ 7,50) não
   * corresponde a nenhum dinheiro real. O valor certo é 510 / 101.
   */
  const selecao = useMemo(() => {
    const alvo = campanhas.filter((c) => marcadas.has(c.id));
    const gasto = alvo.reduce((s, c) => s + c.gasto, 0);
    const leads = alvo.reduce((s, c) => s + c.conversas, 0);
    const impressoes = alvo.reduce((s, c) => s + c.impressoes, 0);
    const cliques = alvo.reduce((s, c) => s + c.cliques, 0);
    return {
      n: alvo.length,
      gasto,
      leads,
      impressoes,
      cliques,
      custoPorLead: leads > 0 ? gasto / leads : null,
      semLead: alvo.filter((c) => c.conversas === 0).length,
    };
  }, [campanhas, marcadas]);

  const custos = campanhas
    .filter((c) => c.custoConversa !== null)
    .map((c) => c.custoConversa as number);
  const melhor = custos.length ? Math.min(...custos) : null;
  const pior = custos.length ? Math.max(...custos) : null;

  function marcar(id: string) {
    setMarcadas((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const todasMarcadas =
    campanhas.length > 0 && campanhas.every((c) => marcadas.has(c.id));

  function alternarTodas() {
    setMarcadas(todasMarcadas ? new Set() : new Set(campanhas.map((c) => c.id)));
  }

  /** Atalho para o caso que motivou isso: só o que realmente gera lead. */
  function marcarComLead() {
    setMarcadas(new Set(campanhas.filter((c) => c.conversas > 0).map((c) => c.id)));
  }

  function alternarOrdem(col: Coluna | { id: string; menorMelhor?: boolean }) {
    setOrdem((o) =>
      o.col === col.id
        ? { col: o.col, asc: !o.asc }
        : { col: col.id, asc: col.id === "nome" ? true : !!col.menorMelhor }
    );
  }

  if (campanhas.length === 0) {
    return <div className="vazio">Nenhuma campanha com veiculação neste período.</div>;
  }

  function celulas(m: Metricas, destacar: boolean) {
    return COLUNAS.map((col) => {
      let cls = "";
      if (destacar && col.id === "custoConversa") {
        const cc = m.custoConversa;
        cls =
          m.conversas === 0
            ? "ruim"
            : cc !== null && cc === melhor
              ? "bom"
              : cc !== null && cc === pior
                ? "ruim"
                : "";
      } else if (col.id === "custoConversa" && m.conversas === 0) {
        cls = "ruim";
      }
      return (
        <td key={col.id} className={cls}>
          {col.valor(m)}
        </td>
      );
    });
  }

  // Anotação explícita: a função é recursiva (conjunto chama anúncio) e o
  // TypeScript não consegue inferir o retorno de algo que se referencia.
  function linhasFilhas(
    paiId: string,
    nivel: "adset" | "ad",
    profundidade: 1 | 2
  ): React.ReactNode {
    const ramo = ramos[paiId];
    if (!ramo?.aberto) return null;

    if (ramo.carregando) {
      return (
        <tr key={`${paiId}-load`} className="linha-filha">
          <td colSpan={COLUNAS.length + 2} className="ramo-msg">
            <span className={`recuo n${profundidade}`} />
            carregando {nivel === "adset" ? "conjuntos" : "anúncios"}…
          </td>
        </tr>
      );
    }
    if (ramo.erro) {
      return (
        <tr key={`${paiId}-erro`} className="linha-filha">
          <td colSpan={COLUNAS.length + 2} className="ramo-msg ruim">
            <span className={`recuo n${profundidade}`} />
            {ramo.erro}
          </td>
        </tr>
      );
    }
    if (!ramo.filhos?.length) {
      return (
        <tr key={`${paiId}-vazio`} className="linha-filha">
          <td colSpan={COLUNAS.length + 2} className="ramo-msg">
            <span className={`recuo n${profundidade}`} />
            sem {nivel === "adset" ? "conjuntos" : "anúncios"} com veiculação no período
          </td>
        </tr>
      );
    }

    return ramo.filhos.flatMap((f) => {
      const podeAbrir = nivel === "adset";
      const aberto = ramos[f.id]?.aberto ?? false;
      return [
        <tr key={f.id} className="linha-filha">
          <td className="col-marca" />
          <td>
            <div className="no-linha">
              <span className={`recuo n${profundidade}`} />
              {podeAbrir ? (
                <button
                  className={`seta ${aberto ? "aberta" : ""}`}
                  onClick={() => alternar(f.id, "ad")}
                  aria-expanded={aberto}
                  aria-label={aberto ? "Recolher anúncios" : "Expandir anúncios"}
                >
                  ▸
                </button>
              ) : (
                <span className="seta vazia" />
              )}
              <div>
                <div className="no-nome">{f.nome || f.id}</div>
                <div className="no-meta">
                  <span className={`pastilha ${classeStatus(f.status)}`}>
                    {statusPt(f.status)}
                  </span>
                  <span>{nivel === "adset" ? "conjunto" : "anúncio"}</span>
                </div>
              </div>
            </div>
          </td>
          {celulas(f, false)}
        </tr>,
        ...(podeAbrir ? [linhasFilhas(f.id, "ad", 2)] : []),
      ];
    });
  }

  const totalGeral = campanhas.reduce((s, c) => s + c.gasto, 0);
  const leadsGeral = campanhas.reduce((s, c) => s + c.conversas, 0);
  const custoGeral = leadsGeral > 0 ? totalGeral / leadsGeral : null;

  return (
    <>
      <div className="selecao-barra nao-imprime">
        <div className="selecao-acoes">
          <button className="btn" onClick={marcarComLead}>
            Só as que geraram lead
          </button>
          <button
            className="btn"
            onClick={() => setMarcadas(new Set())}
            disabled={selecao.n === 0}
          >
            Limpar
          </button>
        </div>

        {selecao.n === 0 ? (
          <p className="selecao-vazia">
            Marque as campanhas para calcular investimento, leads e custo por
            lead só delas. Útil quando uma campanha de reconhecimento roda junto
            e distorce a média da conta.
          </p>
        ) : (
          <div className="selecao-nums">
            <div className="selecao-item">
              <span className="selecao-rot">
                {selecao.n} de {campanhas.length} campanhas
              </span>
              <span className="selecao-val">{brl(selecao.gasto)}</span>
              <span className="selecao-obs">investido</span>
            </div>
            <div className="selecao-item">
              <span className="selecao-rot">Leads</span>
              <span className="selecao-val">{inteiro(selecao.leads)}</span>
              <span className="selecao-obs">conversas iniciadas</span>
            </div>
            <div className="selecao-item destaque">
              <span className="selecao-rot">Custo por lead</span>
              <span className="selecao-val">
                {selecao.custoPorLead === null ? "—" : brl(selecao.custoPorLead)}
              </span>
              <span className="selecao-obs">
                {custoGeral !== null && selecao.custoPorLead !== null
                  ? `conta inteira: ${brl(custoGeral)}`
                  : "sem lead na seleção"}
              </span>
            </div>
            {selecao.semLead > 0 && (
              <p className="selecao-aviso">
                {selecao.semLead}{" "}
                {selecao.semLead === 1
                  ? "campanha marcada não gerou lead"
                  : "campanhas marcadas não geraram lead"}{" "}
                — o investimento delas entra na conta e encarece o custo por lead.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th className="col-marca" style={{ cursor: "default" }}>
              <input
                type="checkbox"
                checked={todasMarcadas}
                onChange={alternarTodas}
                aria-label="Marcar todas as campanhas"
              />
            </th>
            <th onClick={() => alternarOrdem({ id: "nome" })}>Campanha</th>
            {COLUNAS.map((c) => (
              <th
                key={c.id}
                onClick={() => alternarOrdem(c)}
                aria-sort={
                  ordem.col === c.id ? (ordem.asc ? "ascending" : "descending") : "none"
                }
                title={`Ordenar por ${c.rot}`}
              >
                {c.rot}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.flatMap((c) => {
            const aberto = ramos[c.id]?.aberto ?? false;
            return [
              <tr key={c.id} className={marcadas.has(c.id) ? "marcada" : ""}>
                <td className="col-marca">
                  <input
                    type="checkbox"
                    checked={marcadas.has(c.id)}
                    onChange={() => marcar(c.id)}
                    aria-label={`Incluir ${c.nome} no cálculo`}
                  />
                </td>
                <td>
                  <div className="no-linha">
                    <button
                      className={`seta ${aberto ? "aberta" : ""}`}
                      onClick={() => alternar(c.id, "adset")}
                      aria-expanded={aberto}
                      aria-label={aberto ? "Recolher conjuntos" : "Expandir conjuntos"}
                    >
                      ▸
                    </button>
                    <div>
                      <div className="no-nome" style={{ fontWeight: 500 }}>
                        {c.nome}
                      </div>
                      <div className="no-meta">
                        <span className={`pastilha ${classeStatus(c.status)}`}>
                          {statusPt(c.status)}
                        </span>
                        <span>{objetivoPt(c.objetivo)}</span>
                        <span>· {c.conta}</span>
                      </div>
                    </div>
                  </div>
                </td>
                {celulas(c, true)}
              </tr>,
              linhasFilhas(c.id, "adset", 1),
            ];
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

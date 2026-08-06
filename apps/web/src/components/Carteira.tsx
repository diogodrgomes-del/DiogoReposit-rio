"use client";

import { useMemo } from "react";
import type { ResumoCliente } from "@/lib/meta";
import { brl, decimal, inteiro, pct } from "@/lib/format";

type Props = {
  clientes: ResumoCliente[];
  aoAbrir: (clienteId: string) => void;
};

export default function Carteira({ clientes, aoAbrir }: Props) {
  const { ativos, comProblema, total } = useMemo(() => {
    const ativos = clientes
      .filter((c) => !c.erro && c.gasto > 0)
      .sort((a, b) => {
        // Sem conversa não há custo por conversa: essas linhas vão para o fim.
        if (a.custoConversa === null && b.custoConversa === null)
          return b.gasto - a.gasto;
        if (a.custoConversa === null) return 1;
        if (b.custoConversa === null) return -1;
        return a.custoConversa - b.custoConversa;
      });

    const comProblema = clientes.filter((c) => c.erro || c.gasto === 0);

    const gasto = ativos.reduce((s, c) => s + c.gasto, 0);
    const conversas = ativos.reduce((s, c) => s + c.conversas, 0);
    const cliques = ativos.reduce((s, c) => s + c.cliques, 0);
    const impressoes = ativos.reduce((s, c) => s + c.impressoes, 0);

    return {
      ativos,
      comProblema,
      total: {
        gasto,
        conversas,
        cliques,
        impressoes,
        custoConversa: conversas ? gasto / conversas : null,
      },
    };
  }, [clientes]);

  const { impostoTotal, temImposto } = useMemo(() => {
    const ativos2 = clientes.filter((c) => !c.erro && c.gasto > 0);
    return {
      impostoTotal: ativos2.reduce(
        (s, c) => s + (c.aliquotaImposto ? c.gasto * (c.aliquotaImposto / 100) : 0),
        0
      ),
      temImposto: ativos2.some((c) => c.aliquotaImposto != null),
    };
  }, [clientes]);

  const piorCusto = useMemo(
    () =>
      Math.max(
        1,
        ...ativos
          .filter((c) => c.custoConversa !== null)
          .map((c) => c.custoConversa as number)
      ),
    [ativos]
  );

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <span className="rot">Clientes veiculando</span>
          <div className="val">{ativos.length}</div>
          <div className="obs">
            de {clientes.length} na carteira
          </div>
        </div>
        <div className="tile">
          <span className="rot">Investimento total</span>
          <div className="val">{brl(total.gasto)}</div>
          <div className="obs">soma do período</div>
        </div>
        <div className="tile destaque">
          <span className="rot">Conversas iniciadas</span>
          <div className="val">{inteiro(total.conversas)}</div>
          <div className="obs">
            {total.cliques
              ? `${pct((total.conversas / total.cliques) * 100)} dos cliques`
              : "—"}
          </div>
        </div>
        <div className="tile destaque">
          <span className="rot">Custo médio</span>
          <div className="val">{brl(total.custoConversa)}</div>
          <div className="obs">por conversa, na carteira</div>
        </div>
        <div className="tile">
          <span className="rot">Impressões</span>
          <div className="val">{inteiro(total.impressoes)}</div>
          <div className="obs">no período</div>
        </div>
      </div>

      {temImposto && total.gasto > 0 && (
        <div className="imposto">
          <div className="imposto-item">
            <span className="imposto-rot">Verba líquida</span>
            <span className="imposto-val">{brl(total.gasto)}</span>
          </div>
          <div className="imposto-item">
            <span className="imposto-rot">Imposto estimado</span>
            <span className="imposto-val">{brl(impostoTotal)}</span>
          </div>
          <div className="imposto-item">
            <span className="imposto-rot">Custo total</span>
            <span className="imposto-val total">
              {brl(total.gasto + impostoTotal)}
            </span>
          </div>
          <p className="imposto-nota">
            Soma do imposto de cada cliente, na alíquota configurada para ele. A
            Meta não expõe imposto na API — o valor que ela devolve é líquido.
          </p>
        </div>
      )}

      <div className="painel" style={{ marginBottom: 22 }}>
        <h2>Custo por conversa, por cliente</h2>
        <p className="desc">
          Do mais eficiente ao mais caro. Clique numa linha para abrir o cliente.
        </p>

        {ativos.length === 0 ? (
          <div className="vazio">Nenhum cliente veiculou neste período.</div>
        ) : (
          <div className="ranking">
            {ativos.map((c) => {
              const cc = c.custoConversa;
              const largura = cc === null ? 100 : (cc / piorCusto) * 100;
              return (
                <button
                  key={c.clienteId}
                  className="rank-linha"
                  onClick={() => aoAbrir(c.clienteId)}
                  title={`Abrir ${c.cliente}`}
                >
                  <span className="rank-nome">{c.cliente}</span>
                  <span className="rank-trilho">
                    <span
                      className="rank-barra"
                      style={{
                        width: `${Math.max(largura, 2)}%`,
                        background:
                          cc === null ? "var(--ink-3)" : "var(--s1)",
                      }}
                    />
                  </span>
                  <span className="rank-val">
                    {cc === null ? "sem conversa" : brl(cc)}
                  </span>
                  <span className="rank-obs">
                    {inteiro(c.conversas)} conv · {brl(c.gasto)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="painel" style={{ padding: 0, border: 0, boxShadow: "none" }}>
        <h2 style={{ marginBottom: 3 }}>Detalhe por cliente</h2>
        <p className="desc">
          Clique na linha para abrir o painel completo daquele cliente.
        </p>
      </div>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ cursor: "default" }}>Cliente</th>
              <th style={{ cursor: "default" }}>Investido</th>
              <th style={{ cursor: "default" }}>Conversas</th>
              <th style={{ cursor: "default" }}>R$/conversa</th>
              <th style={{ cursor: "default" }}>Alcance</th>
              <th style={{ cursor: "default" }}>Freq.</th>
              <th style={{ cursor: "default" }}>Cliques</th>
              <th style={{ cursor: "default" }}>CTR</th>
              <th style={{ cursor: "default" }}>CPM</th>
            </tr>
          </thead>
          <tbody>
            {[...ativos, ...comProblema].map((c) => (
              <tr
                key={c.clienteId}
                onClick={() => aoAbrir(c.clienteId)}
                style={{ cursor: "pointer" }}
              >
                <td>
                  <div style={{ fontWeight: 500 }}>{c.cliente}</div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: c.erro ? "var(--crit)" : "var(--ink-3)",
                      marginTop: 3,
                    }}
                  >
                    {c.erro
                      ? c.erro
                      : c.gasto === 0
                        ? "sem veiculação no período"
                        : `${c.contas} conta${c.contas > 1 ? "s" : ""}`}
                  </div>
                </td>
                <td>{brl(c.gasto)}</td>
                <td>{inteiro(c.conversas)}</td>
                <td className={c.custoConversa === null ? "ruim" : ""}>
                  {c.custoConversa === null ? "—" : brl(c.custoConversa)}
                </td>
                <td>{inteiro(c.alcance)}</td>
                <td>{decimal(c.frequencia)}</td>
                <td>{inteiro(c.cliques)}</td>
                <td>{pct(c.ctr)}</td>
                <td>{brl(c.cpm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="nota-metrica" style={{ maxWidth: "76ch" }}>
        Alcance não é somável entre clientes e contas: a mesma pessoa pode ser
        alcançada por mais de uma campanha, então o total é um teto, não uma
        contagem de pessoas distintas. A frequência derivada dele herda a mesma
        ressalva.
      </p>
    </>
  );
}

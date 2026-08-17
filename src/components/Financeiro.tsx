"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Feriado } from "@/lib/feriados";
import type {
  Area,
  Categoria,
  Lancamento,
  Recorrencia,
  Resumo,
  SaldoMes,
} from "@/lib/financeiro-comum";
import { AREAS, DESCRICAO_AREA, ROTULO_AREA } from "@/lib/financeiro-comum";
import { hojeISO } from "@/lib/presets";
import { somarMeses } from "@/lib/recorrencia";
import { brl } from "@/lib/format";
import FinCalendario from "./FinCalendario";
import FinCobrancas from "./FinCobrancas";
import FinLancamentos, { type NovoLancamento } from "./FinLancamentos";
import FinRecorrencias, { type NovaRecorrencia } from "./FinRecorrencias";
import { DespesasPorCategoria, EvolucaoMensal } from "./FinDespesas";

/**
 * Financeiro: Marktiva (empresa) e Diogo (pessoal), na mesma tela e nunca
 * somados.
 *
 * A area e o eixo de tudo — trocar de aba troca o conjunto inteiro de dados,
 * porque misturar caixa de empresa com caixa pessoal e exatamente o erro que
 * este painel existe para evitar.
 *
 * O mes escolhido manda na competencia dos lancamentos, mas nao na agenda de
 * cobranca: essa vem do servidor com tudo que esta em aberto, de qualquer mes.
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Dados = {
  bancoConfigurado: boolean;
  area: Area;
  mes: string;
  hoje: string;
  lancamentos: Lancamento[];
  pendentes: Lancamento[];
  recorrencias: Recorrencia[];
  serie: SaldoMes[];
  despesas: Categoria[];
  feriados: Feriado[];
  resumo: Resumo;
  geradas: number;
};

type Secao = "agenda" | "lancamentos" | "recorrencias" | "despesas";

const SECOES: { id: Secao; rotulo: string }[] = [
  { id: "agenda", rotulo: "Agenda" },
  { id: "lancamentos", rotulo: "Lançamentos" },
  { id: "recorrencias", rotulo: "Recorrências" },
  { id: "despesas", rotulo: "Despesas" },
];

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${ano}`;
}

export default function Financeiro() {
  const router = useRouter();

  const [area, setArea] = useState<Area>("marktiva");
  const [mes, setMes] = useState(() => hojeISO().slice(0, 7));
  const [secao, setSecao] = useState<Secao>("agenda");

  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/financeiro?area=${area}&mes=${mes}`, {
        cache: "no-store",
      });
      if (r.status === 401) {
        router.replace("/login");
        return;
      }
      const corpo = await r.json();
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível carregar.");
        return;
      }
      setDados(corpo as Dados);
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  }, [area, mes, router]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  /**
   * Toda escrita recarrega a tela inteira.
   *
   * Atualizar só a linha mexida seria mais rápido, mas uma baixa muda saldo,
   * agenda, categoria e gráfico ao mesmo tempo — manter tudo isso em sincronia
   * na mão é onde nasceria a divergência entre o que a tela mostra e o que o
   * banco tem.
   */
  const escrever = useCallback(
    async (
      url: string,
      init: RequestInit,
      aoFalhar = "Não foi possível salvar."
    ): Promise<boolean> => {
      setOcupado(true);
      setErro(null);
      try {
        const r = await fetch(url, {
          ...init,
          headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        });
        if (r.status === 401) {
          router.replace("/login");
          return false;
        }
        if (!r.ok) {
          const corpo = await r.json().catch(() => ({}));
          setErro(corpo.erro ?? aoFalhar);
          return false;
        }
        await buscar();
        return true;
      } catch {
        setErro("Sem conexão com o servidor.");
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [buscar, router]
  );

  /**
   * O lançamento entra no mês do próprio vencimento, não no mês aberto na
   * tela: é o mês a que o valor pertence, e é assim que o saldo previsto de
   * cada competência fecha. Se a data escolhida for de outro mês, a tela pula
   * para lá — senão o lançamento sumiria logo depois de ser salvo.
   */
  const criarLancamento = async (dadosForm: NovoLancamento) => {
    const ok = await escrever("/api/financeiro", {
      method: "POST",
      body: JSON.stringify({ ...dadosForm, area }),
    });
    const destino = dadosForm.vencimento.slice(0, 7);
    if (ok && destino !== mes) setMes(destino);
    return ok;
  };

  const pagar = (id: number, pagoEm: string, forma: string) =>
    escrever("/api/financeiro", {
      method: "PATCH",
      body: JSON.stringify({ id, pagoEm, forma }),
    });

  const desfazer = (id: number) =>
    escrever("/api/financeiro", {
      method: "PATCH",
      body: JSON.stringify({ id, pagoEm: "" }),
    });

  const cobrar = (id: number, cobrado: boolean) =>
    escrever("/api/financeiro", {
      method: "PATCH",
      body: JSON.stringify({ id, acao: "cobrar", cobrado }),
    });

  const apagarLancamento = (id: number) => {
    if (!confirm("Apagar este lançamento?")) return;
    escrever(`/api/financeiro?id=${id}`, { method: "DELETE" });
  };

  const criarRecorrencia = (dadosForm: NovaRecorrencia) =>
    escrever("/api/financeiro/recorrencias", {
      method: "POST",
      body: JSON.stringify({
        ...dadosForm,
        area,
        diaVencimento: Number(dadosForm.diaVencimento),
        lembreteDias: Number(dadosForm.lembreteDias),
      }),
    });

  const alternarRecorrencia = (id: number, ativo: boolean) =>
    escrever("/api/financeiro/recorrencias", {
      method: "PATCH",
      body: JSON.stringify({ id, ativo }),
    });

  const apagarRecorrencia = (id: number) => {
    if (
      !confirm(
        "Apagar este contrato? As cobranças em aberto somem; o que já foi pago fica no histórico."
      )
    )
      return;
    escrever(`/api/financeiro/recorrencias?id=${id}`, { method: "DELETE" });
  };

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const resumo = dados?.resumo;
  const hoje = dados?.hoje ?? hojeISO();

  return (
    <div className="app">
      <header className="topo nao-imprime">
        <div className="topo-linha">
          <div className="marca">
            Marktiva <span>Financeiro</span>
          </div>

          <div className="abas" role="tablist" aria-label="Área financeira">
            {AREAS.map((a) => (
              <button
                key={a}
                className="aba"
                role="tab"
                aria-selected={area === a}
                onClick={() => setArea(a)}
                title={DESCRICAO_AREA[a]}
              >
                {ROTULO_AREA[a]}
              </button>
            ))}
          </div>

          <Link className="btn" href="/">
            Painel de campanhas
          </Link>
          <button className="btn" onClick={() => window.print()}>
            Gerar PDF
          </button>
          <button className="btn" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <div className="controles nao-imprime">
        <div className="fin-mes">
          <button
            type="button"
            className="btn btn-icone"
            onClick={() => setMes((m) => somarMeses(m, -1))}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <strong>{rotuloMes(mes)}</strong>
          <button
            type="button"
            className="btn btn-icone"
            onClick={() => setMes((m) => somarMeses(m, 1))}
            aria-label="Próximo mês"
          >
            ›
          </button>
          {mes !== hojeISO().slice(0, 7) && (
            <button
              type="button"
              className="btn"
              onClick={() => setMes(hojeISO().slice(0, 7))}
            >
              Mês atual
            </button>
          )}
        </div>

        <div className="abas fin-secoes" role="tablist" aria-label="Seção">
          {SECOES.map((s) => (
            <button
              key={s.id}
              className="aba"
              role="tab"
              aria-selected={secao === s.id}
              onClick={() => setSecao(s.id)}
            >
              {s.rotulo}
            </button>
          ))}
        </div>

        <span className="fin-status">
          {carregando ? "carregando…" : `${DESCRICAO_AREA[area]} · ${hoje}`}
        </span>
      </div>

      {dados && !dados.bancoConfigurado && (
        <p className="fin-aviso">
          O banco de dados ainda não está configurado. Cadastre{" "}
          <code>DATABASE_URL</code> no servidor e faça um novo deploy — enquanto
          isso, nada é gravado.
        </p>
      )}

      {erro && <p className="fin-erro destaque">{erro}</p>}

      {dados && dados.geradas > 0 && (
        <p className="fin-aviso ok">
          {dados.geradas} cobrança(s) gerada(s) automaticamente pelos contratos
          recorrentes.
        </p>
      )}

      {resumo && (
        <div className="tiles">
          <div className="tile destaque">
            <span className="rot">Saldo realizado</span>
            <div className={`val ${resumo.saldoRealizado < 0 ? "ruim" : "bom"}`}>
              {brl(resumo.saldoRealizado)}
            </div>
            <div className="obs">o que de fato entrou menos o que saiu</div>
          </div>
          <div className="tile">
            <span className="rot">Saldo previsto</span>
            <div className={`val ${resumo.saldoPrevisto < 0 ? "ruim" : ""}`}>
              {brl(resumo.saldoPrevisto)}
            </div>
            <div className="obs">contando o que ainda está em aberto</div>
          </div>
          <div className="tile">
            <span className="rot">Entradas</span>
            <div className="val">{brl(resumo.entradasRecebidas)}</div>
            <div className="obs">
              de {brl(resumo.entradasPrevistas)} previstos
            </div>
          </div>
          <div className="tile">
            <span className="rot">Saídas</span>
            <div className="val">{brl(resumo.saidasPagas)}</div>
            <div className="obs">de {brl(resumo.saidasPrevistas)} previstos</div>
          </div>
          <div className="tile">
            <span className="rot">A receber</span>
            <div className="val">{brl(resumo.aReceber)}</div>
            <div className="obs">
              {resumo.vencidoReceber > 0
                ? `${brl(resumo.vencidoReceber)} já vencidos`
                : "nada vencido"}
            </div>
          </div>
          <div className="tile">
            <span className="rot">A pagar</span>
            <div className="val">{brl(resumo.aPagar)}</div>
            <div className="obs">
              {resumo.vencidoPagar > 0
                ? `${brl(resumo.vencidoPagar)} já vencidos`
                : "nada vencido"}
            </div>
          </div>
        </div>
      )}

      {dados && (
        <>
          {secao === "agenda" && (
            <div className="grade">
              <FinCobrancas
                area={area}
                hoje={hoje}
                pendentes={dados.pendentes}
                recorrencias={dados.recorrencias}
                ocupado={ocupado}
                onPagar={pagar}
                onDesfazer={desfazer}
                onCobrar={cobrar}
              />
              <FinCalendario
                mes={mes}
                hoje={hoje}
                lancamentos={dados.lancamentos}
                feriados={dados.feriados}
              />
            </div>
          )}

          {secao === "lancamentos" && (
            <FinLancamentos
              area={area}
              mes={mes}
              hoje={hoje}
              lancamentos={dados.lancamentos}
              ocupado={ocupado}
              onCriar={criarLancamento}
              onPagar={pagar}
              onDesfazer={desfazer}
              onApagar={apagarLancamento}
            />
          )}

          {secao === "recorrencias" && (
            <FinRecorrencias
              area={area}
              hoje={hoje}
              recorrencias={dados.recorrencias}
              lancamentos={dados.lancamentos}
              ocupado={ocupado}
              onCriar={criarRecorrencia}
              onAlternar={alternarRecorrencia}
              onApagar={apagarRecorrencia}
            />
          )}

          {secao === "despesas" && (
            <>
              <DespesasPorCategoria
                despesas={dados.despesas}
                titulo={
                  area === "marktiva"
                    ? "Despesas da Marktiva"
                    : "Despesas pessoais"
                }
              />
              <EvolucaoMensal serie={dados.serie} />
            </>
          )}
        </>
      )}
    </div>
  );
}

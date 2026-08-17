"use client";

import { useState } from "react";
import type { Area, Lancamento, Recorrencia, Tipo } from "@/lib/financeiro-comum";
import { CATEGORIAS, valorDe } from "@/lib/financeiro-comum";
import {
  FREQUENCIAS,
  PASSO_MESES,
  ROTULO_FREQUENCIA,
  pontualidadeDe,
  somarMeses,
  vencimentoDe,
  type Frequencia,
} from "@/lib/recorrencia";
import { brl, dataLonga } from "@/lib/format";

/**
 * Contratos que se repetem — mensalidade de cliente, assinatura, aluguel.
 *
 * O contrato nao e a cobranca: ele e a regra que fabrica uma cobranca por
 * competencia. Por isso a tela mostra as duas coisas juntas em cada cartao —
 * a regra em cima e o historico de pagamento embaixo, que e onde da para ver
 * se aquele cliente costuma pagar em dia.
 */

export type NovaRecorrencia = {
  tipo: Tipo;
  descricao: string;
  cliente: string;
  categoria: string;
  valor: string;
  frequencia: Frequencia;
  diaVencimento: string;
  inicio: string;
  fim: string;
  lembreteDias: string;
  ajustaDiaUtil: boolean;
};

type Props = {
  area: Area;
  hoje: string;
  recorrencias: Recorrencia[];
  /** Cobranças já geradas, para montar o histórico de cada contrato. */
  lancamentos: Lancamento[];
  ocupado: boolean;
  onCriar: (dados: NovaRecorrencia) => Promise<boolean>;
  onAlternar: (id: number, ativo: boolean) => void;
  onApagar: (id: number) => void;
};

const vazio = (hoje: string): NovaRecorrencia => ({
  tipo: "entrada",
  descricao: "",
  cliente: "",
  categoria: "",
  valor: "",
  frequencia: "mensal",
  diaVencimento: "10",
  inicio: `${hoje.slice(0, 7)}-01`,
  fim: "",
  lembreteDias: "3",
  ajustaDiaUtil: true,
});

export default function FinRecorrencias({
  area,
  hoje,
  recorrencias,
  lancamentos,
  ocupado,
  onCriar,
  onAlternar,
  onApagar,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<NovaRecorrencia>(() => vazio(hoje));
  const [erro, setErro] = useState<string | null>(null);

  const categorias = CATEGORIAS[area][form.tipo];

  function campo<K extends keyof NovaRecorrencia>(k: K, v: NovaRecorrencia[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!form.descricao.trim()) return setErro("Descreva o contrato.");
    const valor = valorDe(form.valor);
    if (valor === null || valor <= 0) return setErro("Informe um valor válido.");
    const dia = Number(form.diaVencimento);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      return setErro("O dia de vencimento vai de 1 a 31.");
    }
    if (!form.inicio) return setErro("Informe a data de início.");
    if (form.fim && form.fim < form.inicio) {
      return setErro("O fim não pode ser antes do início.");
    }

    const ok = await onCriar({
      ...form,
      categoria: form.categoria || categorias[0],
    });
    if (ok) {
      setForm(vazio(hoje));
      setAberto(false);
    } else {
      setErro("Não foi possível salvar. Tente de novo.");
    }
  }

  const ativos = recorrencias.filter((r) => r.ativo);
  const mensalizado = ativos
    .filter((r) => r.tipo === "entrada")
    .reduce((t, r) => t + r.valor / mesesDoCiclo(r.frequencia), 0);

  return (
    <div className="painel">
      <div className="fin-cab">
        <div>
          <h2>Recorrências</h2>
          <p className="desc">
            {ativos.length} contrato(s) ativo(s)
            {area === "marktiva" && mensalizado > 0 && (
              <> · receita recorrente equivalente a {brl(mensalizado)}/mês</>
            )}
            . Cada um gera a cobrança do mês sozinho, com lembrete antes do
            vencimento.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primario"
          onClick={() => setAberto((a) => !a)}
        >
          {aberto ? "Fechar" : "Novo contrato"}
        </button>
      </div>

      {aberto && (
        <form className="fin-form" onSubmit={salvar}>
          <div className="fin-form-grade">
            <label className="fin-campo">
              <span>Tipo</span>
              <select
                value={form.tipo}
                onChange={(e) => {
                  campo("tipo", e.target.value as Tipo);
                  campo("categoria", "");
                }}
              >
                <option value="entrada">
                  {area === "marktiva" ? "Entrada (cobrar cliente)" : "Entrada"}
                </option>
                <option value="saida">Saída (despesa fixa)</option>
              </select>
            </label>

            <label className="fin-campo largo">
              <span>Descrição</span>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => campo("descricao", e.target.value)}
                placeholder={
                  form.tipo === "entrada"
                    ? "Gestão de tráfego — mensalidade"
                    : "Assinatura mensal da ferramenta"
                }
                maxLength={200}
              />
            </label>

            {area === "marktiva" && form.tipo === "entrada" && (
              <label className="fin-campo">
                <span>Cliente</span>
                <input
                  type="text"
                  value={form.cliente}
                  onChange={(e) => campo("cliente", e.target.value)}
                  placeholder="Nome do cliente"
                />
              </label>
            )}

            <label className="fin-campo">
              <span>Valor</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => campo("valor", e.target.value)}
                placeholder="1.500,00"
              />
            </label>

            <label className="fin-campo">
              <span>Categoria</span>
              <input
                type="text"
                list="fin-categorias-rec"
                value={form.categoria}
                onChange={(e) => campo("categoria", e.target.value)}
                placeholder={categorias[0]}
              />
              <datalist id="fin-categorias-rec">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="fin-campo">
              <span>Frequência</span>
              <select
                value={form.frequencia}
                onChange={(e) => campo("frequencia", e.target.value as Frequencia)}
              >
                {FREQUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {ROTULO_FREQUENCIA[f]}
                  </option>
                ))}
              </select>
            </label>

            <label className="fin-campo">
              <span>Dia do vencimento</span>
              <input
                type="number"
                min={1}
                max={31}
                value={form.diaVencimento}
                onChange={(e) => campo("diaVencimento", e.target.value)}
              />
            </label>

            <label className="fin-campo">
              <span>Início</span>
              <input
                type="date"
                value={form.inicio}
                onChange={(e) => campo("inicio", e.target.value)}
              />
            </label>

            <label className="fin-campo">
              <span>Fim (opcional)</span>
              <input
                type="date"
                value={form.fim}
                onChange={(e) => campo("fim", e.target.value)}
              />
            </label>

            <label className="fin-campo">
              <span>Lembrar com quantos dias</span>
              <input
                type="number"
                min={0}
                max={60}
                value={form.lembreteDias}
                onChange={(e) => campo("lembreteDias", e.target.value)}
              />
            </label>

            <label className="fin-campo fin-check largo">
              <input
                type="checkbox"
                checked={form.ajustaDiaUtil}
                onChange={(e) => campo("ajustaDiaUtil", e.target.checked)}
              />
              <span>
                Empurrar para o próximo dia útil quando cair em fim de semana ou
                feriado nacional
              </span>
            </label>
          </div>

          {erro && <p className="fin-erro">{erro}</p>}

          <div className="fin-form-acoes">
            <span className="fin-dica">
              Próximas cobranças:{" "}
              {previa(form).map((d) => dataLonga(d)).join(" · ") || "—"}
            </span>
            <button type="submit" className="btn btn-primario" disabled={ocupado}>
              Criar contrato
            </button>
          </div>
        </form>
      )}

      {recorrencias.length === 0 ? (
        <p className="fin-vazio">
          Nenhum contrato cadastrado. Crie um para as cobranças do mês nascerem
          sozinhas.
        </p>
      ) : (
        <div className="fin-contratos">
          {recorrencias.map((r) => (
            <Contrato
              key={r.id}
              r={r}
              hoje={hoje}
              cobrancas={lancamentos.filter((l) => l.recorrenciaId === r.id)}
              ocupado={ocupado}
              onAlternar={onAlternar}
              onApagar={onApagar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Contrato({
  r,
  hoje,
  cobrancas,
  ocupado,
  onAlternar,
  onApagar,
}: {
  r: Recorrencia;
  hoje: string;
  cobrancas: Lancamento[];
  ocupado: boolean;
  onAlternar: (id: number, ativo: boolean) => void;
  onApagar: (id: number) => void;
}) {
  const pagas = cobrancas.filter((c) => c.pagoEm);
  const atrasadas = pagas.filter(
    (c) => pontualidadeDe(c.vencimento, c.pagoEm!).pontualidade === "atrasado"
  );
  // Média de atraso só sobre o que atrasou: diluir com os pagamentos em dia
  // esconderia justamente o cliente que atrasa muito, de vez em quando.
  const mediaAtraso = atrasadas.length
    ? atrasadas.reduce(
        (t, c) => t + pontualidadeDe(c.vencimento, c.pagoEm!).dias,
        0
      ) / atrasadas.length
    : 0;

  const proxima = proximoVencimento(r, hoje);

  return (
    <article className={`fin-contrato${r.ativo ? "" : " inativo"}`}>
      <div className="fin-contrato-cab">
        <div>
          <strong>{r.descricao}</strong>
          {r.cliente && <em> · {r.cliente}</em>}
          <div className="fin-contrato-meta">
            {ROTULO_FREQUENCIA[r.frequencia]} · todo dia {r.diaVencimento}
            {r.ajustaDiaUtil && " (ajustado ao dia útil)"} · lembrete{" "}
            {r.lembreteDias} dia(s) antes
            {r.fim && ` · até ${dataLonga(r.fim)}`}
          </div>
        </div>
        <span className={`fin-contrato-valor ${r.tipo === "entrada" ? "bom" : "ruim"}`}>
          {r.tipo === "entrada" ? "+" : "−"}
          {brl(r.valor)}
        </span>
      </div>

      <div className="fin-contrato-hist">
        <span className={`pastilha ${r.ativo ? "ativa" : "pausada"}`}>
          {r.ativo ? "Ativo" : "Pausado"}
        </span>
        {r.ativo && (
          <span>
            próxima cobrança em <strong>{dataLonga(proxima)}</strong>
          </span>
        )}
        <span>
          {pagas.length} paga(s)
          {atrasadas.length > 0 &&
            ` · ${atrasadas.length} com atraso (média de ${mediaAtraso.toFixed(0)} dia(s))`}
        </span>
      </div>

      <div className="fin-acoes">
        <button
          type="button"
          className="btn btn-mini"
          disabled={ocupado}
          onClick={() => onAlternar(r.id, !r.ativo)}
        >
          {r.ativo ? "Pausar" : "Reativar"}
        </button>
        <button
          type="button"
          className="btn btn-mini"
          disabled={ocupado}
          onClick={() => onApagar(r.id)}
          title="Apaga o contrato e as cobranças em aberto; o que já foi pago fica no histórico"
        >
          Apagar
        </button>
      </div>
    </article>
  );
}

const mesesDoCiclo = (f: Frequencia): number => PASSO_MESES[f];

/**
 * Primeiro vencimento que ainda nao passou.
 *
 * Anda de ciclo em ciclo a partir do inicio do contrato, respeitando a
 * frequencia — em contrato trimestral, "todo dia 10" nao quer dizer todo mes.
 * Doze ciclos cobrem ate o contrato anual mais antigo ainda aberto.
 */
function proximoVencimento(r: Recorrencia, hoje: string): string {
  const passo = PASSO_MESES[r.frequencia];
  const base = r.inicio.slice(0, 7);
  const distancia = Math.max(
    0,
    Math.ceil(mesesDeDiferenca(base, hoje.slice(0, 7)) / passo)
  );
  for (let i = 0; i < 12; i++) {
    const competencia = somarMeses(base, (distancia + i) * passo);
    if (r.fim && competencia > r.fim.slice(0, 7)) break;
    const data = vencimentoDe(competencia, r.diaVencimento, r.ajustaDiaUtil);
    if (data >= hoje) return data;
  }
  return vencimentoDe(hoje.slice(0, 7), r.diaVencimento, r.ajustaDiaUtil);
}

function mesesDeDiferenca(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** Três primeiros vencimentos do contrato que está sendo digitado. */
function previa(form: NovaRecorrencia): string[] {
  const dia = Number(form.diaVencimento);
  if (!form.inicio || !Number.isInteger(dia) || dia < 1 || dia > 31) return [];
  const passo = mesesDoCiclo(form.frequencia);
  const base = form.inicio.slice(0, 7);
  return [0, 1, 2]
    .map((i) => somarMeses(base, i * passo))
    .filter((m) => !form.fim || m <= form.fim.slice(0, 7))
    .map((m) => vencimentoDe(m, dia, form.ajustaDiaUtil));
}

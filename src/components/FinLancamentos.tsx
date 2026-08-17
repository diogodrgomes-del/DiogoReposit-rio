"use client";

import { useMemo, useState } from "react";
import type { Area, Lancamento, Tipo } from "@/lib/financeiro-comum";
import { CATEGORIAS, FORMAS, valorDe } from "@/lib/financeiro-comum";
import { brl, dataLonga } from "@/lib/format";
import { AcoesPagamento, PastilhaSituacao } from "./FinSituacao";

/**
 * Lancamentos do mes: a lista completa, com o formulario de entrada e saida.
 *
 * O filtro por tipo existe para responder as duas perguntas separadas — "quanto
 * entrou" e "quanto saiu" — sem precisar de duas telas com o mesmo codigo.
 */

export type NovoLancamento = {
  tipo: Tipo;
  descricao: string;
  categoria: string;
  cliente: string;
  valor: string;
  vencimento: string;
  pagoEm: string;
  forma: string;
  observacao: string;
};

type Props = {
  area: Area;
  mes: string;
  hoje: string;
  lancamentos: Lancamento[];
  ocupado: boolean;
  onCriar: (dados: NovoLancamento) => Promise<boolean>;
  onPagar: (id: number, pagoEm: string, forma: string) => void;
  onDesfazer: (id: number) => void;
  onApagar: (id: number) => void;
};

type Filtro = "todos" | Tipo;

const vazio = (mes: string, hoje: string): NovoLancamento => ({
  tipo: "entrada",
  descricao: "",
  categoria: "",
  cliente: "",
  valor: "",
  // Um lançamento novo quase sempre é do mês que está na tela; quando o mês
  // aberto é o corrente, o dia de hoje é o palpite mais provável.
  vencimento: hoje.startsWith(mes) ? hoje : `${mes}-05`,
  pagoEm: "",
  forma: "Pix",
  observacao: "",
});

export default function FinLancamentos({
  area,
  mes,
  hoje,
  lancamentos,
  ocupado,
  onCriar,
  onPagar,
  onDesfazer,
  onApagar,
}: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<NovoLancamento>(() => vazio(mes, hoje));
  const [erro, setErro] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      filtro === "todos"
        ? lancamentos
        : lancamentos.filter((l) => l.tipo === filtro),
    [lancamentos, filtro]
  );

  const categorias = CATEGORIAS[area][form.tipo];

  function campo<K extends keyof NovoLancamento>(k: K, v: NovoLancamento[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!form.descricao.trim()) return setErro("Descreva o lançamento.");
    const valor = valorDe(form.valor);
    if (valor === null || valor <= 0) return setErro("Informe um valor válido.");
    if (!form.vencimento) return setErro("Informe a data de vencimento.");

    const ok = await onCriar({
      ...form,
      categoria: form.categoria || categorias[0],
    });
    if (ok) {
      setForm(vazio(mes, hoje));
      setAberto(false);
    } else {
      setErro("Não foi possível salvar. Tente de novo.");
    }
  }

  const total = (t: Tipo) =>
    lancamentos.filter((l) => l.tipo === t).reduce((s, l) => s + l.valor, 0);

  return (
    <div className="painel">
      <div className="fin-cab">
        <div>
          <h2>Lançamentos do mês</h2>
          <p className="desc">
            Entradas de {brl(total("entrada"))} e saídas de {brl(total("saida"))}{" "}
            na competência aberta.
          </p>
        </div>
        <div className="abas" role="tablist" aria-label="Filtrar por tipo">
          {(["todos", "entrada", "saida"] as Filtro[]).map((f) => (
            <button
              key={f}
              className="aba"
              role="tab"
              aria-selected={filtro === f}
              onClick={() => setFiltro(f)}
            >
              {f === "todos" ? "Tudo" : f === "entrada" ? "Entradas" : "Saídas"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primario"
          onClick={() => setAberto((a) => !a)}
        >
          {aberto ? "Fechar" : "Novo lançamento"}
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
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
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
                    ? "Mensalidade de setembro"
                    : "Assinatura da ferramenta"
                }
                maxLength={200}
              />
            </label>

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
                list="fin-categorias"
                value={form.categoria}
                onChange={(e) => campo("categoria", e.target.value)}
                placeholder={categorias[0]}
              />
              <datalist id="fin-categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
              <span>Vencimento</span>
              <input
                type="date"
                value={form.vencimento}
                onChange={(e) => campo("vencimento", e.target.value)}
              />
            </label>

            <label className="fin-campo">
              <span>Já foi pago em</span>
              <input
                type="date"
                value={form.pagoEm}
                onChange={(e) => campo("pagoEm", e.target.value)}
                max={hoje}
              />
            </label>

            <label className="fin-campo">
              <span>Forma</span>
              <select
                value={form.forma}
                onChange={(e) => campo("forma", e.target.value)}
              >
                {FORMAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="fin-campo largo">
              <span>Observação</span>
              <input
                type="text"
                value={form.observacao}
                onChange={(e) => campo("observacao", e.target.value)}
                maxLength={500}
              />
            </label>
          </div>

          {erro && <p className="fin-erro">{erro}</p>}

          <div className="fin-form-acoes">
            <span className="fin-dica">
              Deixe &quot;já foi pago em&quot; vazio para o lançamento entrar em
              aberto e aparecer na agenda. Ele fica no mês do vencimento.
            </span>
            <button type="submit" className="btn btn-primario" disabled={ocupado}>
              Salvar lançamento
            </button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        <p className="fin-vazio">Nenhum lançamento neste mês.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="fin-tabela">
            <thead>
              <tr>
                <th scope="col">Descrição</th>
                <th scope="col">Categoria</th>
                <th scope="col">Vencimento</th>
                <th scope="col">Valor</th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.descricao}
                    {l.cliente && <em className="fin-sub"> · {l.cliente}</em>}
                    {l.observacao && (
                      <span className="fin-sub" title={l.observacao}>
                        {" "}
                        · {l.observacao}
                      </span>
                    )}
                  </td>
                  <td>{l.categoria}</td>
                  <td>{dataLonga(l.vencimento)}</td>
                  <td className={l.tipo === "entrada" ? "bom" : "ruim"}>
                    {l.tipo === "entrada" ? "+" : "−"}
                    {brl(l.valor)}
                  </td>
                  <td>
                    <PastilhaSituacao l={l} hoje={hoje} />
                  </td>
                  <td>
                    <div className="fin-acoes-celula">
                      <AcoesPagamento
                        l={l}
                        hoje={hoje}
                        ocupado={ocupado}
                        onPagar={onPagar}
                        onDesfazer={onDesfazer}
                      />
                      <button
                        type="button"
                        className="btn btn-mini"
                        disabled={ocupado}
                        onClick={() => onApagar(l.id)}
                        title="Apagar lançamento"
                      >
                        Apagar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { clientes as regra, type StatusCliente } from "@mark/core";
import { formatarTelefone } from "@mark/core";
import { exigirContexto } from "@/lib/sessao";
import { ROTULO_STATUS, SeloSaude, SeloStatus, quando } from "@/modulos/clientes/comuns";

export const dynamic = "force-dynamic";

type Busca = { [k: string]: string | string[] | undefined };

const texto = (v: string | string[] | undefined): string =>
  typeof v === "string" ? v : "";

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const params = await searchParams;
  const ctx = await exigirContexto();

  const busca = texto(params.q);
  const status = texto(params.status) as StatusCliente | "";
  const cursor = texto(params.cursor);

  const pagina = await regra.listar(ctx, {
    busca: busca || undefined,
    status: status ? [status] : undefined,
    cursor: cursor || undefined,
    limite: 50,
  });

  const permissoes = regra.permissoesDe(ctx);
  const filtrando = Boolean(busca || status);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">Clientes</h1>
          <p className="pagina__sub">
            {pagina.itens.length === 0
              ? "Nenhum cliente nesta visão"
              : `${pagina.itens.length} cliente${pagina.itens.length > 1 ? "s" : ""}${
                  pagina.proximoCursor ? " nesta página" : ""
                }`}
          </p>
        </div>
        {permissoes.criar && (
          <Link className="btn btn--acento" href="/clientes/novo">
            Novo cliente
          </Link>
        )}
      </div>

      {/* Filtro por GET, e não por estado no cliente: o resultado fica na URL,
          então é compartilhável, sobrevive ao refresh e o botão voltar
          funciona como a pessoa espera. */}
      <form className="filtros" method="get">
        <label className="campo-sis" style={{ minWidth: 260 }}>
          <span>Buscar</span>
          <input name="q" defaultValue={busca} placeholder="Nome, nome fantasia ou CNPJ" />
        </label>
        <label className="campo-sis" style={{ minWidth: 180 }}>
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn">
          Filtrar
        </button>
        {filtrando && (
          <Link className="btn btn--discreto" href="/clientes">
            Limpar
          </Link>
        )}
      </form>

      <div className="cartao">
        {pagina.itens.length === 0 ? (
          <div className="estado">
            <h2 className="estado__titulo">
              {filtrando ? "Nada encontrado" : "Nenhum cliente ainda"}
            </h2>
            <p className="estado__texto">
              {filtrando
                ? "Nenhum cliente combina com esses filtros. Tente outro termo ou limpe a busca."
                : "Importe a carteira do painel com npm run db:importar-meta, ou cadastre o primeiro à mão."}
            </p>
            {filtrando ? (
              <Link className="btn" href="/clientes">
                Limpar filtros
              </Link>
            ) : (
              permissoes.criar && (
                <Link className="btn btn--acento" href="/clientes/novo">
                  Cadastrar cliente
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="rolagem">
            <table className="tabela-sis">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Saúde</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {pagina.itens.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clientes/${c.id}`}>{c.nome}</Link>
                      {c.segmento && (
                        <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{c.segmento}</div>
                      )}
                    </td>
                    <td>
                      <SeloStatus status={c.status} />
                    </td>
                    <td>
                      <SeloSaude saude={c.saude} />
                    </td>
                    <td>{formatarTelefone(c.telefoneE164) || "—"}</td>
                    <td>{c.cidade ?? "—"}</td>
                    <td style={{ color: "var(--ink-3)" }}>{quando(c.atualizadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação por cursor: o próximo id vai na URL. Sem OFFSET, que faria o
          banco ler e descartar tudo o que veio antes. */}
      {pagina.proximoCursor && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link
            className="btn"
            href={`/clientes?${new URLSearchParams({
              ...(busca && { q: busca }),
              ...(status && { status }),
              cursor: pagina.proximoCursor,
            })}`}
          >
            Carregar mais
          </Link>
        </div>
      )}
    </>
  );
}

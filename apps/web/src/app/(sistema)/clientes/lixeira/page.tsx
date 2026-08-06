import Link from "next/link";
import { notFound } from "next/navigation";
import { clientes as regra, pode } from "@mark/core";
import { restaurarCliente } from "@/modulos/clientes/acoes";
import { data } from "@/modulos/clientes/comuns";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/**
 * Lixeira.
 *
 * Nada no sistema é apagado de verdade: `excluido_em` tira o registro das listas
 * e da busca, e esta tela devolve. É o que garante que um clique errado não
 * destrua o histórico de um cliente — junto com o backup, que cobre o caso em
 * que alguém apaga de propósito.
 *
 * O segmento estático `lixeira` vence `[id]` na resolução de rota do Next, então
 * não há ambiguidade com a ficha de um cliente.
 */
export default async function PaginaLixeira() {
  const ctx = await exigirContexto();
  if (!pode(ctx, "clientes.cliente.excluir")) notFound();

  const excluidos = await regra.listarExcluidos(ctx);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">Lixeira</h1>
          <p className="pagina__sub">
            Clientes removidos das listas. Continuam no banco com todo o histórico.
          </p>
        </div>
        <Link className="btn btn--discreto" href="/clientes">
          Voltar
        </Link>
      </div>

      <div className="cartao">
        {excluidos.length === 0 ? (
          <div className="estado">
            <h2 className="estado__titulo">Lixeira vazia</h2>
            <p className="estado__texto">Nenhum cliente foi removido.</p>
          </div>
        ) : (
          <div className="rolagem">
            <table className="tabela-sis">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Cidade</th>
                  <th>Cadastrado em</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {excluidos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td>{c.cidade ?? "—"}</td>
                    <td style={{ color: "var(--ink-3)" }}>{data(c.criadoEm)}</td>
                    <td style={{ textAlign: "right" }}>
                      <form action={restaurarCliente}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="btn">
                          Restaurar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

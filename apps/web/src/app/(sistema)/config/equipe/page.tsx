import { notFound } from "next/navigation";
import { pode, usuarios } from "@mark/core";
import { quando } from "@/modulos/clientes/comuns";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/**
 * Equipe e papéis.
 *
 * Leitura, por enquanto. Convidar e trocar papel entram junto com o fluxo de
 * convite por e-mail — criar usuário sem forma de ele definir a própria senha
 * significaria alguém digitar senha por outro, que é como senha compartilhada
 * nasce.
 */
export default async function PaginaEquipe() {
  const ctx = await exigirContexto();
  if (!pode(ctx, "config.usuario.ver")) notFound();

  const membros = await usuarios.equipe(ctx);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">Equipe</h1>
          <p className="pagina__sub">
            {membros.length} pessoa{membros.length === 1 ? "" : "s"} nesta organização
          </p>
        </div>
      </div>

      <div className="cartao">
        <div className="rolagem">
          <table className="tabela-sis">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Papel</th>
                <th>Cargo</th>
                <th>Situação</th>
                <th>Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.nome}</strong>
                    <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{m.email}</div>
                  </td>
                  <td>{m.papel}</td>
                  <td>{m.cargo ?? "—"}</td>
                  <td>
                    <span className={`selo ${m.ativo ? "selo--verde" : "selo--vermelho"}`}>
                      {m.ativo ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td style={{ color: "var(--ink-3)" }}>
                    {m.ultimoAcesso ? quando(m.ultimoAcesso) : "Nunca entrou"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cartao" style={{ marginTop: 16 }}>
        <div className="cartao__cabeca">
          <strong>Sobre as permissões</strong>
        </div>
        <div className="cartao__corpo">
          <p className="pagina__sub" style={{ marginBottom: 8 }}>
            O papel define o que cada pessoa enxerga. Um membro sem escopo definido vê todos os
            clientes que o papel permitir; com escopo, só a própria carteira.
          </p>
          <p className="pagina__sub">
            O financeiro pessoal do proprietário é a única área fora desse sistema: ela responde a{" "}
            <code>organizacoes.proprietario_id</code> e a mais nada. Nenhum papel concede acesso a
            ela, nem por engano — o banco recusa a permissão com uma restrição.
          </p>
        </div>
      </div>
    </>
  );
}

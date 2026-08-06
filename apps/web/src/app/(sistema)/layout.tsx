import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pode, usuarios } from "@mark/core";
import { BarraLateral, type GrupoMenu } from "@/componentes/sistema/BarraLateral";
import { MenuUsuario } from "@/componentes/sistema/MenuUsuario";
import { lerAcesso } from "@/lib/sessao";
import "../sistema.css";

export const metadata: Metadata = {
  title: "MARK SISTEM",
  robots: { index: false, follow: false },
};

/**
 * Casca dos módulos do MARK SISTEM.
 *
 * Server Component: resolve sessão, contexto e permissões antes de qualquer
 * pintura. A barra lateral chega ao navegador já com a lista certa — não há um
 * instante em que apareça um item que a pessoa não pode abrir.
 *
 * Esconder item é conveniência. Quem recusa de verdade é o `exigir()` dentro de
 * cada página e de cada função de `@mark/core`.
 */
export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const acesso = await lerAcesso();

  if (!acesso) redirect("/login?de=/clientes");

  // Sessão do painel antigo não abre módulo nenhum: sem organização e sem papel
  // não há como decidir permissão, e chutar seria pior do que recusar.
  if (acesso.modo !== "banco") {
    return (
      <div className="sistema">
        <main className="sistema__conteudo" style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}>
          <div className="estado">
            <h1 className="estado__titulo">Entre pelo MARK SISTEM</h1>
            <p className="estado__texto">
              Você está no modo painel, que só abre as campanhas. Os módulos do sistema exigem
              login com e-mail e senha cadastrados no banco.
            </p>
            <a className="btn btn--acento" href="/login">
              Fazer login
            </a>
          </div>
        </main>
      </div>
    );
  }

  const ctx = acesso.ctx;
  const perfil = await usuarios.perfil(ctx);

  // Sessão válida de quem perdeu o vínculo. Melhor mandar para o login do que
  // renderizar uma casca vazia sem explicação.
  if (!perfil) redirect("/login");

  const grupos: GrupoMenu[] = [
    {
      itens: [{ href: "/", rotulo: "Campanhas", icone: "grafico" }],
    },
  ];

  if (pode(ctx, "vendas.lead.ver")) {
    grupos.push({
      titulo: "Comercial",
      itens: [{ href: "/vendas", rotulo: "Pipeline", icone: "funil" }],
    });
  }

  if (pode(ctx, "clientes.cliente.ver")) {
    const itens: GrupoMenu["itens"] = [{ href: "/clientes", rotulo: "Clientes", icone: "predio" }];
    if (pode(ctx, "clientes.cliente.excluir")) {
      itens.push({ href: "/clientes/lixeira", rotulo: "Lixeira", icone: "lixeira" });
    }
    grupos.push({ titulo: "Gestão", itens });
  }

  if (pode(ctx, "config.usuario.ver")) {
    grupos.push({
      titulo: "Configurações",
      itens: [{ href: "/config/equipe", rotulo: "Equipe", icone: "pessoas" }],
    });
  }

  return (
    <div className="sistema">
      <BarraLateral grupos={grupos} />
      <header className="sistema__topo">
        <p className="sistema__titulo">{perfil.organizacao}</p>
        <MenuUsuario nome={perfil.nome} papel={perfil.papel} />
      </header>
      <main className="sistema__conteudo">{children}</main>
    </div>
  );
}

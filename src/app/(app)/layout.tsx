import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAtor } from "@/lib/auth/sessao";
import { can, canAlguma } from "@/lib/auth/can";
import { ROTULO_PAPEL } from "@/lib/auth/permissoes";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/layout/Shell";
import type { ItemMenu } from "@/components/layout/Sidebar";

/**
 * Layout autenticado. Resolve o ator UMA vez e todas as páginas abaixo herdam,
 * em vez de cada página resolver sessão por conta própria e alguém esquecer.
 *
 * O menu é montado a partir das permissões: item sem permissão não aparece —
 * não vem cinza, não vem com cadeado. Quem não pode não precisa saber que
 * existe.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ator = await getAtor();
  if (!ator) redirect("/login");

  const naoLidas = await prisma.notification.count({
    where: { userId: ator.userId, lidaEm: null, arquivadaEm: null },
  });

  const itens: ItemMenu[] = [{ href: "/", rotulo: "Painel", icone: "painel" }];

  if (can(ator, "leads:ler")) {
    itens.push({ href: "/vendas", rotulo: "Vendas", icone: "vendas", grupo: "Comercial" });
  }
  if (can(ator, "clientes:ler")) {
    itens.push({ href: "/clientes", rotulo: "Clientes", icone: "clientes", grupo: "Comercial" });
  }
  if (can(ator, "demandas:ler")) {
    itens.push({ href: "/demandas", rotulo: "Demandas", icone: "demandas", grupo: "Operação" });
  }
  if (can(ator, "agenda:ler")) {
    itens.push({ href: "/agenda", rotulo: "Agenda", icone: "agenda", grupo: "Operação" });
  }
  if (can(ator, "trafego:ler")) {
    itens.push({ href: "/trafego", rotulo: "Tráfego", icone: "trafego", grupo: "Operação" });
  }
  if (can(ator, "financeiro.empresa:ler")) {
    itens.push({ href: "/financeiro", rotulo: "Financeiro", icone: "financeiro", grupo: "Dinheiro" });
  }
  if (can(ator, "credenciais:ler")) {
    itens.push({ href: "/acessos", rotulo: "Senhas", icone: "senhas", grupo: "Dinheiro" });
  }
  itens.push({ href: "/configuracoes", rotulo: "Configurações", icone: "config", grupo: "Sistema" });

  // Ações rápidas do ⌘K, também filtradas por permissão.
  const acoes: { rotulo: string; url: string }[] = [];
  if (can(ator, "leads:criar")) acoes.push({ rotulo: "Criar lead", url: "/vendas?novo=1" });
  if (can(ator, "demandas:criar")) acoes.push({ rotulo: "Criar demanda", url: "/demandas?nova=1" });
  if (can(ator, "clientes:criar")) acoes.push({ rotulo: "Criar cliente", url: "/clientes?novo=1" });
  if (can(ator, "agenda:criar")) acoes.push({ rotulo: "Criar evento", url: "/agenda?novo=1" });
  if (canAlguma(ator, "financeiro.empresa:criar"))
    acoes.push({ rotulo: "Lançar despesa", url: "/financeiro/despesas?nova=1" });

  const colapsada = (await cookies()).get("mark-sidebar")?.value === "1";

  const mobile = itens.filter((i) =>
    ["/", "/demandas", "/agenda", "/vendas", "/clientes"].includes(i.href)
  );

  return (
    <Shell
      itens={itens}
      itensMobile={mobile}
      acoesBusca={acoes}
      usuario={ator.nome}
      organizacao={ator.organizacaoNome}
      papel={ROTULO_PAPEL[ator.papel]}
      naoLidas={naoLidas}
      colapsadaInicial={colapsada}
    >
      {children}
    </Shell>
  );
}

import { notFound } from "next/navigation";
import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";

/**
 * Barreira do módulo financeiro.
 *
 * Sem permissão é 404, não 403: um 403 confirma que a página existe, e o
 * briefing (§13) pede que quem não tem acesso não consiga sequer descobrir a
 * área por URL.
 *
 * Esta é a primeira de cinco barreiras — as outras estão nas queries, na
 * fronteira do domínio, nas notificações e na busca. Ver
 * docs/arquitetura/05-permissoes.md.
 */
export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "financeiro.empresa:ler")) notFound();
  return <>{children}</>;
}

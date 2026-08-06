import { NextResponse } from "next/server";
import { lerAcesso } from "@/lib/sessao";
import { listarClientes } from "@/lib/clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Apenas id e nome — os tokens nunca saem do servidor. */
export async function GET() {
  // O middleware confere só a presença do cookie de sessão do MARK SISTEM; a
  // validação real, com consulta ao banco e checagem de revogação, é aqui.
  if (!(await lerAcesso())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const clientes = listarClientes();
  return NextResponse.json(
    {
      clientes,
      vazio: clientes.length === 0,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

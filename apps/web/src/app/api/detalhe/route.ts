import { NextResponse } from "next/server";
import { lerAcesso } from "@/lib/sessao";
import { tokenDe } from "@/lib/clientes";
import { ErroMeta, carregarFilhos, type Nivel } from "@mark/integracoes/meta-ads";
import { resolverJanela } from "@mark/integracoes/meta-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NIVEIS: Nivel[] = ["adset", "ad"];

export async function GET(req: Request) {
  // O middleware confere só a presença do cookie de sessão do MARK SISTEM; a
  // validação real, com consulta ao banco e checagem de revogação, é aqui.
  if (!(await lerAcesso())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;

  const janela = resolverJanela(params);
  if (!janela.ok) {
    return NextResponse.json({ erro: janela.erro }, { status: 400 });
  }

  const clienteId = params.get("cliente") ?? "";
  const token = tokenDe(clienteId);
  if (!token) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  const nivel = params.get("nivel") as Nivel | null;
  if (!nivel || !NIVEIS.includes(nivel)) {
    return NextResponse.json(
      { erro: "Nível inválido. Use adset ou ad." },
      { status: 400 }
    );
  }

  // O id do pai vira caminho na URL da Graph API: só dígitos, nada mais.
  const paiId = params.get("pai") ?? "";
  if (!/^\d+$/.test(paiId)) {
    return NextResponse.json({ erro: "Identificador inválido." }, { status: 400 });
  }

  try {
    const filhos = await carregarFilhos({
      token,
      paiId,
      nivel,
      preset: janela.janela.preset,
      since: janela.janela.since,
      until: janela.janela.until,
    });
    return NextResponse.json(
      { filhos, nivel, pai: paiId },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    const erro = e as Error;
    if (erro instanceof ErroMeta) {
      console.error("Erro da Meta:", erro.message);
      return NextResponse.json({ erro: erro.message }, { status: 502 });
    }
    console.error("Falha ao detalhar:", erro.message);
    return NextResponse.json(
      { erro: "Não foi possível carregar o detalhamento." },
      { status: 500 }
    );
  }
}

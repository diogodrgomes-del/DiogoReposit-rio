import { NextResponse } from "next/server";
import {
  assinarEstado,
  extrairParametrosAp,
  modoDemo,
  urlAutorizacao,
  type Provedor,
} from "@/lib/portal";

export const runtime = "nodejs";

function ehProvedor(v: string): v is Provedor {
  return v === "facebook" || v === "google";
}

/**
 * Comeco do login social. Guarda os parametros do roteador num estado assinado
 * e manda o visitante para o Facebook/Google. Sem credenciais cadastradas, roda
 * o fluxo em modo demonstracao, pulando direto para o retorno.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!ehProvedor(provider)) {
    return NextResponse.json({ erro: "Provedor inválido." }, { status: 404 });
  }

  const url = new URL(req.url);
  const ap = extrairParametrosAp(url.searchParams);

  let state: string;
  try {
    state = await assinarEstado({ p: provider, ap });
  } catch (e) {
    console.error("Portal Wi-Fi sem SESSION_SECRET:", (e as Error).message);
    return NextResponse.redirect(new URL("/wifi?erro=config", url.origin));
  }

  if (modoDemo(provider)) {
    const destino = new URL(`/api/wifi/${provider}/callback`, url.origin);
    destino.searchParams.set("state", state);
    destino.searchParams.set("demo", "1");
    return NextResponse.redirect(destino);
  }

  return NextResponse.redirect(urlAutorizacao(req, provider, state));
}

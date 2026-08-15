import { NextResponse } from "next/server";
import {
  lerEstado,
  registrarVisitante,
  trocarCodePorVisitante,
  urlLiberacao,
  type Provedor,
  type Visitante,
} from "@/lib/portal";

export const runtime = "nodejs";

function ehProvedor(v: string): v is Provedor {
  return v === "facebook" || v === "google";
}

/**
 * Retorno do Facebook/Google. Confere o estado assinado, troca o code pelo
 * perfil, registra o lead e libera a internet — ou cai na tela de "conectado"
 * quando nao ha roteador na frente (teste no navegador, modo demonstracao).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const url = new URL(req.url);
  const origin = url.origin;

  if (!ehProvedor(provider)) {
    return NextResponse.redirect(new URL("/wifi?erro=provedor", origin));
  }

  // O visitante recusou a autorizacao no Facebook/Google.
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/wifi?erro=recusado", origin));
  }

  const stateToken = url.searchParams.get("state") ?? "";
  const estado = await lerEstado(stateToken);
  if (!estado || estado.p !== provider) {
    return NextResponse.redirect(new URL("/wifi?erro=estado", origin));
  }

  const demo = url.searchParams.get("demo") === "1";

  let visitante: Visitante;
  if (demo) {
    visitante = {
      provedor: provider,
      idExterno: "demo",
      nome: "Visitante (demonstração)",
      email: null,
    };
  } else {
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(new URL("/wifi?erro=code", origin));
    }
    try {
      visitante = await trocarCodePorVisitante(req, provider, code);
    } catch (e) {
      console.error("Falha no OAuth do portal:", (e as Error).message);
      return NextResponse.redirect(new URL("/wifi?erro=oauth", origin));
    }
    // So registra visita real; a demonstracao nao suja a base de leads.
    await registrarVisitante(visitante, estado.ap);
  }

  const liberar = urlLiberacao(estado.ap);
  if (liberar) {
    return NextResponse.redirect(liberar);
  }

  const conectado = new URL("/wifi/conectado", origin);
  conectado.searchParams.set("nome", visitante.nome);
  if (demo) conectado.searchParams.set("demo", "1");
  return NextResponse.redirect(conectado);
}

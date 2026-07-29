import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, lerSessao } from "@/lib/auth";

/**
 * Protege tudo que nao seja a tela de login, o endpoint de login e os
 * estaticos. Sem sessao valida, o painel nunca chega a ser renderizado — e o
 * token da Meta, que so existe no servidor, nunca e consultado.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const livre =
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    // Diagnóstico de configuração: precisa responder sem sessão, porque é
    // usado justamente quando o login não funciona. Não expõe valor algum.
    pathname === "/api/saude" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (livre) return NextResponse.next();

  const usuario = await lerSessao(req.cookies.get(COOKIE)?.value);
  if (usuario) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const destino = req.nextUrl.clone();
  destino.pathname = "/login";
  destino.search = pathname === "/" ? "" : `?de=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

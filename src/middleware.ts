import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth/sessao";

/**
 * Primeira barreira, barata: sem cookie de sessão nada além de /login é servido.
 *
 * A validação de verdade (sessão existe, não foi revogada, não expirou, usuário
 * ainda ativo) acontece no layout autenticado, que roda no runtime Node e
 * alcança o banco. O middleware roda no Edge e não deve consultar Postgres a
 * cada requisição de página — inclusive as de arquivo estático.
 *
 * Ou seja: aqui é o filtro grosso, e a autorização real está em getAtor() +
 * can(), no servidor, em toda leitura e em toda escrita.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const livre =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/saude" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg";

  if (livre) return NextResponse.next();

  if (req.cookies.get(COOKIE)?.value) return NextResponse.next();

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

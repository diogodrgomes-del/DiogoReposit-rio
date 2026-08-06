import { NextResponse, type NextRequest } from "next/server";
import { COOKIE as COOKIE_BANCO } from "@mark/auth/cookie";
import { COOKIE as COOKIE_LEGADO, lerSessao } from "@/lib/auth";

/**
 * Primeira barreira: sem sessão, a página nem chega a ser renderizada e o token
 * da Meta nunca é consultado.
 *
 * O que este middleware **não** faz é validar a sessão de banco. Fazer isso
 * aqui obrigaria a carregar o driver do Postgres a cada requisição, inclusive
 * nas que não tocam em dado nenhum. Quem valida a sessão de banco é
 * `exigirAcesso()` / `exigirContexto()`, dentro de cada rota e de cada Server
 * Component — que é onde a decisão importa e onde o `Contexto` é necessário de
 * qualquer forma.
 *
 * Consequência da divisão: um cookie de banco forjado passa por aqui e morre na
 * rota. Passar no middleware nunca é o que autoriza; é só o que evita renderizar
 * tela para quem claramente não entrou.
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

  // Sessão do MARK SISTEM: só a presença é conferida aqui. A validação real,
  // com consulta ao banco e checagem de revogação, acontece na rota.
  if (req.cookies.get(COOKIE_BANCO)?.value) return NextResponse.next();

  // Sessão do painel: o JWT é verificado por inteiro, e isso é barato e roda
  // em qualquer runtime.
  if (await lerSessao(req.cookies.get(COOKIE_LEGADO)?.value)) return NextResponse.next();

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

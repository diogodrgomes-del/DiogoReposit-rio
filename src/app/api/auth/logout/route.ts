import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, revogarSessao } from "@/lib/auth/sessao";

export const runtime = "nodejs";

export async function POST() {
  const token = (await cookies()).get(COOKIE)?.value;
  // Revoga no banco, não só apaga o cookie: cookie copiado antes do logout
  // continuaria valendo até expirar.
  if (token) await revogarSessao(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

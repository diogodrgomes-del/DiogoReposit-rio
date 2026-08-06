import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE as COOKIE_BANCO, sessao } from "@mark/auth";
import { COOKIE as COOKIE_LEGADO } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/sessao";

export const runtime = "nodejs";

/**
 * Encerra a sessão nos dois modos.
 *
 * No modo banco não basta apagar o cookie: a sessão é revogada na tabela. Só
 * limpar o cookie deixaria o token valendo caso alguém o tivesse copiado —
 * e poder revogar é justamente o motivo de a sessão viver no banco.
 */
export async function POST() {
  const jar = await cookies();
  const tokenBanco = jar.get(COOKIE_BANCO)?.value;

  if (tokenBanco && bancoConfigurado()) {
    try {
      await sessao.revogar(tokenBanco);
    } catch (e) {
      // Falhar a revogação não pode impedir o logout na tela; o cookie sai
      // de qualquer forma e a sessão expira sozinha em no máximo 12 h.
      console.error("Não foi possível revogar a sessão:", e instanceof Error ? e.message : e);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_BANCO, "", { path: "/", maxAge: 0 });
  res.cookies.set(COOKIE_LEGADO, "", { path: "/", maxAge: 0 });
  return res;
}

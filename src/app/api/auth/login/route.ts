import { NextResponse } from "next/server";
import { COOKIE, MAX_IDADE_COOKIE, conferirSenha, criarSessao } from "@/lib/auth";

export const runtime = "nodejs";

/** Atraso fixo: uma resposta rápida não pode denunciar usuário inexistente. */
const ATRASO_MS = 400;

export async function POST(req: Request) {
  const inicio = Date.now();
  let usuario = "";
  let senha = "";

  try {
    const corpo = await req.json();
    usuario = String(corpo?.usuario ?? "").trim();
    senha = String(corpo?.senha ?? "");
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  if (!usuario || !senha) {
    return NextResponse.json(
      { erro: "Informe usuário e senha." },
      { status: 400 }
    );
  }

  let ok = false;
  try {
    ok = await conferirSenha(usuario, senha);
  } catch (e) {
    console.error("Falha ao conferir senha:", (e as Error).message);
    return NextResponse.json(
      { erro: "Servidor sem configuração de acesso. Verifique DASH_USERS e SESSION_SECRET." },
      { status: 500 }
    );
  }

  const resta = ATRASO_MS - (Date.now() - inicio);
  if (resta > 0) await new Promise((r) => setTimeout(r, resta));

  if (!ok) {
    return NextResponse.json(
      { erro: "Usuário ou senha incorretos." },
      { status: 401 }
    );
  }

  const token = await criarSessao(usuario);
  const res = NextResponse.json({ ok: true, usuario });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_IDADE_COOKIE,
  });
  return res;
}

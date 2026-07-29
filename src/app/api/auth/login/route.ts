import { NextResponse } from "next/server";
import {
  COOKIE,
  MAX_IDADE_COOKIE,
  conferirSenha,
  criarSessao,
  temSessionSecret,
  totalUsuarios,
} from "@/lib/auth";
import { bloqueado, limparFalhas, origem, registrarFalha } from "@/lib/limite";

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

  // Servidor sem nenhum usuário cadastrado recusaria toda tentativa como
  // "senha incorreta", culpando quem digitou por um erro de configuração.
  if (totalUsuarios() === 0) {
    return NextResponse.json(
      {
        erro:
          "Nenhum usuário cadastrado no servidor. Verifique a variável DASH_USERS " +
          "e faça um novo deploy — variáveis novas só valem no próximo build.",
      },
      { status: 503 }
    );
  }
  if (!temSessionSecret()) {
    return NextResponse.json(
      {
        erro:
          "SESSION_SECRET ausente ou com menos de 32 caracteres. Cadastre e refaça o deploy.",
      },
      { status: 503 }
    );
  }

  const chave = origem(req);
  const espera = bloqueado(chave);
  if (espera > 0) {
    return NextResponse.json(
      {
        erro: `Muitas tentativas. Aguarde ${Math.ceil(espera / 60)} minuto(s) e tente de novo.`,
      },
      { status: 429 }
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
    registrarFalha(chave);
    return NextResponse.json(
      { erro: "Usuário ou senha incorretos." },
      { status: 401 }
    );
  }

  limparFalhas(chave);
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

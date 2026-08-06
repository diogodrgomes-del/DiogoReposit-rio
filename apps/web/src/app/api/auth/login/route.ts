import { NextResponse } from "next/server";
import { COOKIE as COOKIE_BANCO, MAX_IDADE_COOKIE as IDADE_BANCO, autenticar } from "@mark/auth";
import {
  COOKIE as COOKIE_LEGADO,
  MAX_IDADE_COOKIE as IDADE_LEGADO,
  conferirSenha,
  criarSessao,
  temSessionSecret,
  totalUsuarios,
} from "@/lib/auth";
import { bancoConfigurado } from "@/lib/sessao";
import { bloqueado, limparFalhas, origem, registrarFalha } from "@/lib/limite";

export const runtime = "nodejs";

/** Atraso fixo: uma resposta rápida não pode denunciar usuário inexistente. */
const ATRASO_MS = 400;

/**
 * Login em dois modos.
 *
 * Com banco configurado, tenta o MARK SISTEM: usuário em tabela, sessão
 * revogável. Sem banco — ou quando o e-mail não existe lá —, cai para o
 * `DASH_USERS` do painel.
 *
 * A convivência é temporária e existe para que ninguém fique sem painel
 * enquanto o banco é provisionado. Quando toda a equipe estiver no banco, o
 * caminho legado sai junto com `DASH_USERS`.
 */
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
    return NextResponse.json({ erro: "Informe usuário e senha." }, { status: 400 });
  }

  const chave = origem(req);
  const espera = bloqueado(chave);
  if (espera > 0) {
    return NextResponse.json(
      { erro: `Muitas tentativas. Aguarde ${Math.ceil(espera / 60)} minuto(s) e tente de novo.` },
      { status: 429 },
    );
  }

  /** Iguala o tempo de resposta entre sucesso e falha. */
  const aguardarPiso = async () => {
    const resta = ATRASO_MS - (Date.now() - inicio);
    if (resta > 0) await new Promise((r) => setTimeout(r, resta));
  };

  // ---- Modo banco -------------------------------------------------------
  if (bancoConfigurado() && usuario.includes("@")) {
    try {
      const r = await autenticar(usuario, senha, {
        ip: chave,
        agente: req.headers.get("user-agent"),
      });
      await aguardarPiso();

      if (r.ok) {
        limparFalhas(chave);
        const res = NextResponse.json({ ok: true, usuario: r.nome, modo: "banco" });
        res.cookies.set(COOKIE_BANCO, r.token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: IDADE_BANCO,
        });
        return res;
      }

      if (r.motivo === "sem_organizacao") {
        return NextResponse.json(
          { erro: "Sua conta existe, mas não está vinculada a nenhuma organização ativa." },
          { status: 403 },
        );
      }
      if (r.motivo === "inativo") {
        return NextResponse.json({ erro: "Conta desativada." }, { status: 403 });
      }

      registrarFalha(chave);
      return NextResponse.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    } catch (e) {
      // Banco fora do ar não pode trancar todo mundo para fora: segue para o
      // caminho legado, que não depende dele.
      console.error("Login pelo banco indisponível:", e instanceof Error ? e.message : e);
    }
  }

  // ---- Modo legado ------------------------------------------------------
  if (totalUsuarios() === 0) {
    const dica = bancoConfigurado()
      ? "Use o e-mail cadastrado no MARK SISTEM. Se ainda não há usuário, rode npm run db:semear."
      : "Nenhum usuário cadastrado no servidor. Verifique DASH_USERS e faça um novo deploy — " +
        "variáveis novas só valem no próximo build.";
    return NextResponse.json({ erro: dica }, { status: 503 });
  }
  if (!temSessionSecret()) {
    return NextResponse.json(
      { erro: "SESSION_SECRET ausente ou com menos de 32 caracteres. Cadastre e refaça o deploy." },
      { status: 503 },
    );
  }

  let ok = false;
  try {
    ok = await conferirSenha(usuario, senha);
  } catch (e) {
    console.error("Falha ao conferir senha:", (e as Error).message);
    return NextResponse.json(
      { erro: "Servidor sem configuração de acesso. Verifique DASH_USERS e SESSION_SECRET." },
      { status: 500 },
    );
  }

  await aguardarPiso();

  if (!ok) {
    registrarFalha(chave);
    return NextResponse.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
  }

  limparFalhas(chave);
  const token = await criarSessao(usuario);
  const res = NextResponse.json({ ok: true, usuario, modo: "legado" });
  res.cookies.set(COOKIE_LEGADO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IDADE_LEGADO,
  });
  return res;
}

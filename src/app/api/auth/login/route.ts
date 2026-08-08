import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { conferirSenha, hashSenha, precisaRehash } from "@/lib/auth/senha";
import { COOKIE, MAX_IDADE_COOKIE, criarSessao } from "@/lib/auth/sessao";
import { bloqueado, registrarFalha, limparFalhas } from "@/lib/limite";

export const runtime = "nodejs";

const Corpo = z.object({
  email: z.string().min(1).max(200),
  senha: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const dados = Corpo.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const email = dados.data.email.trim().toLowerCase();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";

  const chave = `${ip}:${email}`;
  const esperar = bloqueado(chave);
  if (esperar > 0) {
    return NextResponse.json(
      { erro: `Muitas tentativas. Tente de novo em ${esperar}s.` },
      { status: 429 }
    );
  }

  const usuario = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { ativo: true }, take: 1 } },
  });

  // Confere sempre, mesmo sem usuário: o tempo de resposta não deve denunciar
  // quais e-mails existem na base.
  const ok = await conferirSenha(dados.data.senha, usuario?.senhaHash);

  if (!ok || !usuario || !usuario.ativo) {
    registrarFalha(chave);
    return NextResponse.json(
      { erro: "E-mail ou senha incorretos." },
      { status: 401 }
    );
  }

  if (usuario.memberships.length === 0) {
    return NextResponse.json(
      { erro: "Sua conta não está vinculada a nenhuma organização." },
      { status: 403 }
    );
  }

  limparFalhas(chave);

  // Hash antigo (menos iterações) sobe para o padrão atual sem a pessoa
  // trocar de senha. É como as contas migradas de DASH_USERS se atualizam.
  if (precisaRehash(usuario.senhaHash)) {
    await prisma.user.update({
      where: { id: usuario.id },
      data: { senhaHash: await hashSenha(dados.data.senha) },
    });
  }

  await prisma.user.update({
    where: { id: usuario.id },
    data: { ultimoLoginEm: new Date() },
  });

  const token = await criarSessao(
    usuario.id,
    ip,
    req.headers.get("user-agent") ?? undefined
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_IDADE_COOKIE,
  });
  return res;
}

import { NextResponse } from "next/server";
import { busca } from "@mark/core";
import { SemAcesso, exigirContexto } from "@/lib/sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Busca global.
 *
 * Rota de API, e não Server Action, porque a busca dispara a cada tecla: o
 * cliente precisa cancelar a requisição anterior com `AbortController`, e
 * Server Action não é cancelável.
 *
 * O `Contexto` é resolvido aqui e passado ao core, então cada tipo de resultado
 * só é consultado se a permissão existir. O que a pessoa não pode abrir não
 * volta — nem como título.
 */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await exigirContexto();
  } catch (e) {
    if (e instanceof SemAcesso) {
      return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
    }
    throw e;
  }

  const termo = new URL(req.url).searchParams.get("q") ?? "";
  if (termo.trim().length < 2) {
    return NextResponse.json({ resultados: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const resultados = await busca.global(ctx, termo);
    return NextResponse.json({ resultados }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Busca falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Busca indisponível." }, { status: 500 });
  }
}

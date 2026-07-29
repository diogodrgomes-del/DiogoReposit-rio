import { NextResponse } from "next/server";
import { ErroMeta, carregarPainel } from "@/lib/meta";
import { PERIODOS, diasEntre, validarData } from "@/lib/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const periodoId = url.searchParams.get("periodo") ?? "last_30d";
  const contaId = url.searchParams.get("conta");
  const since = validarData(url.searchParams.get("since"));
  const until = validarData(url.searchParams.get("until"));

  // Conta so pode ser um id no formato act_<digitos>; "todas" vira null.
  const conta =
    contaId && contaId !== "todas" && /^act_\d+$/.test(contaId) ? contaId : null;

  let preset: string | null = null;
  let dias: number | null = null;

  if (periodoId === "custom") {
    if (!since || !until) {
      return NextResponse.json(
        { erro: "Período personalizado exige as duas datas." },
        { status: 400 }
      );
    }
    if (since > until) {
      return NextResponse.json(
        { erro: "A data inicial não pode ser depois da final." },
        { status: 400 }
      );
    }
    dias = diasEntre(since, until);
  } else {
    const p = PERIODOS.find((x) => x.id === periodoId);
    if (!p) {
      return NextResponse.json({ erro: "Período desconhecido." }, { status: 400 });
    }
    preset = p.preset ?? null;
    dias = p.dias;
  }

  try {
    const painel = await carregarPainel({
      contaId: conta,
      preset,
      since: preset ? null : since,
      until: preset ? null : until,
      dias,
    });
    return NextResponse.json(painel, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    const erro = e as Error;
    if (erro instanceof ErroMeta) {
      console.error("Erro da Meta:", erro.message);
      return NextResponse.json({ erro: erro.message }, { status: 502 });
    }
    console.error("Falha ao carregar painel:", erro.message);
    return NextResponse.json(
      { erro: "Não foi possível carregar os dados agora." },
      { status: 500 }
    );
  }
}

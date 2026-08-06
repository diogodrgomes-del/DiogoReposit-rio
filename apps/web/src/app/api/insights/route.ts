import { NextResponse } from "next/server";
import { listarClientes, tokenDe } from "@/lib/clientes";
import { ErroMeta, carregarPainel } from "@/lib/meta";
import { resolverJanela } from "@/lib/periodo";
import { aliquotaDe } from "@/lib/impostos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  const janela = resolverJanela(params);
  if (!janela.ok) {
    return NextResponse.json({ erro: janela.erro }, { status: 400 });
  }

  // Sem cliente na URL, usa o primeiro da carteira.
  const pedido = params.get("cliente");
  const primeiro = listarClientes()[0];
  const clienteId = pedido || primeiro?.id;

  if (!clienteId) {
    return NextResponse.json(
      { erro: "Nenhum cliente configurado. Preencha META_TOKENS no servidor." },
      { status: 500 }
    );
  }

  const token = tokenDe(clienteId);
  if (!token) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  // Conta só pode ser act_<dígitos>; qualquer outra coisa vira "todas".
  const contaBruta = params.get("conta");
  const conta =
    contaBruta && contaBruta !== "todas" && /^act_\d+$/.test(contaBruta)
      ? contaBruta
      : null;

  try {
    const painel = await carregarPainel({
      token,
      contaId: conta,
      preset: janela.janela.preset,
      since: janela.janela.since,
      until: janela.janela.until,
      dias: janela.janela.dias,
    });
    return NextResponse.json(
      { ...painel, clienteId, aliquotaImposto: aliquotaDe(clienteId) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
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

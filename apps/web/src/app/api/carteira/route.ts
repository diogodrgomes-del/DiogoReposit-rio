import { NextResponse } from "next/server";
import { lerAcesso } from "@/lib/sessao";
import { clientesComToken } from "@/lib/clientes";
import { carregarCarteira } from "@mark/integracoes/meta-ads";
import { resolverJanela } from "@mark/integracoes/meta-ads";
import { aliquotaDe } from "@/lib/impostos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Oito clientes em sequencia passam do limite padrao de 10 s da Vercel.
export const maxDuration = 60;

export async function GET(req: Request) {
  // O middleware confere só a presença do cookie de sessão do MARK SISTEM; a
  // validação real, com consulta ao banco e checagem de revogação, é aqui.
  if (!(await lerAcesso())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const janela = resolverJanela(new URL(req.url).searchParams);
  if (!janela.ok) {
    return NextResponse.json({ erro: janela.erro }, { status: 400 });
  }

  const clientes = clientesComToken();
  if (clientes.length === 0) {
    return NextResponse.json(
      { erro: "Nenhum cliente configurado. Preencha META_TOKENS no servidor." },
      { status: 500 }
    );
  }

  try {
    const carteira = await carregarCarteira(clientes, {
      preset: janela.janela.preset,
      since: janela.janela.since,
      until: janela.janela.until,
    });
    // Cada cliente pode ter alíquota própria; a tela soma o imposto de cada um.
    const comImposto = {
      ...carteira,
      clientes: carteira.clientes.map((c) => ({
        ...c,
        aliquotaImposto: aliquotaDe(c.clienteId),
      })),
    };
    return NextResponse.json(comImposto, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    console.error("Falha ao carregar carteira:", (e as Error).message);
    return NextResponse.json(
      { erro: "Não foi possível carregar a carteira agora." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { listarClientes, tokenDe } from "@/lib/clientes";
import {
  alteraEntrega,
  carregarAlteracoes,
  carregarImpactos,
  listarContas,
} from "@mark/integracoes/meta-ads";
import {
  apagarAnotacao,
  bancoConfigurado,
  criarAnotacao,
  listarAnotacoes,
} from "@/lib/registro";
import { lerAcesso } from "@/lib/sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_TEXTO = 2000;
/** Dias comparados antes e depois de cada anotação. */
const JANELA_DIAS = 3;

/**
 * Quem assina a anotação.
 *
 * No modo legado é o nome de usuário do `DASH_USERS`; no modo banco, o id do
 * usuário. As anotações antigas continuam com o autor que tinham — a coluna é
 * texto livre, e reescrevê-las inventaria uma autoria que não foi registrada.
 */
async function usuarioAtual(): Promise<string | null> {
  const acesso = await lerAcesso();
  return acesso?.usuario ?? null;
}

function clienteValido(id: string | null): string | null {
  if (!id) return null;
  return listarClientes().some((c) => c.id === id) ? id : null;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const clienteId = clienteValido(params.get("cliente"));
  if (!clienteId) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  const token = tokenDe(clienteId);
  const desde = params.get("desde");

  // As duas metades são independentes: se a Meta falhar, as anotações ainda
  // aparecem, e vice-versa. Um registro de trabalho não pode sumir porque a
  // API de terceiro teve um soluço.
  const contas = token ? await listarContas(token).catch(() => []) : [];

  const [anotacoes, alteracoes] = await Promise.all([
    listarAnotacoes(clienteId).catch(() => []),
    token && contas.length
      ? carregarAlteracoes(token, contas, desde).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Dias com anotação OU com alteração que mexe na entrega. Medir por dia, e
  // não por evento, é o que o dado suporta: se três coisas mudaram no mesmo
  // dia, não dá para atribuir o efeito a uma delas.
  //
  // O recorte de 180 dias existe porque puxar série diária de um ano inteiro
  // para medir alteração antiga não paga o custo da chamada.
  const limite = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const datas = [
    ...new Set([
      ...anotacoes.map((a) => a.criadoEm.slice(0, 10)),
      ...alteracoes.filter(alteraEntrega).map((a) => a.quando.slice(0, 10)),
    ]),
  ].filter((d) => d >= limite);

  const impactos =
    token && contas.length && datas.length
      ? await carregarImpactos(token, contas, datas, JANELA_DIAS).catch(() => [])
      : [];

  return NextResponse.json(
    {
      anotacoes,
      alteracoes,
      impactos,
      janelaImpacto: JANELA_DIAS,
      bancoConfigurado: bancoConfigurado(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: Request) {
  const autor = await usuarioAtual();
  if (!autor) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  if (!bancoConfigurado()) {
    return NextResponse.json(
      {
        erro:
          "Banco de anotações não configurado. Cadastre DATABASE_URL no servidor " +
          "e faça um novo deploy.",
      },
      { status: 503 }
    );
  }

  let corpo: { cliente?: string; texto?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const clienteId = clienteValido(corpo.cliente ?? null);
  if (!clienteId) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  const texto = String(corpo.texto ?? "").trim();
  if (!texto) {
    return NextResponse.json({ erro: "Escreva algo antes de salvar." }, { status: 400 });
  }
  if (texto.length > LIMITE_TEXTO) {
    return NextResponse.json(
      { erro: `Máximo de ${LIMITE_TEXTO} caracteres.` },
      { status: 400 }
    );
  }

  try {
    const nova = await criarAnotacao(clienteId, autor, texto);
    return NextResponse.json({ anotacao: nova }, { status: 201 });
  } catch (e) {
    console.error("Falha ao salvar anotação:", (e as Error).message);
    return NextResponse.json({ erro: "Não foi possível salvar." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const autor = await usuarioAtual();
  if (!autor) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ erro: "Identificador inválido." }, { status: 400 });
  }
  try {
    const ok = await apagarAnotacao(id, autor);
    // Não distingue "não existe" de "é de outro autor": ambos são 404 para
    // quem pediu, e a diferença só serviria para mapear o que os outros escreveram.
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ erro: "Anotação não encontrada." }, { status: 404 });
  } catch (e) {
    console.error("Falha ao apagar anotação:", (e as Error).message);
    return NextResponse.json({ erro: "Não foi possível apagar." }, { status: 500 });
  }
}

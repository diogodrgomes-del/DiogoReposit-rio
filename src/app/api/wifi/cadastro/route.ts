import { NextResponse } from "next/server";
import {
  extrairParametrosAp,
  registrarVisitante,
  urlLiberacao,
  validarCadastro,
} from "@/lib/portal";

export const runtime = "nodejs";

/**
 * Acesso por formulário: o visitante deixa nome, e-mail e (opcional) telefone
 * em vez de entrar com rede social. Registra o lead e devolve para onde seguir
 * — o endereço que libera a internet no roteador, ou a tela de "conectado".
 *
 * Ao contrário do OAuth, não há ida e volta a um site externo, então não é
 * preciso estado assinado: os parâmetros do roteador chegam no próprio corpo.
 */
export async function POST(req: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const validado = validarCadastro(corpo);
  if (!validado.ok) {
    return NextResponse.json({ erro: validado.erro }, { status: 400 });
  }

  const ap = extrairParametrosAp(
    new URLSearchParams(
      corpo.ap && typeof corpo.ap === "object"
        ? (corpo.ap as Record<string, string>)
        : {}
    )
  );

  await registrarVisitante(
    {
      provedor: "cadastro",
      idExterno: validado.dados.email,
      nome: validado.dados.nome,
      email: validado.dados.email,
      telefone: validado.dados.telefone,
    },
    ap
  );

  const liberar = urlLiberacao(ap);
  if (liberar) {
    return NextResponse.json({ destino: liberar });
  }

  const conectado = new URL("/wifi/conectado", new URL(req.url).origin);
  conectado.searchParams.set("nome", validado.dados.nome);
  return NextResponse.json({ destino: conectado.toString() });
}

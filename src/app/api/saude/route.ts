import { NextResponse } from "next/server";
import { temSessionSecret, totalUsuarios } from "@/lib/auth";
import { listarClientes } from "@/lib/clientes";
import { temImpostoConfigurado } from "@/lib/impostos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checagem de configuracao, aberta de proposito.
 *
 * Sem ela, um servidor mal configurado so se manifesta como "senha incorreta"
 * na tela de login — e nao da para autenticar para investigar, porque e
 * justamente a autenticacao que esta quebrada.
 *
 * Devolve apenas se cada variavel esta presente e quantos itens tem. Nunca o
 * conteudo: nem token, nem hash, nem segredo de sessao.
 */
export async function GET() {
  const clientes = listarClientes();
  const usuarios = totalUsuarios();
  const segredo = temSessionSecret();

  const pendencias: string[] = [];
  if (usuarios === 0) pendencias.push("DASH_USERS vazia ou mal formatada");
  if (!segredo) pendencias.push("SESSION_SECRET ausente ou com menos de 32 caracteres");
  if (clientes.length === 0) pendencias.push("META_TOKENS vazia ou mal formatada");

  return NextResponse.json(
    {
      ok: pendencias.length === 0,
      usuariosCadastrados: usuarios,
      sessionSecretOk: segredo,
      clientesCadastrados: clientes.length,
      impostoConfigurado: temImpostoConfigurado(),
      // Só os nomes, para conferir se as linhas foram lidas como esperado.
      clientes: clientes.map((c) => c.nome),
      pendencias,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

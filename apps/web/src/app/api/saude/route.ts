import { NextResponse } from "next/server";
import { cofreConfigurado } from "@mark/cofre";
import { temSessionSecret, totalUsuarios } from "@/lib/auth";
import { listarClientes } from "@/lib/clientes";
import { temImpostoConfigurado } from "@/lib/impostos";
import { bancoConfigurado } from "@/lib/registro";

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
 * conteudo: nem token, nem hash, nem segredo de sessao, nem chave do cofre.
 */

/**
 * Quantas migrações já foram aplicadas.
 *
 * Serve para distinguir três estados que na tela de login parecem o mesmo:
 * banco ausente, banco presente e vazio, banco pronto. Falhar aqui não é erro
 * do endpoint — é a resposta.
 */
async function estadoDoBanco(): Promise<{ migracoes: number | null; erro: string | null }> {
  if (!bancoConfigurado()) return { migracoes: null, erro: null };
  try {
    // Importação dinâmica: sem DATABASE_URL o driver nem chega a ser carregado.
    const { migracoesAplicadas } = await import("@mark/db");
    const n = await migracoesAplicadas();
    return { migracoes: n, erro: n === null ? "sem resposta do banco" : null };
  } catch (e) {
    return { migracoes: null, erro: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}

export async function GET() {
  const clientes = listarClientes();
  const usuarios = totalUsuarios();
  const segredo = temSessionSecret();
  const banco = await estadoDoBanco();
  const cofre = cofreConfigurado();

  const pendencias: string[] = [];

  // Sem banco, o login legado é o único caminho — aí DASH_USERS volta a ser
  // obrigatória. Com banco migrado e semeado, ela deixa de ser.
  const legadoEhUnicoCaminho = !banco.migracoes;
  if (legadoEhUnicoCaminho && usuarios === 0) {
    pendencias.push("DASH_USERS vazia e nenhum banco migrado — ninguém consegue entrar");
  }
  if (!segredo && legadoEhUnicoCaminho) {
    pendencias.push("SESSION_SECRET ausente ou com menos de 32 caracteres");
  }
  if (clientes.length === 0) pendencias.push("META_TOKENS vazia ou mal formatada");
  if (banco.erro) pendencias.push(`Banco inacessível: ${banco.erro}`);
  if (bancoConfigurado() && banco.migracoes === 0) {
    pendencias.push("Banco configurado mas sem migrações — rode npm run db:migrar");
  }
  if (bancoConfigurado() && !cofre) {
    pendencias.push("COFRE_KEKS ausente — a importação dos tokens não roda sem ela");
  }

  return NextResponse.json(
    {
      ok: pendencias.length === 0,
      modoDeLogin: banco.migracoes ? "banco (e-mail) + legado (usuário)" : "legado (usuário)",
      usuariosCadastrados: usuarios,
      sessionSecretOk: segredo,
      clientesCadastrados: clientes.length,
      impostoConfigurado: temImpostoConfigurado(),
      bancoConfigurado: bancoConfigurado(),
      migracoesAplicadas: banco.migracoes,
      cofreConfigurado: cofre,
      // Só os nomes, para conferir se as linhas foram lidas como esperado.
      clientes: clientes.map((c) => c.nome),
      pendencias,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

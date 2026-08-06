"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeAutorizacao, ErroDeValidacao, clientes } from "@mark/core";
import type { DadosCliente, SaudeCliente, StatusCliente } from "@mark/core";
import { exigirContexto } from "@/lib/sessao";

/**
 * Server Actions de clientes.
 *
 * Fina de propósito: lê o formulário, chama `@mark/core` e traduz o erro para a
 * tela. Nenhuma regra de negócio mora aqui — nem a checagem de permissão, que
 * acontece dentro do core. Se alguém chamar essas funções por outro caminho, a
 * autorização continua valendo.
 */

export type EstadoForm = {
  erro?: string;
  campo?: string;
};

/**
 * Traduz exceções para mensagem de tela.
 *
 * `ErroDeAutorizacao` com `ocultar` vira "não encontrado": o mesmo cuidado do
 * 404 nas rotas de financeiro e credenciais — não confirmar que existe algo ali.
 */
function traduzir(e: unknown): EstadoForm {
  if (e instanceof ErroDeValidacao) return { erro: e.message, campo: e.campo };
  if (e instanceof ErroDeAutorizacao) {
    return { erro: e.ocultar ? "Não encontrado." : "Você não tem permissão para isso." };
  }
  console.error("Falha em ação de cliente:", e instanceof Error ? e.message : e);
  return { erro: "Não foi possível salvar. Tente de novo." };
}

/** Campo vazio no formulário significa "sem valor", não string vazia. */
function texto(f: FormData, chave: string): string | null {
  const v = f.get(chave);
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo === "" ? null : limpo;
}

function lerFormulario(f: FormData): DadosCliente {
  return {
    nome: texto(f, "nome") ?? "",
    nomeFantasia: texto(f, "nomeFantasia"),
    cnpj: texto(f, "cnpj"),
    segmento: texto(f, "segmento"),
    telefoneE164: texto(f, "telefone"),
    email: texto(f, "email"),
    cidade: texto(f, "cidade"),
    estado: texto(f, "estado"),
    instagram: texto(f, "instagram"),
    site: texto(f, "site"),
    responsavelId: texto(f, "responsavelId"),
    status: (texto(f, "status") ?? undefined) as StatusCliente | undefined,
    saude: (texto(f, "saude") ?? undefined) as SaudeCliente | undefined,
    observacoes: texto(f, "observacoes"),
  };
}

export async function criarCliente(
  _estado: EstadoForm,
  formulario: FormData,
): Promise<EstadoForm> {
  let id: string;
  try {
    const ctx = await exigirContexto();
    const cliente = await clientes.criar(ctx, lerFormulario(formulario));
    id = cliente.id;
  } catch (e) {
    return traduzir(e);
  }

  // Fora do try: `redirect` funciona lançando uma exceção, e capturá-la aqui
  // transformaria a navegação em "não foi possível salvar".
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function salvarCliente(
  _estado: EstadoForm,
  formulario: FormData,
): Promise<EstadoForm> {
  const id = formulario.get("id");
  if (typeof id !== "string" || !id) return { erro: "Cliente não informado." };

  try {
    const ctx = await exigirContexto();
    const atualizado = await clientes.atualizar(ctx, id, lerFormulario(formulario));
    if (!atualizado) return { erro: "Cliente não encontrado." };
  } catch (e) {
    return traduzir(e);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}?salvo=1`);
}

export async function excluirCliente(formulario: FormData): Promise<void> {
  const id = formulario.get("id");
  if (typeof id !== "string" || !id) return;

  const ctx = await exigirContexto();
  await clientes.excluir(ctx, id);

  revalidatePath("/clientes");
  redirect("/clientes?excluido=1");
}

export async function restaurarCliente(formulario: FormData): Promise<void> {
  const id = formulario.get("id");
  if (typeof id !== "string" || !id) return;

  const ctx = await exigirContexto();
  await clientes.restaurar(ctx, id);

  revalidatePath("/clientes");
  revalidatePath("/clientes/lixeira");
  redirect(`/clientes/${id}`);
}

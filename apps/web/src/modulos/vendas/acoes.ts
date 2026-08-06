"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeAutorizacao, ErroDeValidacao, leads } from "@mark/core";
import { exigirContexto } from "@/lib/sessao";

export type EstadoForm = { erro?: string; campo?: string };

function traduzir(e: unknown): EstadoForm {
  if (e instanceof ErroDeValidacao) return { erro: e.message, campo: e.campo };
  if (e instanceof ErroDeAutorizacao) {
    return { erro: e.ocultar ? "Não encontrado." : "Você não tem permissão para isso." };
  }
  console.error("Falha em ação de lead:", e instanceof Error ? e.message : e);
  return { erro: "Não foi possível salvar. Tente de novo." };
}

const texto = (f: FormData, k: string): string | null => {
  const v = f.get(k);
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo === "" ? null : limpo;
};

export async function criarLead(_estado: EstadoForm, formulario: FormData): Promise<EstadoForm> {
  try {
    const ctx = await exigirContexto();
    const valor = texto(formulario, "valorEstimado");

    await leads.criar(ctx, {
      // Os dois únicos campos obrigatórios do cadastro (requisito 7.3).
      nome: texto(formulario, "nome") ?? "",
      telefone: texto(formulario, "telefone") ?? "",
      empresa: texto(formulario, "empresa"),
      email: texto(formulario, "email"),
      origem: texto(formulario, "origem"),
      servico: texto(formulario, "servico"),
      cidade: texto(formulario, "cidade"),
      temperatura: texto(formulario, "temperatura"),
      responsavelId: texto(formulario, "responsavelId"),
      observacoes: texto(formulario, "observacoes"),
      valorEstimado: valor ? Number(valor.replace(",", ".")) : null,
    });
  } catch (e) {
    return traduzir(e);
  }

  revalidatePath("/vendas");
  redirect("/vendas");
}

/**
 * Chamada pelo arrasto do Kanban.
 *
 * Devolve `{ ok }` em vez de redirecionar: a tela já moveu o card
 * otimisticamente, e uma navegação aqui desfaria a posição de rolagem e o
 * estado do quadro.
 */
export async function moverLead(
  leadId: string,
  etapaId: string,
  antesDe: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const ctx = await exigirContexto();
    await leads.mover(ctx, leadId, etapaId, antesDe);
    revalidatePath("/vendas");
    return { ok: true };
  } catch (e) {
    const t = traduzir(e);
    return { ok: false, erro: t.erro };
  }
}

export async function excluirLead(formulario: FormData): Promise<void> {
  const id = formulario.get("id");
  if (typeof id !== "string" || !id) return;

  const ctx = await exigirContexto();
  await leads.excluir(ctx, id);
  revalidatePath("/vendas");
  redirect("/vendas");
}

export async function registrarMotivoPerda(formulario: FormData): Promise<void> {
  const id = formulario.get("id");
  if (typeof id !== "string" || !id) return;

  const ctx = await exigirContexto();
  // Motivo pode vir vazio: o briefing permite pular o preenchimento.
  await leads.registrarPerda(ctx, id, texto(formulario, "motivo"));
  revalidatePath("/vendas");
  redirect(`/vendas/${id}`);
}

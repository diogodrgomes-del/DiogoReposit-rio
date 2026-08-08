"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirAtor, ipDaRequisicao, stepUpValido } from "@/lib/auth/sessao";
import { exigir } from "@/lib/auth/can";
import { auditar } from "@/lib/auditoria";
import {
  falha,
  sucesso,
  tratarErro,
  textoOpcional,
  idOpcional,
  type Resultado,
} from "@/lib/acoes";
import type { Ator } from "@/lib/auth/sessao";

/**
 * Barreira do domínio financeiro.
 *
 * O escopo PESSOAL é do proprietário e de mais ninguém — nem do ADMIN. E exige
 * re-autenticação recente: o cenário real não é invasão remota, é notebook
 * desbloqueado em cima da mesa.
 */
function permitirEscopo(ator: Ator, escopo: "EMPRESA" | "PESSOAL", acao: "ler" | "criar" | "editar" | "excluir") {
  if (escopo === "EMPRESA") {
    exigir(ator, `financeiro.empresa:${acao}` as "financeiro.empresa:ler");
    return null;
  }
  if (ator.papel !== "PROPRIETARIO") {
    // 404 semântico, não 403: confirmar que existe já é informação.
    return falha("Não encontrado.");
  }
  exigir(ator, `financeiro.pessoal:${acao}` as "financeiro.pessoal:ler");
  if (!stepUpValido(ator)) {
    return falha("Confirme sua senha para acessar o financeiro pessoal.");
  }
  return null;
}

const NovoLancamento = z.object({
  escopo: z.enum(["EMPRESA", "PESSOAL"]).default("EMPRESA"),
  tipo: z.enum(["RECEITA", "DESPESA"]),
  descricao: z.string().trim().min(2, "Descreva o lançamento."),
  valor: z.string().trim().min(1, "Informe o valor."),
  vencimentoEm: z.string().trim().min(1, "Informe o vencimento."),
  clientId: idOpcional,
  categoryId: idOpcional,
  fornecedor: textoOpcional,
  formaPagamento: textoOpcional,
  recorrente: z.boolean().default(false),
  observacoes: textoOpcional,
});

/** "1.234,56" → 123456 centavos. Aceita o que a pessoa realmente digita. */
function centavos(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return 0;
  const v = limpo.lastIndexOf(",");
  const p = limpo.lastIndexOf(".");
  const norm =
    v > p
      ? limpo.replace(/\./g, "").replace(",", ".")
      : p > v
        ? limpo.replace(/,/g, "")
        : limpo.replace(/[.,]/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function criarLancamento(
  entrada: z.input<typeof NovoLancamento>
): Promise<Resultado<{ id: string }>> {
  try {
    const ator = await exigirAtor();
    const d = NovoLancamento.parse(entrada);

    const bloqueio = permitirEscopo(ator, d.escopo, "criar");
    if (bloqueio) return bloqueio;

    const valorCents = centavos(d.valor);
    if (valorCents <= 0) {
      return falha("Valor inválido.", { valor: "Informe um valor maior que zero." });
    }

    const vencimento = new Date(d.vencimentoEm);
    if (Number.isNaN(vencimento.getTime())) {
      return falha("Data inválida.", { vencimentoEm: "Confira a data." });
    }

    const id = await prisma.$transaction(async (tx) => {
      const entry = await tx.finEntry.create({
        data: {
          organizationId: ator.organizationId,
          escopo: d.escopo,
          // O CHECK do banco garante que pessoal nunca fique sem dono.
          ownerUserId: d.escopo === "PESSOAL" ? ator.userId : null,
          tipo: d.tipo,
          descricao: d.descricao,
          clientId: d.escopo === "EMPRESA" ? d.clientId : null,
          categoryId: d.categoryId,
          fornecedor: d.fornecedor,
          formaPagamento: d.formaPagamento,
          valorCents,
          vencimentoEm: vencimento,
          competenciaEm: vencimento,
          recorrente: d.recorrente,
          observacoes: d.observacoes,
          status: "PENDENTE",
        },
      });

      await auditar(tx, ator, {
        acao: "financeiro.lancamento.criado",
        entidadeTipo: "fin_entry",
        entidadeId: entry.id,
        resumo: `${d.tipo === "RECEITA" ? "Receita" : "Despesa"} "${d.descricao}" lançada`,
        depois: { valorCents, escopo: d.escopo, tipo: d.tipo },
        ip: await ipDaRequisicao(),
      });

      return entry.id;
    });

    revalidatePath("/financeiro");
    revalidatePath("/");
    return sucesso({ id });
  } catch (e) {
    return tratarErro(e);
  }
}

/**
 * Baixa de lançamento, total ou parcial.
 *
 * Pagamento parcial vira linha em fin_payments — guardar só o total pago
 * perderia a data e a forma de cada parcela, que é o que o cliente pergunta
 * quando reclama de cobrança.
 */
export async function registrarPagamento(
  entryId: string,
  valorTexto?: string
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();

    const entry = await prisma.finEntry.findFirst({
      where: { id: entryId, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!entry) return falha("Lançamento não encontrado.");

    const bloqueio = permitirEscopo(ator, entry.escopo, "editar");
    if (bloqueio) return bloqueio;

    // Escopo pessoal de outra pessoa não é alcançável nem pelo proprietário.
    if (entry.escopo === "PESSOAL" && entry.ownerUserId !== ator.userId) {
      return falha("Não encontrado.");
    }

    const restante = entry.valorCents - entry.valorPagoCents;
    const valor = valorTexto ? centavos(valorTexto) : restante;

    if (valor <= 0) return falha("Valor inválido.");
    if (valor > restante) {
      return falha(
        `Valor maior que o saldo em aberto (${(restante / 100).toFixed(2)}).`
      );
    }

    const pagoTotal = entry.valorPagoCents + valor;
    const quitado = pagoTotal >= entry.valorCents;

    await prisma.$transaction(async (tx) => {
      await tx.finPayment.create({
        data: { entryId, valorCents: valor, dataEm: new Date() },
      });

      await tx.finEntry.update({
        where: { id: entryId },
        data: {
          valorPagoCents: pagoTotal,
          quitadoEm: quitado ? new Date() : null,
          status: quitado
            ? entry.tipo === "RECEITA"
              ? "RECEBIDO"
              : "PAGO"
            : "PENDENTE",
        },
      });

      await auditar(tx, ator, {
        acao: "financeiro.baixa",
        entidadeTipo: "fin_entry",
        entidadeId: entryId,
        resumo: `${quitado ? "Baixa total" : "Baixa parcial"} de "${entry.descricao}"`,
        antes: { valorPagoCents: entry.valorPagoCents },
        depois: { valorPagoCents: pagoTotal },
      });
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/a-pagar");
    revalidatePath("/financeiro/a-receber");
    revalidatePath("/");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function excluirLancamento(entryId: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();

    const entry = await prisma.finEntry.findFirst({
      where: { id: entryId, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!entry) return falha("Lançamento não encontrado.");

    const bloqueio = permitirEscopo(ator, entry.escopo, "excluir");
    if (bloqueio) return bloqueio;
    if (entry.escopo === "PESSOAL" && entry.ownerUserId !== ator.userId) {
      return falha("Não encontrado.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.finEntry.update({
        where: { id: entryId },
        data: { deletadoEm: new Date() },
      });
      await auditar(tx, ator, {
        acao: "financeiro.lancamento.excluido",
        entidadeTipo: "fin_entry",
        entidadeId: entryId,
        resumo: `Lançamento "${entry.descricao}" enviado para a lixeira`,
      });
    });

    revalidatePath("/financeiro");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

/** Re-autenticação para o financeiro pessoal. Vale 15 minutos. */
export async function confirmarSenha(senha: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    const { conferirSenha } = await import("@/lib/auth/senha");
    const { registrarStepUp } = await import("@/lib/auth/sessao");

    const user = await prisma.user.findUnique({
      where: { id: ator.userId },
      select: { senhaHash: true },
    });

    const ok = await conferirSenha(senha, user?.senhaHash);
    if (!ok) return falha("Senha incorreta.");

    await registrarStepUp(ator.sessionId);
    revalidatePath("/financeiro/pessoal");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

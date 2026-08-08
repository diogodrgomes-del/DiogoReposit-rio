"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirAtor } from "@/lib/auth/sessao";
import { exigir, podeCliente } from "@/lib/auth/can";
import { auditar, notificar } from "@/lib/auditoria";
import {
  falha,
  sucesso,
  tratarErro,
  textoOpcional,
  idOpcional,
  type Resultado,
} from "@/lib/acoes";

const NovoEvento = z.object({
  titulo: z.string().trim().min(2, "Informe o título."),
  tipo: z
    .enum([
      "REUNIAO", "GRAVACAO", "VISITA", "ENTREGA", "PRODUCAO",
      "CAMPANHA", "PRAZO", "EVENTO", "VIAGEM", "INTERNO", "FOLLOWUP",
    ])
    .default("REUNIAO"),
  clientId: idOpcional,
  inicioEm: z.string().trim().min(1, "Informe a data e hora."),
  duracaoMin: z.coerce.number().int().min(0).default(60),
  local: textoOpcional,
  linkReuniao: textoOpcional,
  descricao: textoOpcional,
  participantes: z.array(z.string()).default([]),
});

export async function criarEvento(
  entrada: z.input<typeof NovoEvento>
): Promise<Resultado<{ id: string }>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "agenda:criar");
    const d = NovoEvento.parse(entrada);

    if (d.clientId && !podeCliente(ator, d.clientId)) {
      return falha("Sem acesso a este cliente.");
    }

    const inicio = new Date(d.inicioEm);
    if (Number.isNaN(inicio.getTime())) {
      return falha("Data inválida.", { inicioEm: "Confira a data." });
    }
    const fim = new Date(inicio.getTime() + d.duracaoMin * 60_000);

    const id = await prisma.$transaction(async (tx) => {
      const evento = await tx.event.create({
        data: {
          organizationId: ator.organizationId,
          tipo: d.tipo,
          titulo: d.titulo,
          descricao: d.descricao,
          clientId: d.clientId,
          inicioEm: inicio,
          fimEm: fim,
          local: d.local,
          linkReuniao: d.linkReuniao,
          // Gravação nasce como planejada — o fluxo dela tem status próprio.
          statusGravacao: d.tipo === "GRAVACAO" ? "PLANEJADA" : null,
          participantes: {
            create: Array.from(new Set([ator.userId, ...d.participantes])).map(
              (userId) => ({ userId })
            ),
          },
        },
      });

      await auditar(tx, ator, {
        acao: "evento.criado",
        entidadeTipo: "evento",
        entidadeId: evento.id,
        resumo: `Evento "${d.titulo}" agendado`,
        depois: { inicio: inicio.toISOString(), tipo: d.tipo },
      });

      for (const userId of d.participantes) {
        if (userId === ator.userId) continue;
        await notificar(tx, {
          organizationId: ator.organizationId,
          userId,
          tipo: "evento.convite",
          titulo: `Novo compromisso: ${d.titulo}`,
          corpo: inicio.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
          url: `/agenda/${evento.id}`,
        });
      }

      return evento.id;
    });

    revalidatePath("/agenda");
    revalidatePath("/");
    return sucesso({ id });
  } catch (e) {
    return tratarErro(e);
  }
}

export async function cancelarEvento(id: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "agenda:editar");

    const evento = await prisma.event.findFirst({
      where: { id, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!evento) return falha("Evento não encontrado.");

    await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: { canceladoEm: new Date() },
      });
      await auditar(tx, ator, {
        acao: "evento.cancelado",
        entidadeTipo: "evento",
        entidadeId: id,
        resumo: `Evento "${evento.titulo}" cancelado`,
      });
    });

    revalidatePath("/agenda");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function atualizarStatusGravacao(
  id: string,
  status: string
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "agenda:editar");

    const valido = z
      .enum([
        "PLANEJADA", "CONFIRMADA", "AGUARDANDO_ROTEIRO",
        "PRONTA", "REALIZADA", "CANCELADA", "REAGENDADA",
      ])
      .parse(status);

    const evento = await prisma.event.findFirst({
      where: { id, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!evento) return falha("Evento não encontrado.");

    await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: { statusGravacao: valido },
      });
      await auditar(tx, ator, {
        acao: "gravacao.status",
        entidadeTipo: "evento",
        entidadeId: id,
        resumo: `Gravação "${evento.titulo}": ${valido.toLowerCase().replace("_", " ")}`,
        antes: { status: evento.statusGravacao },
        depois: { status: valido },
      });
    });

    revalidatePath("/agenda");
    revalidatePath("/agenda/gravacoes");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

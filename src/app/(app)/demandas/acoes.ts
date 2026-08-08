"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirAtor } from "@/lib/auth/sessao";
import { exigir, podeCliente, can } from "@/lib/auth/can";
import { auditar, notificar } from "@/lib/auditoria";
import {
  falha,
  sucesso,
  tratarErro,
  textoOpcional,
  idOpcional,
  dataOpcional,
  type Resultado,
} from "@/lib/acoes";

/** Obrigatório: título, e cliente OU projeto interno. Nada mais. */
const NovaDemanda = z.object({
  titulo: z.string().trim().min(2, "Informe o título."),
  clientId: idOpcional,
  interno: z.boolean().optional(),
  descricao: textoOpcional,
  tipoId: idOpcional,
  responsavelId: idOpcional,
  prioridade: z.enum(["BAIXA", "NORMAL", "ALTA", "URGENTE"]).default("NORMAL"),
  prazoEm: dataOpcional,
  stageId: idOpcional,
});

export async function criarDemanda(
  entrada: z.input<typeof NovaDemanda>
): Promise<Resultado<{ id: string }>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "demandas:criar");
    const d = NovaDemanda.parse(entrada);

    if (!d.clientId && !d.interno) {
      return falha("Escolha um cliente ou marque como interna.", {
        clientId: "Obrigatório.",
      });
    }
    if (d.clientId && !podeCliente(ator, d.clientId)) {
      return falha("Sem acesso a este cliente.");
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: ator.organizationId, tipo: "OPERACIONAL" },
      include: { etapas: { orderBy: { ordem: "asc" } } },
    });
    if (!pipeline || pipeline.etapas.length === 0) {
      return falha("Nenhum pipeline operacional configurado.");
    }

    const etapa =
      pipeline.etapas.find((e) => e.id === d.stageId) ?? pipeline.etapas[0];

    const id = await prisma.$transaction(async (tx) => {
      const primeiro = await tx.demand.findFirst({
        where: { stageId: etapa.id, deletadoEm: null },
        orderBy: { posicao: "asc" },
        select: { posicao: true },
      });

      const demanda = await tx.demand.create({
        data: {
          organizationId: ator.organizationId,
          titulo: d.titulo,
          descricao: d.descricao,
          clientId: d.clientId,
          pipelineId: pipeline.id,
          stageId: etapa.id,
          tipoId: d.tipoId,
          prioridade: d.prioridade,
          responsavelId: d.responsavelId,
          prazoEm: d.prazoEm,
          posicao: primeiro ? primeiro.posicao - 1000 : 1000,
        },
      });

      await auditar(tx, ator, {
        acao: "demanda.criada",
        entidadeTipo: "demanda",
        entidadeId: demanda.id,
        resumo: `Demanda "${d.titulo}" criada`,
        depois: { titulo: d.titulo, prioridade: d.prioridade },
      });

      // Quem foi atribuído precisa saber. Não notifica quem atribuiu a si.
      if (d.responsavelId && d.responsavelId !== ator.userId) {
        await notificar(tx, {
          organizationId: ator.organizationId,
          userId: d.responsavelId,
          tipo: "demanda.atribuida",
          titulo: `Nova demanda: ${d.titulo}`,
          corpo: `${ator.nome} atribuiu esta demanda a você.`,
          url: `/demandas/${demanda.id}`,
        });
      }

      return demanda.id;
    });

    revalidatePath("/demandas");
    revalidatePath("/");
    return sucesso({ id });
  } catch (e) {
    return tratarErro(e);
  }
}

export async function moverDemanda(
  demandaId: string,
  stageId: string,
  posicao: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "demandas:editar");

    const [demanda, etapa] = await Promise.all([
      prisma.demand.findFirst({
        where: {
          id: demandaId,
          organizationId: ator.organizationId,
          deletadoEm: null,
        },
        include: { stage: true },
      }),
      prisma.pipelineStage.findUnique({ where: { id: stageId } }),
    ]);

    if (!demanda || !etapa) return { ok: false, erro: "Demanda ou etapa não encontrada." };
    if (!podeCliente(ator, demanda.clientId)) {
      return { ok: false, erro: "Sem acesso a este cliente." };
    }

    const mudou = demanda.stageId !== stageId;
    const concluida = etapa.tipo === "GANHO";

    await prisma.$transaction(async (tx) => {
      await tx.demand.update({
        where: { id: demandaId },
        data: {
          stageId,
          posicao,
          ...(mudou
            ? {
                entrouNoEstagioEm: new Date(),
                concluidaEm: concluida ? new Date() : null,
                iniciadaEm: demanda.iniciadaEm ?? new Date(),
              }
            : {}),
        },
      });

      if (mudou) {
        await auditar(tx, ator, {
          acao: "demanda.etapa",
          entidadeTipo: "demanda",
          entidadeId: demandaId,
          resumo: `"${demanda.titulo}": ${demanda.stage.nome} → ${etapa.nome}`,
          antes: { etapa: demanda.stage.nome },
          depois: { etapa: etapa.nome },
        });
      }
    });

    revalidatePath("/demandas");
    revalidatePath(`/demandas/${demandaId}`);
    return { ok: true };
  } catch (e) {
    const r = tratarErro(e);
    return { ok: false, erro: r.ok ? "" : r.erro };
  }
}

const EditarDemanda = z.object({
  id: z.string(),
  titulo: z.string().trim().min(2).optional(),
  descricao: textoOpcional,
  clientId: idOpcional,
  tipoId: idOpcional,
  responsavelId: idOpcional,
  prioridade: z.enum(["BAIXA", "NORMAL", "ALTA", "URGENTE"]).optional(),
  prazoEm: dataOpcional,
  tempoEstimadoMin: z.coerce.number().int().min(0).nullable().optional(),
});

export async function editarDemanda(
  entrada: z.input<typeof EditarDemanda>
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "demandas:editar");
    const d = EditarDemanda.parse(entrada);

    const atual = await prisma.demand.findFirst({
      where: { id: d.id, organizationId: ator.organizationId, deletadoEm: null },
      include: { responsavel: { select: { nome: true } } },
    });
    if (!atual) return falha("Demanda não encontrada.");
    if (!podeCliente(ator, atual.clientId)) return falha("Sem acesso a este cliente.");

    const { id, ...campos } = d;
    const dados = Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== undefined)
    );

    const trocouResponsavel =
      d.responsavelId !== undefined && d.responsavelId !== atual.responsavelId;

    await prisma.$transaction(async (tx) => {
      await tx.demand.update({ where: { id }, data: dados });

      await auditar(tx, ator, {
        acao: trocouResponsavel ? "demanda.responsavel" : "demanda.editada",
        entidadeTipo: "demanda",
        entidadeId: id,
        resumo: trocouResponsavel
          ? `Responsável alterado em "${atual.titulo}"`
          : `"${atual.titulo}" atualizada`,
        antes: {
          responsavel: atual.responsavel?.nome,
          prioridade: atual.prioridade,
          prazoEm: atual.prazoEm,
        },
        depois: dados,
      });

      if (trocouResponsavel && d.responsavelId && d.responsavelId !== ator.userId) {
        await notificar(tx, {
          organizationId: ator.organizationId,
          userId: d.responsavelId,
          tipo: "demanda.atribuida",
          titulo: `Demanda atribuída: ${atual.titulo}`,
          corpo: `${ator.nome} passou esta demanda para você.`,
          url: `/demandas/${id}`,
        });
      }
    });

    revalidatePath(`/demandas/${id}`);
    revalidatePath("/demandas");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function excluirDemanda(id: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "demandas:excluir");

    const demanda = await prisma.demand.findFirst({
      where: { id, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!demanda) return falha("Demanda não encontrada.");

    await prisma.$transaction(async (tx) => {
      await tx.demand.update({
        where: { id },
        data: { deletadoEm: new Date() },
      });
      await auditar(tx, ator, {
        acao: "demanda.excluida",
        entidadeTipo: "demanda",
        entidadeId: id,
        resumo: `"${demanda.titulo}" enviada para a lixeira`,
      });
    });

    revalidatePath("/demandas");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function restaurarDemanda(id: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "demandas:excluir");
    await prisma.demand.updateMany({
      where: { id, organizationId: ator.organizationId },
      data: { deletadoEm: null },
    });
    revalidatePath("/demandas");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function alternarSubtarefa(
  subtarefaId: string
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "demandas:editar");

    const sub = await prisma.subtask.findUnique({
      where: { id: subtarefaId },
      include: { demand: { select: { id: true, organizationId: true, clientId: true } } },
    });
    if (!sub || sub.demand.organizationId !== ator.organizationId) {
      return falha("Subtarefa não encontrada.");
    }
    if (!podeCliente(ator, sub.demand.clientId)) return falha("Sem acesso.");

    await prisma.subtask.update({
      where: { id: subtarefaId },
      data: {
        concluidaEm: sub.concluidaEm ? null : new Date(),
        concluidaPor: sub.concluidaEm ? null : ator.userId,
      },
    });

    revalidatePath(`/demandas/${sub.demand.id}`);
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function criarSubtarefa(
  demandId: string,
  titulo: string
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "demandas:editar");
    const t = z.string().trim().min(1, "Escreva a subtarefa.").parse(titulo);

    const demanda = await prisma.demand.findFirst({
      where: { id: demandId, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!demanda) return falha("Demanda não encontrada.");

    const ultima = await prisma.subtask.findFirst({
      where: { demandId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });

    await prisma.subtask.create({
      data: { demandId, titulo: t, ordem: (ultima?.ordem ?? 0) + 1 },
    });

    revalidatePath(`/demandas/${demandId}`);
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function comentar(
  entidadeTipo: string,
  entidadeId: string,
  corpo: string
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    const texto = z.string().trim().min(1, "Escreva algo.").max(5000).parse(corpo);

    await prisma.comment.create({
      data: {
        organizationId: ator.organizationId,
        entidadeTipo,
        entidadeId,
        autorId: ator.userId,
        corpo: texto,
      },
    });

    revalidatePath(`/demandas/${entidadeId}`);
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

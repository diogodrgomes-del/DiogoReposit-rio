"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirAtor, ipDaRequisicao } from "@/lib/auth/sessao";
import { exigir } from "@/lib/auth/can";
import { auditar, enfileirar, notificar } from "@/lib/auditoria";
import {
  falha,
  sucesso,
  tratarErro,
  textoOpcional,
  idOpcional,
  dataOpcional,
  type Resultado,
} from "@/lib/acoes";
import { telefoneE164 } from "@/lib/formato";

/**
 * Cadastro mínimo obrigatório: nome e telefone, nada mais. Todo o resto é
 * preenchido depois, na ficha. Formulário que exige dez campos é formulário
 * que faz a pessoa criar o lead num bloco de notas.
 */
const NovoLead = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  telefone: z.string().trim().min(8, "Informe o telefone."),
  empresa: textoOpcional,
  valorEstimado: z.coerce.number().int().min(0).default(0),
  origemId: idOpcional,
  responsavelId: idOpcional,
  stageId: idOpcional,
});

export async function criarLead(
  entrada: z.input<typeof NovoLead>
): Promise<Resultado<{ id: string; jaExistia?: boolean }>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "leads:criar");
    const d = NovoLead.parse(entrada);

    const telefone = telefoneE164(d.telefone);
    if (!telefone) return falha("Telefone inválido.", { telefone: "Confira o número." });

    const pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: ator.organizationId, tipo: "VENDAS" },
      include: { etapas: { orderBy: { ordem: "asc" } } },
    });
    if (!pipeline || pipeline.etapas.length === 0) {
      return falha("Nenhum pipeline de vendas configurado.");
    }

    const etapa = d.stageId
      ? pipeline.etapas.find((e) => e.id === d.stageId) ?? pipeline.etapas[0]
      : pipeline.etapas[0];

    /*
      Contato já existente com este telefone é reaproveitado, inclusive se
      estiver na lixeira: é o que evita cadastro duplicado quando a mesma
      pessoa volta a procurar a agência meses depois.

      Se esse contato já tem um lead EM ABERTO, devolvemos o lead existente em
      vez de criar um segundo. Sem isso o pipeline enche de repetições da mesma
      pessoa — e o comercial passa a não confiar no número de leads. Não é
      bloquear a criação: o lead existe, e a interface leva direto para ele.
    */
    const existente = await prisma.contact.findUnique({
      where: {
        organizationId_telefone: {
          organizationId: ator.organizationId,
          telefone,
        },
      },
      include: {
        leads: {
          where: { deletadoEm: null, ganhoEm: null, perdidoEm: null },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (existente?.leads.length) {
      return sucesso({ id: existente.leads[0].id, jaExistia: true });
    }

    const id = await prisma.$transaction(async (tx) => {
      const contato = existente
        ? await tx.contact.update({
            where: { id: existente.id },
            data: {
              deletadoEm: null,
              // O nome digitado agora vale mais que o antigo: quem está
              // cadastrando tem a informação mais recente.
              nome: d.nome,
              empresa: d.empresa ?? existente.empresa,
            },
          })
        : await tx.contact.create({
            data: {
              organizationId: ator.organizationId,
              nome: d.nome,
              telefone,
              empresa: d.empresa,
            },
          });

      // Entra no topo da coluna: o lead novo é o que precisa de atenção.
      const primeiro = await tx.lead.findFirst({
        where: { stageId: etapa.id, deletadoEm: null },
        orderBy: { posicao: "asc" },
        select: { posicao: true },
      });

      const lead = await tx.lead.create({
        data: {
          organizationId: ator.organizationId,
          contactId: contato.id,
          pipelineId: pipeline.id,
          stageId: etapa.id,
          responsavelId: d.responsavelId ?? ator.userId,
          origemId: d.origemId,
          valorEstimadoCents: d.valorEstimado * 100,
          posicao: primeiro ? primeiro.posicao - 1000 : 1000,
        },
      });

      await auditar(tx, ator, {
        acao: "lead.criado",
        entidadeTipo: "lead",
        entidadeId: lead.id,
        resumo: `Lead ${d.nome} criado em ${etapa.nome}`,
        depois: { nome: d.nome, telefone, etapa: etapa.nome },
        ip: await ipDaRequisicao(),
      });

      await enfileirar(tx, ator.organizationId, "lead.criado", { leadId: lead.id });

      return lead.id;
    });

    revalidatePath("/vendas");
    revalidatePath("/");
    return sucesso({ id });
  } catch (e) {
    return tratarErro(e);
  }
}

export async function moverLead(
  leadId: string,
  stageId: string,
  posicao: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "leads:mover");

    const [lead, etapa] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: leadId, organizationId: ator.organizationId, deletadoEm: null },
        include: { stage: true, contact: { select: { nome: true } } },
      }),
      prisma.pipelineStage.findUnique({ where: { id: stageId } }),
    ]);

    if (!lead || !etapa) return { ok: false, erro: "Lead ou etapa não encontrada." };
    if (etapa.pipelineId !== lead.pipelineId) {
      return { ok: false, erro: "Etapa de outro pipeline." };
    }

    const mudouEtapa = lead.stageId !== stageId;

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          stageId,
          posicao,
          // entrouNoEstagioEm só reinicia quando a etapa muda de verdade —
          // é o que permite medir tempo médio por etapa depois.
          ...(mudouEtapa
            ? {
                entrouNoEstagioEm: new Date(),
                ganhoEm: etapa.tipo === "GANHO" ? new Date() : null,
                perdidoEm: etapa.tipo === "PERDIDO" ? new Date() : null,
              }
            : {}),
        },
      });

      if (mudouEtapa) {
        await auditar(tx, ator, {
          acao: "lead.etapa",
          entidadeTipo: "lead",
          entidadeId: leadId,
          resumo: `${lead.contact.nome}: ${lead.stage.nome} → ${etapa.nome}`,
          antes: { etapa: lead.stage.nome },
          depois: { etapa: etapa.nome },
        });

        if (etapa.tipo === "GANHO") {
          await enfileirar(tx, ator.organizationId, "lead.ganho", { leadId });
        }
      }
    });

    revalidatePath("/vendas");
    revalidatePath(`/vendas/lead/${leadId}`);
    return { ok: true };
  } catch (e) {
    const r = tratarErro(e);
    return { ok: false, erro: r.ok ? "" : r.erro };
  }
}

const EditarLead = z.object({
  id: z.string(),
  nome: z.string().trim().min(2).optional(),
  telefone: z.string().trim().optional(),
  email: textoOpcional,
  empresa: textoOpcional,
  instagram: textoOpcional,
  cidade: textoOpcional,
  valorEstimado: z.coerce.number().int().min(0).optional(),
  responsavelId: idOpcional,
  origemId: idOpcional,
  temperatura: z.enum(["FRIO", "MORNO", "QUENTE"]).nullable().optional(),
  servicoInteresse: textoOpcional,
  proximaAcao: textoOpcional,
  proximaAcaoEm: dataOpcional,
  observacoes: textoOpcional,
});

export async function editarLead(
  entrada: z.input<typeof EditarLead>
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "leads:editar");
    const d = EditarLead.parse(entrada);

    const lead = await prisma.lead.findFirst({
      where: { id: d.id, organizationId: ator.organizationId, deletadoEm: null },
      include: { contact: true },
    });
    if (!lead) return falha("Lead não encontrado.");

    const telefone = d.telefone ? telefoneE164(d.telefone) : undefined;
    if (d.telefone && !telefone) {
      return falha("Telefone inválido.", { telefone: "Confira o número." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: lead.contactId },
        data: {
          ...(d.nome ? { nome: d.nome } : {}),
          ...(telefone ? { telefone } : {}),
          ...(d.email !== undefined ? { email: d.email } : {}),
          ...(d.empresa !== undefined ? { empresa: d.empresa } : {}),
          ...(d.instagram !== undefined ? { instagram: d.instagram } : {}),
          ...(d.cidade !== undefined ? { cidade: d.cidade } : {}),
        },
      });

      await tx.lead.update({
        where: { id: d.id },
        data: {
          ...(d.valorEstimado !== undefined
            ? { valorEstimadoCents: d.valorEstimado * 100 }
            : {}),
          ...(d.responsavelId !== undefined ? { responsavelId: d.responsavelId } : {}),
          ...(d.origemId !== undefined ? { origemId: d.origemId } : {}),
          ...(d.temperatura !== undefined ? { temperatura: d.temperatura } : {}),
          ...(d.servicoInteresse !== undefined
            ? { servicoInteresse: d.servicoInteresse }
            : {}),
          ...(d.proximaAcao !== undefined ? { proximaAcao: d.proximaAcao } : {}),
          ...(d.proximaAcaoEm !== undefined ? { proximaAcaoEm: d.proximaAcaoEm } : {}),
          ...(d.observacoes !== undefined ? { observacoes: d.observacoes } : {}),
        },
      });

      await auditar(tx, ator, {
        acao: "lead.editado",
        entidadeTipo: "lead",
        entidadeId: d.id,
        resumo: `Lead ${d.nome ?? lead.contact.nome} atualizado`,
        antes: { valorCents: lead.valorEstimadoCents },
        depois: d,
      });
    });

    revalidatePath(`/vendas/lead/${d.id}`);
    revalidatePath("/vendas");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function marcarPerdido(
  leadId: string,
  motivoId: string | null
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "leads:editar");

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: ator.organizationId, deletadoEm: null },
      include: { pipeline: { include: { etapas: true } } },
    });
    if (!lead) return falha("Lead não encontrado.");

    const etapaPerdido = lead.pipeline.etapas.find((e) => e.tipo === "PERDIDO");

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          perdidoEm: new Date(),
          // O motivo pode ser pulado: obrigar a escolher faz a pessoa
          // escolher qualquer um, e aí o dado não vale nada.
          motivoPerdaId: motivoId,
          ...(etapaPerdido
            ? { stageId: etapaPerdido.id, entrouNoEstagioEm: new Date() }
            : {}),
        },
      });

      await auditar(tx, ator, {
        acao: "lead.perdido",
        entidadeTipo: "lead",
        entidadeId: leadId,
        resumo: "Lead marcado como perdido",
        depois: { motivoId },
      });
    });

    revalidatePath("/vendas");
    revalidatePath(`/vendas/lead/${leadId}`);
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function excluirLead(leadId: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "leads:excluir");

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: ator.organizationId, deletadoEm: null },
      include: { contact: { select: { nome: true } } },
    });
    if (!lead) return falha("Lead não encontrado.");

    // Exclusão lógica: some da tela, dá para restaurar por 30 dias.
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: { deletadoEm: new Date() },
      });
      await auditar(tx, ator, {
        acao: "lead.excluido",
        entidadeTipo: "lead",
        entidadeId: leadId,
        resumo: `Lead ${lead.contact.nome} enviado para a lixeira`,
      });
    });

    revalidatePath("/vendas");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function restaurarLead(leadId: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "leads:excluir");
    await prisma.lead.updateMany({
      where: { id: leadId, organizationId: ator.organizationId },
      data: { deletadoEm: null },
    });
    revalidatePath("/vendas");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

/**
 * Onboarding: lead ganho vira cliente, com contrato e projeto, numa transação
 * só. Ou tudo é criado, ou nada — cliente sem contrato é pior que lead aberto.
 */
const Converter = z.object({
  leadId: z.string(),
  razaoSocial: z.string().trim().min(2, "Informe o nome da empresa."),
  planoId: idOpcional,
  valorMensal: z.coerce.number().int().min(0).default(0),
  diaVencimento: z.coerce.number().int().min(1).max(28).default(10),
  responsavelId: idOpcional,
});

export async function converterEmCliente(
  entrada: z.input<typeof Converter>
): Promise<Resultado<{ clientId: string }>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "clientes:criar");
    const d = Converter.parse(entrada);

    const lead = await prisma.lead.findFirst({
      where: { id: d.leadId, organizationId: ator.organizationId, deletadoEm: null },
      include: { contact: true, pipeline: { include: { etapas: true } } },
    });
    if (!lead) return falha("Lead não encontrado.");
    if (lead.clientId) return falha("Este lead já virou cliente.");

    const clientId = await prisma.$transaction(async (tx) => {
      const cliente = await tx.client.create({
        data: {
          organizationId: ator.organizationId,
          razaoSocial: d.razaoSocial,
          nomeFantasia: lead.contact.empresa,
          telefone: lead.contact.telefone,
          whatsapp: lead.contact.telefone,
          email: lead.contact.email,
          instagram: lead.contact.instagram,
          cidade: lead.contact.cidade,
          uf: lead.contact.uf,
          status: "ONBOARDING",
          responsavelId: d.responsavelId ?? lead.responsavelId ?? ator.userId,
          entrouEm: new Date(),
        },
      });

      await tx.clientContact.create({
        data: {
          clientId: cliente.id,
          contactId: lead.contactId,
          papel: "PRINCIPAL",
        },
      });

      const contrato = await tx.contract.create({
        data: {
          organizationId: ator.organizationId,
          clientId: cliente.id,
          planoId: d.planoId,
          valorMensalCents: d.valorMensal * 100,
          inicioEm: new Date(),
          diaVencimento: d.diaVencimento,
          status: "ATIVO",
        },
      });

      await tx.project.create({
        data: {
          organizationId: ator.organizationId,
          clientId: cliente.id,
          nome: `Onboarding — ${d.razaoSocial}`,
        },
      });

      await tx.clientStrategy.create({
        data: { organizationId: ator.organizationId, clientId: cliente.id },
      });

      // Primeira mensalidade já lançada no financeiro: é o passo que mais
      // se esquece de fazer à mão, e o que causa cobrança perdida.
      if (d.valorMensal > 0) {
        const venc = new Date();
        venc.setMonth(venc.getMonth() + 1);
        venc.setDate(d.diaVencimento);
        await tx.finEntry.create({
          data: {
            organizationId: ator.organizationId,
            escopo: "EMPRESA",
            tipo: "RECEITA",
            descricao: `Mensalidade — ${d.razaoSocial}`,
            clientId: cliente.id,
            contractId: contrato.id,
            valorCents: d.valorMensal * 100,
            vencimentoEm: venc,
            status: "PREVISTO",
            recorrente: true,
          },
        });
      }

      const etapaGanho = lead.pipeline.etapas.find((e) => e.tipo === "GANHO");
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          clientId: cliente.id,
          ganhoEm: new Date(),
          ...(etapaGanho
            ? { stageId: etapaGanho.id, entrouNoEstagioEm: new Date() }
            : {}),
        },
      });

      await auditar(tx, ator, {
        acao: "lead.convertido",
        entidadeTipo: "cliente",
        entidadeId: cliente.id,
        resumo: `${lead.contact.nome} virou cliente ${d.razaoSocial}`,
        depois: { leadId: lead.id, clienteId: cliente.id },
      });

      await notificar(tx, {
        organizationId: ator.organizationId,
        userId: cliente.responsavelId ?? ator.userId,
        tipo: "cliente.novo",
        titulo: `Novo cliente: ${d.razaoSocial}`,
        corpo: "Onboarding criado. Confira as tarefas iniciais.",
        url: `/clientes/${cliente.id}`,
      });

      await enfileirar(tx, ator.organizationId, "cliente.onboarding", {
        clienteId: cliente.id,
      });

      return cliente.id;
    });

    revalidatePath("/vendas");
    revalidatePath("/clientes");
    revalidatePath("/");
    return sucesso({ clientId });
  } catch (e) {
    return tratarErro(e);
  }
}

const NovaAtividade = z.object({
  leadId: z.string(),
  tipo: z.enum([
    "LIGACAO", "REUNIAO", "FOLLOWUP", "MENSAGEM",
    "VISITA", "APRESENTACAO", "PROPOSTA", "TAREFA",
  ]),
  titulo: z.string().trim().min(2, "Descreva a atividade."),
  iniciaEm: dataOpcional,
});

export async function registrarAtividade(
  entrada: z.input<typeof NovaAtividade>
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "leads:editar");
    const d = NovaAtividade.parse(entrada);

    const lead = await prisma.lead.findFirst({
      where: { id: d.leadId, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!lead) return falha("Lead não encontrado.");

    await prisma.activity.create({
      data: {
        organizationId: ator.organizationId,
        tipo: d.tipo,
        titulo: d.titulo,
        leadId: d.leadId,
        responsavelId: ator.userId,
        iniciaEm: d.iniciaEm,
        concluidaEm: d.iniciaEm ? null : new Date(),
      },
    });

    revalidatePath(`/vendas/lead/${d.leadId}`);
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

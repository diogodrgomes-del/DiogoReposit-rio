"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirAtor, ipDaRequisicao } from "@/lib/auth/sessao";
import { exigir, podeCliente } from "@/lib/auth/can";
import { auditar } from "@/lib/auditoria";
import {
  falha,
  sucesso,
  tratarErro,
  textoOpcional,
  idOpcional,
  type Resultado,
} from "@/lib/acoes";

/** Só o nome da empresa é obrigatório, conforme §10.1 do briefing. */
const NovoCliente = z.object({
  razaoSocial: z.string().trim().min(2, "Informe o nome da empresa."),
  nomeFantasia: textoOpcional,
  segmento: textoOpcional,
  telefone: textoOpcional,
  email: textoOpcional,
  cidade: textoOpcional,
  uf: textoOpcional,
  responsavelId: idOpcional,
});

export async function criarCliente(
  entrada: z.input<typeof NovoCliente>
): Promise<Resultado<{ id: string }>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "clientes:criar");
    const d = NovoCliente.parse(entrada);

    const id = await prisma.$transaction(async (tx) => {
      const cliente = await tx.client.create({
        data: {
          organizationId: ator.organizationId,
          razaoSocial: d.razaoSocial,
          nomeFantasia: d.nomeFantasia,
          segmento: d.segmento,
          telefone: d.telefone,
          email: d.email,
          cidade: d.cidade,
          uf: d.uf,
          responsavelId: d.responsavelId ?? ator.userId,
          status: "ONBOARDING",
          entrouEm: new Date(),
        },
      });

      // Estratégia nasce junto: a página existe desde o primeiro dia, vazia,
      // em vez de dar 404 até alguém lembrar de criar.
      await tx.clientStrategy.create({
        data: { organizationId: ator.organizationId, clientId: cliente.id },
      });

      await auditar(tx, ator, {
        acao: "cliente.criado",
        entidadeTipo: "cliente",
        entidadeId: cliente.id,
        resumo: `Cliente ${d.razaoSocial} criado`,
        depois: d,
        ip: await ipDaRequisicao(),
      });

      return cliente.id;
    });

    revalidatePath("/clientes");
    return sucesso({ id });
  } catch (e) {
    return tratarErro(e);
  }
}

const EditarCliente = z.object({
  id: z.string(),
  razaoSocial: z.string().trim().min(2).optional(),
  nomeFantasia: textoOpcional,
  cnpj: textoOpcional,
  segmento: textoOpcional,
  telefone: textoOpcional,
  whatsapp: textoOpcional,
  email: textoOpcional,
  cidade: textoOpcional,
  uf: textoOpcional,
  endereco: textoOpcional,
  instagram: textoOpcional,
  facebook: textoOpcional,
  tiktok: textoOpcional,
  site: textoOpcional,
  gmnUrl: textoOpcional,
  observacoes: textoOpcional,
  responsavelId: idOpcional,
  status: z
    .enum([
      "ATIVO", "ONBOARDING", "PAUSADO", "INADIMPLENTE",
      "EM_RISCO", "CANCELADO", "ENCERRADO",
    ])
    .optional(),
  saude: z.enum(["VERDE", "AMARELO", "VERMELHO"]).optional(),
});

export async function editarCliente(
  entrada: z.input<typeof EditarCliente>
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "clientes:editar");
    const d = EditarCliente.parse(entrada);

    const atual = await prisma.client.findFirst({
      where: { id: d.id, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!atual) return falha("Cliente não encontrado.");
    if (!podeCliente(ator, atual.id)) return falha("Sem acesso a este cliente.");

    const { id, ...campos } = d;
    const dados = Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== undefined)
    );

    await prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data: dados });
      await auditar(tx, ator, {
        acao: "cliente.editado",
        entidadeTipo: "cliente",
        entidadeId: id,
        resumo: `Cliente ${atual.razaoSocial} atualizado`,
        antes: { status: atual.status, saude: atual.saude },
        depois: dados,
      });
    });

    revalidatePath(`/clientes/${id}`);
    revalidatePath("/clientes");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function excluirCliente(id: string): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "clientes:excluir");

    const cliente = await prisma.client.findFirst({
      where: { id, organizationId: ator.organizationId, deletadoEm: null },
    });
    if (!cliente) return falha("Cliente não encontrado.");

    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id },
        data: { deletadoEm: new Date() },
      });
      await auditar(tx, ator, {
        acao: "cliente.excluido",
        entidadeTipo: "cliente",
        entidadeId: id,
        resumo: `Cliente ${cliente.razaoSocial} enviado para a lixeira`,
      });
    });

    revalidatePath("/clientes");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

const Estrategia = z.object({
  clientId: z.string(),
  objetivoPrincipal: textoOpcional,
  posicionamento: textoOpcional,
  publicoAlvo: textoOpcional,
  persona: textoOpcional,
  tomDeVoz: textoOpcional,
  // Listas chegam do formulário como texto separado por vírgula ou linha.
  diferenciais: z.string().optional(),
  concorrentes: z.string().optional(),
  palavrasProibidas: z.string().optional(),
  pilaresConteudo: z.string().optional(),
  dores: z.string().optional(),
  objecoes: z.string().optional(),
});

function lista(v: string | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  return v
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function salvarEstrategia(
  entrada: z.input<typeof Estrategia>
): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    exigir(ator, "estrategia:editar");
    const d = Estrategia.parse(entrada);
    if (!podeCliente(ator, d.clientId)) return falha("Sem acesso a este cliente.");

    const dados = {
      objetivoPrincipal: d.objetivoPrincipal,
      posicionamento: d.posicionamento,
      publicoAlvo: d.publicoAlvo,
      persona: d.persona,
      tomDeVoz: d.tomDeVoz,
      diferenciais: lista(d.diferenciais),
      concorrentes: lista(d.concorrentes),
      palavrasProibidas: lista(d.palavrasProibidas),
      pilaresConteudo: lista(d.pilaresConteudo),
      dores: lista(d.dores),
      objecoes: lista(d.objecoes),
    };
    const limpo = Object.fromEntries(
      Object.entries(dados).filter(([, v]) => v !== undefined)
    );

    await prisma.clientStrategy.upsert({
      where: { clientId: d.clientId },
      create: {
        organizationId: ator.organizationId,
        clientId: d.clientId,
        ...limpo,
      },
      update: limpo,
    });

    revalidatePath(`/clientes/${d.clientId}/estrategia`);
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}

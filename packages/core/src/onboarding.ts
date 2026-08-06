import { and, asc, eq, isNull } from "drizzle-orm";
import {
  clienteContatos,
  clientes,
  comContexto,
  contatos,
  leads,
  novoId,
  pipelineEtapas,
  pipelines,
} from "@mark/db";
import { ErroDeValidacao } from "./clientes";
import { exigir, type Contexto } from "./contexto";
import { registrar } from "./eventos";

/**
 * Onboarding: transformar lead em cliente.
 *
 * É o fluxo que a modelagem inteira existe para servir. O ponto não é copiar
 * campos — é **não copiar**: nome e telefone continuam no mesmo `contato`, e é
 * ele que passa a responder pelas duas coisas.
 *
 * Consequência prática: a conversa de WhatsApp daquela pessoa não muda de dono
 * no momento em que ela assina. Continua a mesma conversa, e a ficha ao lado é
 * que passa de lead para cliente. Com nome e telefone duplicados no lead, esse
 * histórico se partiria em dois exatamente quando passa a valer mais.
 *
 * Tudo numa transação: ou o cliente, o vínculo, a etapa e os dois eventos
 * acontecem, ou nada acontece. Um cliente criado com o lead ainda solto seria
 * pior do que a falha.
 */

export type ResultadoOnboarding = {
  clienteId: string;
  clienteNome: string;
  jaExistia: boolean;
};

export async function transformarEmCliente(
  ctx: Contexto,
  leadId: string,
  opcoes: { nomeCliente?: string } = {},
): Promise<ResultadoOnboarding> {
  exigir(ctx, "vendas.lead.editar");
  exigir(ctx, "clientes.cliente.criar");

  return comContexto(ctx, async (tx) => {
    const encontrados = await tx
      .select({
        id: leads.id,
        contatoId: leads.contatoId,
        clienteId: leads.clienteId,
        empresa: leads.empresa,
        site: leads.site,
        cidade: leads.cidade,
        estado: leads.estado,
        segmento: leads.segmento,
        responsavelId: leads.responsavelId,
        observacoes: leads.observacoes,
        contatoNome: contatos.nome,
        contatoTelefone: contatos.telefoneE164,
        contatoEmail: contatos.email,
      })
      .from(leads)
      .innerJoin(contatos, eq(contatos.id, leads.contatoId))
      .where(and(eq(leads.id, leadId), isNull(leads.excluidoEm)))
      .limit(1);

    const lead = encontrados[0];
    if (!lead) throw new ErroDeValidacao("lead", "Lead não encontrado.");

    // Já convertido: devolve o cliente existente em vez de criar um segundo.
    // Clicar duas vezes no botão é o caso comum, não o excepcional.
    if (lead.clienteId) {
      const existente = await tx
        .select({ nome: clientes.nome })
        .from(clientes)
        .where(eq(clientes.id, lead.clienteId))
        .limit(1);

      return {
        clienteId: lead.clienteId,
        clienteNome: existente[0]?.nome ?? "",
        jaExistia: true,
      };
    }

    // O nome da empresa vem do lead; sem ele, o nome da pessoa serve. Pedir que
    // alguém digite antes de converter travaria o fluxo por um dado que já
    // está ali.
    const nomeCliente =
      opcoes.nomeCliente?.trim() || lead.empresa?.trim() || lead.contatoNome.trim();

    const clienteId = novoId();
    await tx.insert(clientes).values({
      id: clienteId,
      organizacaoId: ctx.organizacaoId,
      nome: nomeCliente,
      segmento: lead.segmento,
      telefoneE164: lead.contatoTelefone,
      email: lead.contatoEmail,
      cidade: lead.cidade,
      estado: lead.estado,
      site: lead.site,
      responsavelId: lead.responsavelId,
      contatoPrincipalId: lead.contatoId,
      // Onboarding é o status de entrada: o contrato existe, a operação ainda
      // não começou. Marcar como ativo esconderia o trabalho de implantação.
      status: "onboarding",
      saude: "verde",
      observacoes: lead.observacoes,
      criadoPor: ctx.usuarioId,
      atualizadoPor: ctx.usuarioId,
    });

    // O mesmo contato responde pelo cliente. Nada foi copiado.
    await tx
      .insert(clienteContatos)
      .values({ clienteId, contatoId: lead.contatoId, papel: "principal" })
      .onConflictDoNothing();

    // Etapa de ganho, se o pipeline tiver uma. Converter é fechar.
    const ganho = await tx
      .select({ id: pipelineEtapas.id, nome: pipelineEtapas.nome })
      .from(pipelineEtapas)
      .innerJoin(pipelines, eq(pipelines.id, pipelineEtapas.pipelineId))
      .where(and(eq(pipelines.organizacaoId, ctx.organizacaoId), eq(pipelineEtapas.tipo, "ganho")))
      .orderBy(asc(pipelineEtapas.ordem))
      .limit(1);

    const etapaGanho = ganho[0];

    await tx
      .update(leads)
      .set({
        clienteId,
        fechadoEm: new Date(),
        perdidoEm: null,
        ...(etapaGanho ? { etapaId: etapaGanho.id } : {}),
        atualizadoEm: new Date(),
        atualizadoPor: ctx.usuarioId,
      })
      .where(eq(leads.id, leadId));

    // Dois eventos, um em cada linha do tempo: quem abrir o cliente vê de onde
    // ele veio, e quem abrir o lead vê no que ele deu.
    await registrar(tx, ctx, {
      tipo: "lead.convertido",
      entidade: "lead",
      entidadeId: leadId,
      dados: { cliente: nomeCliente, clienteId },
    });

    await registrar(tx, ctx, {
      tipo: "cliente.criado",
      entidade: "cliente",
      entidadeId: clienteId,
      dados: { nome: nomeCliente, origem: "onboarding", leadId },
    });

    return { clienteId, clienteNome: nomeCliente, jaExistia: false };
  });
}

/**
 * Seed do MARK SISTEM.
 *
 * Idempotente: pode rodar quantas vezes quiser. Cria a organização, os
 * pipelines, as listas configuráveis e o usuário proprietário.
 *
 *   npm run db:seed
 *
 * Migração das contas antigas: se DASH_USERS existir no ambiente, cada entrada
 * `usuario:pbkdf2.iteracoes.salt.hash` vira um usuário com o MESMO hash — quem
 * já usava o painel entra com a senha de sempre. No primeiro login o hash é
 * reescrito com 600 mil iterações, sem ninguém trocar de senha.
 */
import { PrismaClient, type Papel } from "@prisma/client";
import { createInterface } from "node:readline/promises";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const ITERACOES = 600_000;

function b64url(b: Buffer): string {
  return b.toString("base64url");
}

function hashSenha(senha: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(senha, salt, ITERACOES, 32, "sha256");
  return `pbkdf2.${ITERACOES}.${b64url(salt)}.${b64url(hash)}`;
}

const ETAPAS_VENDAS = [
  ["Lead novo", "ABERTO"],
  ["Primeiro contato", "ABERTO"],
  ["Reunião agendada", "ABERTO"],
  ["Diagnóstico", "ABERTO"],
  ["Proposta enviada", "ABERTO"],
  ["Negociação", "ABERTO"],
  ["Fechado", "GANHO"],
  ["Perdido", "PERDIDO"],
] as const;

const ETAPAS_OPERACIONAL = [
  ["Nova demanda", "ABERTO"],
  ["Briefing", "ABERTO"],
  ["Em andamento", "ABERTO"],
  ["Revisão interna", "ABERTO"],
  ["Aguardando cliente", "ABERTO"],
  ["Alteração", "ABERTO"],
  ["Aprovado", "ABERTO"],
  ["Concluído", "GANHO"],
] as const;

const TIPOS_DEMANDA = [
  "Design", "Copy", "Roteiro", "Edição de vídeo", "Gravação",
  "Tráfego pago", "Social media", "Google Meu Negócio", "SEO",
  "Landing page", "Site", "Reunião", "Planejamento", "Relatório",
  "Atendimento", "Interno",
];

const ORIGENS = [
  "Indicação", "Instagram", "Google", "Tráfego pago",
  "Prospecção ativa", "Evento", "Site", "WhatsApp",
];

const MOTIVOS_PERDA = [
  "Preço", "Sem orçamento", "Não respondeu", "Fechou com concorrente",
  "Não era o momento", "Serviço não compatível", "Desistiu",
  "Sem interesse", "Outro",
];

const CATEGORIAS_RECEITA = [
  "Mensalidade", "Projeto", "Serviço extra", "Produção",
  "Tráfego", "Consultoria", "Outras receitas",
];

const CATEGORIAS_DESPESA = [
  "Funcionários", "Prestadores", "Ferramentas", "Assinaturas",
  "Impostos", "Aluguel", "Energia", "Internet", "Equipamentos",
  "Anúncios", "Fornecedores", "Manutenção", "Transporte",
  "Alimentação", "Outras despesas",
];

const PLANOS: [string, number][] = [
  ["Essencial", 149700],
  ["Performance", 249700],
  ["Completo", 449700],
];

async function main() {
  console.log("→ Organização");
  const org = await prisma.organization.upsert({
    where: { slug: "marktiva" },
    create: { nome: "Agência Marktiva", slug: "marktiva" },
    update: {},
  });

  console.log("→ Pipelines");
  for (const [tipo, etapas, nome] of [
    ["VENDAS", ETAPAS_VENDAS, "Pipeline comercial"],
    ["OPERACIONAL", ETAPAS_OPERACIONAL, "Produção"],
  ] as const) {
    let pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: org.id, tipo },
    });
    if (!pipeline) {
      pipeline = await prisma.pipeline.create({
        data: { organizationId: org.id, nome, tipo, padrao: true },
      });
    }
    for (const [i, [nomeEtapa, tipoEtapa]] of etapas.entries()) {
      const existe = await prisma.pipelineStage.findFirst({
        where: { pipelineId: pipeline.id, nome: nomeEtapa },
      });
      if (!existe) {
        await prisma.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            nome: nomeEtapa,
            ordem: i,
            tipo: tipoEtapa,
          },
        });
      }
    }
  }

  console.log("→ Listas configuráveis");
  for (const nome of TIPOS_DEMANDA) {
    const e = await prisma.demandType.findFirst({
      where: { organizationId: org.id, nome },
    });
    if (!e) await prisma.demandType.create({ data: { organizationId: org.id, nome } });
  }
  for (const nome of ORIGENS) {
    const e = await prisma.leadOrigin.findFirst({
      where: { organizationId: org.id, nome },
    });
    if (!e) await prisma.leadOrigin.create({ data: { organizationId: org.id, nome } });
  }
  for (const [i, nome] of MOTIVOS_PERDA.entries()) {
    const e = await prisma.lossReason.findFirst({
      where: { organizationId: org.id, nome },
    });
    if (!e)
      await prisma.lossReason.create({
        data: { organizationId: org.id, nome, ordem: i },
      });
  }
  for (const [tipo, lista] of [
    ["RECEITA", CATEGORIAS_RECEITA],
    ["DESPESA", CATEGORIAS_DESPESA],
  ] as const) {
    for (const nome of lista) {
      const e = await prisma.finCategory.findFirst({
        where: { organizationId: org.id, nome, tipo },
      });
      if (!e)
        await prisma.finCategory.create({
          data: { organizationId: org.id, nome, tipo },
        });
    }
  }
  for (const [nome, valorBaseCents] of PLANOS) {
    const e = await prisma.plan.findFirst({
      where: { organizationId: org.id, nome },
    });
    if (!e)
      await prisma.plan.create({
        data: { organizationId: org.id, nome, valorBaseCents },
      });
  }

  // ── Usuários ────────────────────────────────────────────────────────────

  console.log("→ Usuários");
  let criados = 0;

  // Contas antigas do painel: hash preservado, senha continua a mesma.
  const dashUsers = process.env.DASH_USERS ?? "";
  for (const parte of dashUsers.split(",")) {
    const limpo = parte.trim();
    if (!limpo) continue;
    const corte = limpo.indexOf(":");
    if (corte < 1) continue;

    const usuario = limpo.slice(0, corte).trim();
    const hash = limpo.slice(corte + 1).trim();
    const email = usuario.includes("@") ? usuario : `${usuario}@marktiva.local`;

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, nome: usuario, senhaHash: hash },
      update: {},
    });
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      create: { organizationId: org.id, userId: user.id, papel: "PROPRIETARIO" },
      update: {},
    });
    criados++;
    console.log(`   migrado de DASH_USERS: ${email}`);
  }

  // Nenhuma conta antiga: cria a do proprietário, perguntando a senha.
  if (criados === 0) {
    const jaExiste = await prisma.membership.count({
      where: { organizationId: org.id },
    });

    if (jaExiste === 0) {
      const email = process.env.SEED_EMAIL ?? "diogodrgomes@gmail.com";
      const nome = process.env.SEED_NOME ?? "Diogo";
      let senha = process.env.SEED_SENHA ?? "";

      if (!senha) {
        if (process.stdin.isTTY) {
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          senha = (
            await rl.question(`Senha para ${email} (mínimo 8 caracteres): `)
          ).trim();
          rl.close();
        }
        if (senha.length < 8) {
          // Senha aleatória e impressa uma única vez, em vez de um padrão
          // conhecido que ninguém troca depois.
          senha = randomBytes(9).toString("base64url");
          console.log(`\n   Senha gerada para ${email}: ${senha}`);
          console.log("   Anote agora — ela não será mostrada de novo.\n");
        }
      }

      const user = await prisma.user.create({
        data: { email, nome, senhaHash: hashSenha(senha) },
      });
      await prisma.membership.create({
        data: { organizationId: org.id, userId: user.id, papel: "PROPRIETARIO" },
      });
      console.log(`   proprietário criado: ${email}`);
    } else {
      console.log("   já existem usuários — nada a fazer");
    }
  }

  // ── Dados de exemplo (opcional) ─────────────────────────────────────────

  if (process.env.SEED_EXEMPLOS === "1") {
    console.log("→ Dados de exemplo");
    await criarExemplos(org.id);
  }

  const [nUsers, nEtapas] = await Promise.all([
    prisma.user.count(),
    prisma.pipelineStage.count(),
  ]);
  console.log(`\n✓ Pronto. ${nUsers} usuário(s), ${nEtapas} etapas de pipeline.`);
}

async function criarExemplos(orgId: string) {
  const dono = await prisma.membership.findFirst({
    where: { organizationId: orgId },
    include: { user: true },
  });
  if (!dono) return;

  const pipelineVendas = await prisma.pipeline.findFirst({
    where: { organizationId: orgId, tipo: "VENDAS" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });
  const pipelineOp = await prisma.pipeline.findFirst({
    where: { organizationId: orgId, tipo: "OPERACIONAL" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });
  if (!pipelineVendas || !pipelineOp) return;

  const clientesExemplo = [
    ["Óticas Gouveia", "Ótica"],
    ["Casa Carvalho", "Materiais de construção"],
    ["Garagem 3", "Automotivo"],
  ];

  for (const [nome, segmento] of clientesExemplo) {
    const existe = await prisma.client.findFirst({
      where: { organizationId: orgId, razaoSocial: nome },
    });
    if (existe) continue;

    const cliente = await prisma.client.create({
      data: {
        organizationId: orgId,
        razaoSocial: nome,
        nomeFantasia: nome,
        segmento,
        status: "ATIVO",
        responsavelId: dono.userId,
        entrouEm: new Date(Date.now() - 90 * 86_400_000),
      },
    });

    await prisma.clientStrategy.create({
      data: { organizationId: orgId, clientId: cliente.id },
    });

    await prisma.contract.create({
      data: {
        organizationId: orgId,
        clientId: cliente.id,
        valorMensalCents: 249700,
        inicioEm: new Date(Date.now() - 90 * 86_400_000),
        diaVencimento: 10,
        status: "ATIVO",
      },
    });

    const venc = new Date();
    venc.setDate(10);
    await prisma.finEntry.create({
      data: {
        organizationId: orgId,
        escopo: "EMPRESA",
        tipo: "RECEITA",
        descricao: `Mensalidade — ${nome}`,
        clientId: cliente.id,
        valorCents: 249700,
        vencimentoEm: venc,
        competenciaEm: venc,
        status: "PENDENTE",
        recorrente: true,
      },
    });

    await prisma.demand.create({
      data: {
        organizationId: orgId,
        titulo: `Calendário de conteúdo — ${nome}`,
        clientId: cliente.id,
        pipelineId: pipelineOp.id,
        stageId: pipelineOp.etapas[2].id,
        responsavelId: dono.userId,
        prioridade: "NORMAL",
        prazoEm: new Date(Date.now() + 3 * 86_400_000),
        posicao: 1000,
      },
    });
  }

  const leadsExemplo = [
    ["Fernanda Luiz", "+5546999990001", "Studio FL", 180000, 0],
    ["Micael Souza", "+5546999990002", "Bom pra Home", 350000, 2],
    ["Kellin Obana", "+5546999990003", "Kellin Estética", 250000, 4],
  ] as const;

  for (const [nome, telefone, empresa, valor, etapa] of leadsExemplo) {
    const existe = await prisma.contact.findFirst({
      where: { organizationId: orgId, telefone },
    });
    if (existe) continue;

    const contato = await prisma.contact.create({
      data: { organizationId: orgId, nome, telefone, empresa },
    });

    await prisma.lead.create({
      data: {
        organizationId: orgId,
        contactId: contato.id,
        pipelineId: pipelineVendas.id,
        stageId: pipelineVendas.etapas[etapa].id,
        responsavelId: dono.userId,
        valorEstimadoCents: valor,
        temperatura: etapa >= 4 ? "QUENTE" : "MORNO",
        proximaAcao: "Retornar contato",
        proximaAcaoEm: new Date(Date.now() + 2 * 86_400_000),
        posicao: 1000 * (etapa + 1),
      },
    });
  }

  const despesas: [string, number, string][] = [
    ["Assinatura Adobe", 27900, "Ferramentas"],
    ["Internet do escritório", 19900, "Internet"],
    ["Aluguel", 180000, "Aluguel"],
  ];
  for (const [descricao, valorCents, categoria] of despesas) {
    const existe = await prisma.finEntry.findFirst({
      where: { organizationId: orgId, descricao },
    });
    if (existe) continue;
    const cat = await prisma.finCategory.findFirst({
      where: { organizationId: orgId, nome: categoria, tipo: "DESPESA" },
    });
    const venc = new Date();
    venc.setDate(15);
    await prisma.finEntry.create({
      data: {
        organizationId: orgId,
        escopo: "EMPRESA",
        tipo: "DESPESA",
        descricao,
        categoryId: cat?.id,
        valorCents,
        vencimentoEm: venc,
        competenciaEm: venc,
        status: "PENDENTE",
        recorrente: true,
      },
    });
  }

  const amanha = new Date(Date.now() + 86_400_000);
  amanha.setHours(14, 0, 0, 0);
  const existeEvento = await prisma.event.findFirst({
    where: { organizationId: orgId, titulo: "Gravação institucional" },
  });
  if (!existeEvento) {
    const cliente = await prisma.client.findFirst({
      where: { organizationId: orgId },
    });
    await prisma.event.create({
      data: {
        organizationId: orgId,
        tipo: "GRAVACAO",
        titulo: "Gravação institucional",
        clientId: cliente?.id,
        inicioEm: amanha,
        fimEm: new Date(amanha.getTime() + 3 * 3_600_000),
        local: "Loja do cliente",
        statusGravacao: "CONFIRMADA",
        participantes: { create: [{ userId: dono.userId }] },
      },
    });
  }
}

main()
  .catch((e) => {
    console.error("Seed falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

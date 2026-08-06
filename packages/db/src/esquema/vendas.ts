import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clientes, contatos } from "./clientes";
import { organizacoes, usuarios } from "./nucleo";

export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    nome: text("nome").notNull(),
    tipo: text("tipo").notNull(),
    padrao: boolean("padrao").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pipelines_padrao").on(t.organizacaoId, t.tipo).where(sql`padrao`)],
);

/** Etapas são dados, não enum — é o que permite personalizar sem migração. */
export const pipelineEtapas = pgTable(
  "pipeline_etapas",
  {
    id: uuid("id").primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    ordem: integer("ordem").notNull(),
    cor: text("cor"),
    /** `ganho` e `perda` marcam onde o funil termina, sem depender do nome. */
    tipo: text("tipo").notNull().default("aberta"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pipeline_etapas_pipeline").on(t.pipelineId)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    /** Nome e telefone vivem aqui. O lead não os duplica. */
    contatoId: uuid("contato_id")
      .notNull()
      .references(() => contatos.id),

    empresa: text("empresa"),
    site: text("site"),
    cidade: text("cidade"),
    estado: char("estado", { length: 2 }),
    segmento: text("segmento"),
    origem: text("origem"),
    servico: text("servico"),
    valorEstimado: numeric("valor_estimado", { precision: 14, scale: 2 }),
    temperatura: text("temperatura"),

    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    etapaId: uuid("etapa_id")
      .notNull()
      .references(() => pipelineEtapas.id),
    /** Fracionária: arrastar é um update de uma linha. */
    ordem: numeric("ordem").notNull(),

    proximaAcao: text("proxima_acao"),
    proximoContatoEm: date("proximo_contato_em"),

    motivoPerda: text("motivo_perda"),
    fechadoEm: timestamp("fechado_em", { withTimezone: true }),
    perdidoEm: timestamp("perdido_em", { withTimezone: true }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "set null" }),

    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
    excluidoEm: timestamp("excluido_em", { withTimezone: true }),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
    atualizadoPor: uuid("atualizado_por").references(() => usuarios.id),
  },
  (t) => [
    index("leads_coluna").on(t.organizacaoId, t.etapaId, t.ordem).where(sql`excluido_em IS NULL`),
    index("leads_contato").on(t.contatoId),
  ],
);

export const atividades = pgTable(
  "atividades",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    agendadaPara: timestamp("agendada_para", { withTimezone: true }),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    lembreteMin: integer("lembrete_min"),
    observacao: text("observacao"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
    excluidoEm: timestamp("excluido_em", { withTimezone: true }),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
  },
  (t) => [index("atividades_lead").on(t.leadId, t.criadoEm)],
);

export const propostas = pgTable(
  "propostas",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
    numero: serial("numero"),
    plano: text("plano"),
    servicos: jsonb("servicos").notNull().default([]),
    valor: numeric("valor", { precision: 14, scale: 2 }),
    desconto: numeric("desconto", { precision: 14, scale: 2 }).notNull().default("0"),
    validade: date("validade"),
    enviadaEm: timestamp("enviada_em", { withTimezone: true }),
    visualizadaEm: timestamp("visualizada_em", { withTimezone: true }),
    status: text("status").notNull().default("rascunho"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
    excluidoEm: timestamp("excluido_em", { withTimezone: true }),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
  },
  (t) => [index("propostas_lead").on(t.leadId)],
);


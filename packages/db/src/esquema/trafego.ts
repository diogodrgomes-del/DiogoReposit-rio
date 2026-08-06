import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clientes, credenciais } from "./clientes";
import { organizacoes } from "./nucleo";

export const contasAnuncio = pgTable(
  "contas_anuncio",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "cascade" }),
    plataforma: text("plataforma").notNull().default("meta_ads"),
    /** Id na plataforma (`act_123…`), não o nosso uuid. */
    externoId: text("externo_id").notNull(),
    nome: text("nome").notNull(),
    moeda: text("moeda").notNull().default("BRL"),
    credencialId: uuid("credencial_id").references(() => credenciais.id, {
      onDelete: "set null",
    }),
    ativa: boolean("ativa").notNull().default(true),
    ultimaSincronizacao: timestamp("ultima_sincronizacao", { withTimezone: true }),
    ultimoErro: text("ultimo_erro"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
    excluidoEm: timestamp("excluido_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("contas_anuncio_externa")
      .on(t.organizacaoId, t.plataforma, t.externoId)
      .where(sql`excluido_em IS NULL`),
    index("contas_anuncio_cliente").on(t.organizacaoId, t.clienteId),
  ],
);

/**
 * Série diária. `campanhaExternaId` nulo é o total da conta naquele dia — a
 * linha que o painel da carteira lê, sem precisar somar dezenas de campanhas a
 * cada abertura.
 */
export const metricasDiarias = pgTable(
  "metricas_diarias",
  {
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    contaId: uuid("conta_id")
      .notNull()
      .references(() => contasAnuncio.id, { onDelete: "cascade" }),
    campanhaExternaId: text("campanha_externa_id"),
    dia: date("dia").notNull(),

    campanhaNome: text("campanha_nome"),
    campanhaStatus: text("campanha_status"),
    campanhaObjetivo: text("campanha_objetivo"),

    gasto: numeric("gasto", { precision: 14, scale: 2 }).notNull().default("0"),
    impressoes: bigint("impressoes", { mode: "number" }).notNull().default(0),
    alcance: bigint("alcance", { mode: "number" }).notNull().default(0),
    cliques: bigint("cliques", { mode: "number" }).notNull().default(0),
    cliquesLink: bigint("cliques_link", { mode: "number" }).notNull().default(0),
    conversas: bigint("conversas", { mode: "number" }).notNull().default(0),
    resposta1: bigint("resposta1", { mode: "number" }).notNull().default(0),
    prof2: bigint("prof2", { mode: "number" }).notNull().default(0),
    prof3: bigint("prof3", { mode: "number" }).notNull().default(0),
    prof5: bigint("prof5", { mode: "number" }).notNull().default(0),

    sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("metricas_periodo").on(t.organizacaoId, t.contaId, t.dia)],
);

export const syncExecucoes = pgTable("sync_execucoes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  organizacaoId: uuid("organizacao_id").notNull(),
  contaId: uuid("conta_id").references(() => contasAnuncio.id, { onDelete: "cascade" }),
  origem: text("origem").notNull(),
  estado: text("estado").notNull(),
  dias: integer("dias"),
  linhas: integer("linhas"),
  erro: text("erro"),
  iniciadoEm: timestamp("iniciado_em", { withTimezone: true }).notNull().defaultNow(),
  terminadoEm: timestamp("terminado_em", { withTimezone: true }),
});

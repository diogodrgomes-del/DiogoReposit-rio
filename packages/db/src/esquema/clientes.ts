import { sql } from "drizzle-orm";
import {
  bigserial,
  char,
  customType,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizacoes, usuarios } from "./nucleo";

/** `bytea` — os envelopes do cofre. Drizzle não traz o tipo pronto. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const rodape = {
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  excluidoEm: timestamp("excluido_em", { withTimezone: true }),
  criadoPor: uuid("criado_por").references(() => usuarios.id),
  atualizadoPor: uuid("atualizado_por").references(() => usuarios.id),
};

/**
 * A âncora de identidade do sistema.
 *
 * Lead, cliente e conversa de WhatsApp apontam para cá. `telefone_e164` é a
 * chave de casamento — normalizado por `normalizarTelefone` de @mark/core antes
 * de qualquer escrita, e único por organização.
 */
export const contatos = pgTable(
  "contatos",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    nome: text("nome").notNull(),
    telefoneE164: text("telefone_e164"),
    email: text("email"),
    fotoUrl: text("foto_url"),
    instagram: text("instagram"),
    cargo: text("cargo"),
    observacoes: text("observacoes"),
    ...rodape,
  },
  (t) => [
    uniqueIndex("contatos_telefone")
      .on(t.organizacaoId, t.telefoneE164)
      .where(sql`telefone_e164 IS NOT NULL AND excluido_em IS NULL`),
    index("contatos_ativos").on(t.organizacaoId).where(sql`excluido_em IS NULL`),
  ],
);

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),

    /** O único campo obrigatório. Todo o resto entra depois. */
    nome: text("nome").notNull(),

    nomeFantasia: text("nome_fantasia"),
    cnpj: text("cnpj"),
    segmento: text("segmento"),
    telefoneE164: text("telefone_e164"),
    email: text("email"),
    cidade: text("cidade"),
    estado: char("estado", { length: 2 }),
    endereco: text("endereco"),
    instagram: text("instagram"),
    facebook: text("facebook"),
    tiktok: text("tiktok"),
    site: text("site"),
    googleMeuNegocio: text("google_meu_negocio"),

    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    contatoPrincipalId: uuid("contato_principal_id").references(() => contatos.id),
    contatoFinanceiroId: uuid("contato_financeiro_id").references(() => contatos.id),
    contatoMarketingId: uuid("contato_marketing_id").references(() => contatos.id),

    status: text("status").notNull().default("onboarding"),
    saude: text("saude").notNull().default("verde"),

    observacoes: text("observacoes"),
    ...rodape,
  },
  (t) => [
    index("clientes_ativos").on(t.organizacaoId).where(sql`excluido_em IS NULL`),
    index("clientes_status").on(t.organizacaoId, t.status).where(sql`excluido_em IS NULL`),
  ],
);

export const clienteContatos = pgTable(
  "cliente_contatos",
  {
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    contatoId: uuid("contato_id")
      .notNull()
      .references(() => contatos.id, { onDelete: "cascade" }),
    papel: text("papel"),
  },
  (t) => [primaryKey({ columns: [t.clienteId, t.contatoId] })],
);

export const etiquetas = pgTable("etiquetas", {
  id: uuid("id").primaryKey(),
  organizacaoId: uuid("organizacao_id")
    .notNull()
    .references(() => organizacoes.id),
  nome: text("nome").notNull(),
  cor: text("cor").notNull().default("cinza"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const vinculos = pgTable(
  "vinculos",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    tipoOrigem: text("tipo_origem").notNull(),
    origemId: uuid("origem_id").notNull(),
    tipoEntidade: text("tipo_entidade").notNull(),
    entidadeId: uuid("entidade_id").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vinculos_entidade").on(t.tipoEntidade, t.entidadeId)],
);

/** Linha do tempo visível ao usuário. Não confundir com `auditoria`. */
export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    tipoEntidade: text("tipo_entidade").notNull(),
    entidadeId: uuid("entidade_id").notNull(),
    tipo: text("tipo").notNull(),
    atorId: uuid("ator_id").references(() => usuarios.id),
    dados: jsonb("dados").notNull().default({}),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("eventos_entidade").on(t.tipoEntidade, t.entidadeId, t.criadoEm)],
);

export const credenciais = pgTable(
  "credenciais",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "cascade" }),
    plataforma: text("plataforma").notNull(),
    rotulo: text("rotulo"),
    login: text("login"),
    link: text("link"),

    // Envelopes de @mark/cofre. Nunca sair daqui sem passar por decifrar().
    segredoCifrado: bytea("segredo_cifrado").notNull(),
    dekCifrada: bytea("dek_cifrada").notNull(),
    versaoKek: integer("versao_kek").notNull(),

    dica: text("dica"),
    expiraEm: date("expira_em"),
    observacoes: text("observacoes"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    ...rodape,
  },
  (t) => [
    index("credenciais_cliente").on(t.organizacaoId, t.clienteId).where(sql`excluido_em IS NULL`),
  ],
);

/** Somente-anexação, garantido por gatilho no banco. */
export const credencialAcessos = pgTable("credencial_acessos", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  organizacaoId: uuid("organizacao_id").notNull(),
  credencialId: uuid("credencial_id").notNull(),
  usuarioId: uuid("usuario_id"),
  acao: text("acao").notNull(),
  ip: inet("ip"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

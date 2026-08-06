import {
  boolean,
  index,
  inet,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Migração 0001 — núcleo de identidade.
 *
 * Este esquema é a camada tipada de consulta. O DDL de verdade vive em
 * `migracoes/*.sql`, escrito à mão. Ver `migracoes/README.md` para o porquê.
 */

export const organizacoes = pgTable("organizacoes", {
  id: uuid("id").primaryKey(),
  nome: text("nome").notNull(),
  slug: text("slug").notNull().unique(),
  /**
   * Quem enxerga o financeiro pessoal. É a única permissão do sistema que não
   * passa pela tabela de papéis — ver `pode()` em @mark/core.
   */
  proprietarioId: uuid("proprietario_id"),
  plano: text("plano").notNull().default("interno"),
  configuracoes: jsonb("configuracoes").notNull().default({}),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  excluidoEm: timestamp("excluido_em", { withTimezone: true }),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    nome: text("nome").notNull(),
    /**
     * `argon2id$...` para senhas novas, `pbkdf2.<it>.<sal>.<hash>` para as
     * herdadas do painel antigo. A verificação aceita as duas e regrava em
     * argon2id no primeiro login — ver @mark/auth.
     */
    senhaHash: text("senha_hash"),
    avatarUrl: text("avatar_url"),
    telefoneE164: text("telefone_e164"),
    ultimoAcesso: timestamp("ultimo_acesso", { withTimezone: true }),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
    excluidoEm: timestamp("excluido_em", { withTimezone: true }),
  },
  (t) => [uniqueIndex("usuarios_email").on(t.email)],
);

export const papeis = pgTable(
  "papeis",
  {
    id: uuid("id").primaryKey(),
    /** `null` = papel de sistema, compartilhado por todas as organizações. */
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    chave: text("chave").notNull(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    sistema: boolean("sistema").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("papeis_chave").on(t.organizacaoId, t.chave)],
);

export const papelPermissoes = pgTable(
  "papel_permissoes",
  {
    papelId: uuid("papel_id")
      .notNull()
      .references(() => papeis.id, { onDelete: "cascade" }),
    /** Do catálogo de @mark/core. Aceita curinga: `vendas.*`, `*`. */
    permissao: text("permissao").notNull(),
  },
  (t) => [primaryKey({ columns: [t.papelId, t.permissao] })],
);

export const membros = pgTable(
  "membros",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    papelId: uuid("papel_id")
      .notNull()
      .references(() => papeis.id),
    cargo: text("cargo"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("membros_org_usuario").on(t.organizacaoId, t.usuarioId)],
);

/**
 * Restringe um membro a um subconjunto de clientes. Ausência de linhas = acesso
 * a todos os clientes que o papel permitir.
 *
 * `cliente_id` ainda não tem chave estrangeira: a tabela `clientes` nasce na
 * migração 0003. A FK entra lá. Até então nada quebra — o escopo já é lido e
 * aplicado por `pode()`, e ids inválidos apenas não casam com nada.
 */
export const membroEscopos = pgTable(
  "membro_escopos",
  {
    membroId: uuid("membro_id")
      .notNull()
      .references(() => membros.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.membroId, t.clienteId] })],
);

export const sessoes = pgTable(
  "sessoes",
  {
    id: uuid("id").primaryKey(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id),
    /** SHA-256 do token. O token cru existe só no cookie do navegador. */
    tokenHash: text("token_hash").notNull(),
    ip: inet("ip"),
    agente: text("agente"),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    revogadaEm: timestamp("revogada_em", { withTimezone: true }),
    ultimoUso: timestamp("ultimo_uso", { withTimezone: true }).notNull().defaultNow(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessoes_token").on(t.tokenHash),
    index("sessoes_usuario").on(t.usuarioId),
  ],
);

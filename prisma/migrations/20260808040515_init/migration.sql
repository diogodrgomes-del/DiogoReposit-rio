-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('PROPRIETARIO', 'ADMIN', 'GESTOR', 'COMERCIAL', 'FINANCEIRO', 'TRAFEGO', 'SOCIAL', 'DESIGNER', 'EDITOR', 'FILMMAKER', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "EfeitoGrant" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ATIVO', 'ONBOARDING', 'PAUSADO', 'INADIMPLENTE', 'EM_RISCO', 'CANCELADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "Saude" AS ENUM ('VERDE', 'AMARELO', 'VERMELHO');

-- CreateEnum
CREATE TYPE "PapelContato" AS ENUM ('PRINCIPAL', 'FINANCEIRO', 'MARKETING', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('ATIVO', 'PAUSADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoPipeline" AS ENUM ('VENDAS', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "TipoEtapa" AS ENUM ('ABERTO', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "Temperatura" AS ENUM ('FRIO', 'MORNO', 'QUENTE');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('LIGACAO', 'REUNIAO', 'FOLLOWUP', 'MENSAGEM', 'VISITA', 'APRESENTACAO', 'PROPOSTA', 'TAREFA');

-- CreateEnum
CREATE TYPE "StatusProposta" AS ENUM ('RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'AGUARDANDO', 'NEGOCIACAO', 'APROVADA', 'RECUSADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('REUNIAO', 'GRAVACAO', 'VISITA', 'ENTREGA', 'PRODUCAO', 'CAMPANHA', 'PRAZO', 'EVENTO', 'VIAGEM', 'INTERNO', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "StatusGravacao" AS ENUM ('PLANEJADA', 'CONFIRMADA', 'AGUARDANDO_ROTEIRO', 'PRONTA', 'REALIZADA', 'CANCELADA', 'REAGENDADA');

-- CreateEnum
CREATE TYPE "AcaoCredencial" AS ENUM ('VER', 'COPIAR', 'CRIAR', 'EDITAR', 'EXCLUIR');

-- CreateEnum
CREATE TYPE "EscopoFin" AS ENUM ('EMPRESA', 'PESSOAL');

-- CreateEnum
CREATE TYPE "TipoFin" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "StatusFin" AS ENUM ('PREVISTO', 'PENDENTE', 'PAGO', 'RECEBIDO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('META', 'GOOGLE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "NivelMetrica" AS ENUM ('CONTA', 'CAMPANHA', 'CONJUNTO', 'ANUNCIO');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fuso" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "cargo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "permissao" TEXT NOT NULL,
    "efeito" "EfeitoGrant" NOT NULL,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_assignments" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,

    CONSTRAINT "client_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "ultima_atividade_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogada_em" TIMESTAMP(3),
    "step_up_em" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "instagram" TEXT,
    "empresa" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "foto_url" TEXT,
    "opt_out_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT,
    "segmento" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "endereco" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "tiktok" TEXT,
    "site" TEXT,
    "gmn_url" TEXT,
    "status" "StatusCliente" NOT NULL DEFAULT 'ONBOARDING',
    "saude" "Saude" NOT NULL DEFAULT 'VERDE',
    "responsavel_id" TEXT,
    "entrou_em" TIMESTAMP(3),
    "encerrado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "papel" "PapelContato" NOT NULL DEFAULT 'PRINCIPAL',

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor_base_cents" INTEGER NOT NULL DEFAULT 0,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "plano_id" TEXT,
    "valor_mensal_cents" INTEGER NOT NULL DEFAULT 0,
    "inicio_em" TIMESTAMP(3) NOT NULL,
    "dia_vencimento" INTEGER NOT NULL DEFAULT 10,
    "prazo_meses" INTEGER,
    "renova_em" TIMESTAMP(3),
    "status" "StatusContrato" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_strategies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "objetivo_principal" TEXT,
    "posicionamento" TEXT,
    "publico_alvo" TEXT,
    "persona" TEXT,
    "tom_de_voz" TEXT,
    "regioes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "diferenciais" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "concorrentes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "palavras_permitidas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "palavras_proibidas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pilares_conteudo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objecoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dores" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "desejos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "campos_extras" JSONB NOT NULL DEFAULT '{}',
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoPipeline" NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "cor" TEXT NOT NULL DEFAULT 'cinza',
    "tipo" "TipoEtapa" NOT NULL DEFAULT 'ABERTO',

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_origins" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lead_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loss_reasons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loss_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "responsavel_id" TEXT,
    "client_id" TEXT,
    "titulo" TEXT,
    "valor_estimado_cents" INTEGER NOT NULL DEFAULT 0,
    "origem_id" TEXT,
    "temperatura" "Temperatura",
    "servico_interesse" TEXT,
    "proxima_acao" TEXT,
    "proxima_acao_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "posicao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entrou_no_estagio_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ganho_em" TIMESTAMP(3),
    "perdido_em" TIMESTAMP(3),
    "motivo_perda_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tipo" "TipoAtividade" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "lead_id" TEXT,
    "client_id" TEXT,
    "demand_id" TEXT,
    "responsavel_id" TEXT,
    "inicia_em" TIMESTAMP(3),
    "duracao_min" INTEGER,
    "concluida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "lead_id" TEXT,
    "client_id" TEXT,
    "plano_id" TEXT,
    "titulo" TEXT NOT NULL,
    "valor_cents" INTEGER NOT NULL DEFAULT 0,
    "desconto_cents" INTEGER NOT NULL DEFAULT 0,
    "validade_em" TIMESTAMP(3),
    "status" "StatusProposta" NOT NULL DEFAULT 'RASCUNHO',
    "enviada_em" TIMESTAMP(3),
    "decidida_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT 'cinza',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "demand_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demands" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "client_id" TEXT,
    "project_id" TEXT,
    "pipeline_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "tipo_id" TEXT,
    "prioridade" "Prioridade" NOT NULL DEFAULT 'NORMAL',
    "responsavel_id" TEXT,
    "aprovador_id" TEXT,
    "prazo_em" TIMESTAMP(3),
    "iniciada_em" TIMESTAMP(3),
    "concluida_em" TIMESTAMP(3),
    "tempo_estimado_min" INTEGER,
    "posicao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entrou_no_estagio_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "responsavel_id" TEXT,
    "prazo_em" TIMESTAMP(3),
    "concluida_em" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "inicio_em" TIMESTAMP(3) NOT NULL,
    "fim_em" TIMESTAMP(3),
    "minutos" INTEGER NOT NULL DEFAULT 0,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entidade_tipo" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "resolvido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT 'cinza',

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taggings" (
    "id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "entidade_tipo" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,

    CONSTRAINT "taggings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL DEFAULT 'REUNIAO',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "client_id" TEXT,
    "inicio_em" TIMESTAMP(3) NOT NULL,
    "fim_em" TIMESTAMP(3) NOT NULL,
    "dia_inteiro" BOOLEAN NOT NULL DEFAULT false,
    "local" TEXT,
    "link_reuniao" TEXT,
    "status_gravacao" "StatusGravacao",
    "equipe" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipamentos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cancelado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "demand_id" TEXT,
    "nome" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "uploader_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "plataforma" TEXT NOT NULL,
    "login" TEXT,
    "url" TEXT,
    "segredo_cipher" BYTEA NOT NULL,
    "segredo_iv" BYTEA NOT NULL,
    "segredo_tag" BYTEA NOT NULL,
    "notas" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_access_log" (
    "id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "acao" "AcaoCredencial" NOT NULL,
    "ip" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoFin" NOT NULL,
    "escopo" "EscopoFin" NOT NULL DEFAULT 'EMPRESA',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fin_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "escopo" "EscopoFin" NOT NULL DEFAULT 'EMPRESA',
    "owner_user_id" TEXT,
    "tipo" "TipoFin" NOT NULL,
    "descricao" TEXT NOT NULL,
    "client_id" TEXT,
    "contract_id" TEXT,
    "fornecedor" TEXT,
    "category_id" TEXT,
    "valor_cents" INTEGER NOT NULL,
    "valor_pago_cents" INTEGER NOT NULL DEFAULT 0,
    "vencimento_em" TIMESTAMP(3) NOT NULL,
    "competencia_em" TIMESTAMP(3),
    "quitado_em" TIMESTAMP(3),
    "status" "StatusFin" NOT NULL DEFAULT 'PENDENTE',
    "forma_pagamento" TEXT,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "fin_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_payments" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "valor_cents" INTEGER NOT NULL,
    "data_em" TIMESTAMP(3) NOT NULL,
    "forma" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL DEFAULT 'META',
    "external_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_sync_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_metrics_daily" (
    "id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "nivel" "NivelMetrica" NOT NULL DEFAULT 'CONTA',
    "external_id" TEXT NOT NULL,
    "nome" TEXT,
    "objetivo" TEXT,
    "status" TEXT,
    "gasto_cents" INTEGER NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "alcance" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "cliques_link" INTEGER NOT NULL DEFAULT 0,
    "conversas" INTEGER NOT NULL DEFAULT 0,
    "resposta1" INTEGER NOT NULL DEFAULT 0,
    "sincronizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traffic_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'OBSERVACAO',
    "corpo" TEXT NOT NULL,
    "autor_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT,
    "url" TEXT,
    "permissao_exigida" TEXT,
    "lida_em" TIMESTAMP(3),
    "arquivada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "acao" TEXT NOT NULL,
    "entidade_tipo" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "resumo" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "ip" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "processado_em" TIMESTAMP(3),
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_organization_id_ativo_idx" ON "memberships"("organization_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_grants_membership_id_permissao_key" ON "permission_grants"("membership_id", "permissao");

-- CreateIndex
CREATE INDEX "client_assignments_client_id_idx" ON "client_assignments"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_assignments_membership_id_client_id_key" ON "client_assignments"("membership_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revogada_em_idx" ON "sessions"("user_id", "revogada_em");

-- CreateIndex
CREATE INDEX "contacts_organization_id_nome_idx" ON "contacts"("organization_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_telefone_key" ON "contacts"("organization_id", "telefone");

-- CreateIndex
CREATE INDEX "clients_organization_id_status_idx" ON "clients"("organization_id", "status");

-- CreateIndex
CREATE INDEX "clients_organization_id_razao_social_idx" ON "clients"("organization_id", "razao_social");

-- CreateIndex
CREATE UNIQUE INDEX "client_contacts_client_id_contact_id_key" ON "client_contacts"("client_id", "contact_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_client_id_idx" ON "contracts"("organization_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_strategies_client_id_key" ON "client_strategies"("client_id");

-- CreateIndex
CREATE INDEX "pipelines_organization_id_tipo_idx" ON "pipelines"("organization_id", "tipo");

-- CreateIndex
CREATE INDEX "pipeline_stages_pipeline_id_ordem_idx" ON "pipeline_stages"("pipeline_id", "ordem");

-- CreateIndex
CREATE INDEX "leads_organization_id_stage_id_posicao_idx" ON "leads"("organization_id", "stage_id", "posicao");

-- CreateIndex
CREATE INDEX "leads_organization_id_responsavel_id_idx" ON "leads"("organization_id", "responsavel_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_proxima_acao_em_idx" ON "leads"("organization_id", "proxima_acao_em");

-- CreateIndex
CREATE INDEX "activities_organization_id_responsavel_id_inicia_em_idx" ON "activities"("organization_id", "responsavel_id", "inicia_em");

-- CreateIndex
CREATE INDEX "activities_lead_id_idx" ON "activities"("lead_id");

-- CreateIndex
CREATE INDEX "proposals_organization_id_status_idx" ON "proposals"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_organization_id_numero_key" ON "proposals"("organization_id", "numero");

-- CreateIndex
CREATE INDEX "demands_organization_id_stage_id_posicao_idx" ON "demands"("organization_id", "stage_id", "posicao");

-- CreateIndex
CREATE INDEX "demands_organization_id_responsavel_id_prazo_em_idx" ON "demands"("organization_id", "responsavel_id", "prazo_em");

-- CreateIndex
CREATE INDEX "demands_organization_id_client_id_idx" ON "demands"("organization_id", "client_id");

-- CreateIndex
CREATE INDEX "subtasks_demand_id_ordem_idx" ON "subtasks"("demand_id", "ordem");

-- CreateIndex
CREATE INDEX "time_entries_demand_id_idx" ON "time_entries"("demand_id");

-- CreateIndex
CREATE INDEX "time_entries_user_id_inicio_em_idx" ON "time_entries"("user_id", "inicio_em");

-- CreateIndex
CREATE INDEX "comments_organization_id_entidade_tipo_entidade_id_criado_e_idx" ON "comments"("organization_id", "entidade_tipo", "entidade_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_nome_key" ON "tags"("organization_id", "nome");

-- CreateIndex
CREATE INDEX "taggings_entidade_tipo_entidade_id_idx" ON "taggings"("entidade_tipo", "entidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "taggings_tag_id_entidade_tipo_entidade_id_key" ON "taggings"("tag_id", "entidade_tipo", "entidade_id");

-- CreateIndex
CREATE INDEX "events_organization_id_inicio_em_idx" ON "events"("organization_id", "inicio_em");

-- CreateIndex
CREATE INDEX "events_organization_id_tipo_inicio_em_idx" ON "events"("organization_id", "tipo", "inicio_em");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_event_id_user_id_key" ON "event_participants"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_organization_id_client_id_idx" ON "files"("organization_id", "client_id");

-- CreateIndex
CREATE INDEX "credentials_organization_id_client_id_idx" ON "credentials"("organization_id", "client_id");

-- CreateIndex
CREATE INDEX "credential_access_log_credential_id_em_idx" ON "credential_access_log"("credential_id", "em");

-- CreateIndex
CREATE INDEX "fin_categories_organization_id_tipo_idx" ON "fin_categories"("organization_id", "tipo");

-- CreateIndex
CREATE INDEX "fin_entries_organization_id_escopo_status_vencimento_em_idx" ON "fin_entries"("organization_id", "escopo", "status", "vencimento_em");

-- CreateIndex
CREATE INDEX "fin_entries_organization_id_client_id_vencimento_em_idx" ON "fin_entries"("organization_id", "client_id", "vencimento_em");

-- CreateIndex
CREATE INDEX "fin_payments_entry_id_idx" ON "fin_payments"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_accounts_organization_id_plataforma_external_id_key" ON "ad_accounts"("organization_id", "plataforma", "external_id");

-- CreateIndex
CREATE INDEX "ad_metrics_daily_ad_account_id_data_idx" ON "ad_metrics_daily"("ad_account_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ad_metrics_daily_ad_account_id_data_nivel_external_id_key" ON "ad_metrics_daily"("ad_account_id", "data", "nivel", "external_id");

-- CreateIndex
CREATE INDEX "traffic_notes_organization_id_client_id_data_idx" ON "traffic_notes"("organization_id", "client_id", "data");

-- CreateIndex
CREATE INDEX "notifications_user_id_lida_em_criado_em_idx" ON "notifications"("user_id", "lida_em", "criado_em");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_em_idx" ON "audit_logs"("organization_id", "em");

-- CreateIndex
CREATE INDEX "audit_logs_entidade_tipo_entidade_id_em_idx" ON "audit_logs"("entidade_tipo", "entidade_id", "em");

-- CreateIndex
CREATE INDEX "outbox_processado_em_criado_em_idx" ON "outbox"("processado_em", "criado_em");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_strategies" ADD CONSTRAINT "client_strategies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_origins" ADD CONSTRAINT "lead_origins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_reasons" ADD CONSTRAINT "loss_reasons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_origem_id_fkey" FOREIGN KEY ("origem_id") REFERENCES "lead_origins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_motivo_perda_id_fkey" FOREIGN KEY ("motivo_perda_id") REFERENCES "loss_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_types" ADD CONSTRAINT "demand_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "demand_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taggings" ADD CONSTRAINT "taggings_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_access_log" ADD CONSTRAINT "credential_access_log_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_access_log" ADD CONSTRAINT "credential_access_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_categories" ADD CONSTRAINT "fin_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_entries" ADD CONSTRAINT "fin_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_entries" ADD CONSTRAINT "fin_entries_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_entries" ADD CONSTRAINT "fin_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_entries" ADD CONSTRAINT "fin_entries_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_entries" ADD CONSTRAINT "fin_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fin_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payments" ADD CONSTRAINT "fin_payments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "fin_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_metrics_daily" ADD CONSTRAINT "ad_metrics_daily_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_notes" ADD CONSTRAINT "traffic_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

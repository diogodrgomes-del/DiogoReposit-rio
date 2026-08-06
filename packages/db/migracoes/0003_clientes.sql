-- 0003 — Contatos, clientes, etiquetas e vínculos.
--
-- `contatos` é a âncora de identidade do sistema. Lead e cliente apontam para
-- ele; a conversa de WhatsApp também. É o que faz "transformar lead em cliente"
-- não duplicar dado nem partir o histórico em dois.

CREATE TABLE contatos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome           text NOT NULL,
  telefone_e164  text,
  email          citext,
  foto_url       text,
  instagram      text,
  cargo          text,
  observacoes    text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz,
  criado_por     uuid REFERENCES usuarios(id),
  atualizado_por uuid REFERENCES usuarios(id)
);

-- O índice que impede contato duplicado quando chega mensagem de WhatsApp.
-- Parcial em excluido_em: um contato apagado libera o telefone.
CREATE UNIQUE INDEX contatos_telefone
  ON contatos (organizacao_id, telefone_e164)
  WHERE telefone_e164 IS NOT NULL AND excluido_em IS NULL;

CREATE INDEX contatos_ativos ON contatos (organizacao_id) WHERE excluido_em IS NULL;

-- unaccent para "Óticas" encontrar "oticas"; trigram para tolerar erro de
-- digitação, que é o requisito de "busca tolerante a pequenas diferenças".
CREATE INDEX contatos_nome_trgm ON contatos USING gin (nome gin_trgm_ops);

CREATE TABLE clientes (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),

  -- O ÚNICO campo obrigatório de cliente. Tudo o mais entra depois.
  nome           text NOT NULL,

  nome_fantasia  text,
  cnpj           text,
  segmento       text,
  telefone_e164  text,
  email          citext,
  cidade         text,
  estado         char(2),
  endereco       text,
  instagram      text,
  facebook       text,
  tiktok         text,
  site           text,
  google_meu_negocio text,

  responsavel_id         uuid REFERENCES usuarios(id),
  contato_principal_id   uuid REFERENCES contatos(id),
  contato_financeiro_id  uuid REFERENCES contatos(id),
  contato_marketing_id   uuid REFERENCES contatos(id),

  status text NOT NULL DEFAULT 'onboarding'
    CHECK (status IN ('ativo','onboarding','pausado','inadimplente',
                      'em_risco','cancelado','encerrado')),
  saude  text NOT NULL DEFAULT 'verde'
    CHECK (saude IN ('verde','amarelo','vermelho')),

  observacoes    text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz,
  criado_por     uuid REFERENCES usuarios(id),
  atualizado_por uuid REFERENCES usuarios(id)
);

CREATE INDEX clientes_ativos ON clientes (organizacao_id) WHERE excluido_em IS NULL;
CREATE INDEX clientes_status ON clientes (organizacao_id, status) WHERE excluido_em IS NULL;
CREATE INDEX clientes_responsavel ON clientes (organizacao_id, responsavel_id)
  WHERE excluido_em IS NULL;
CREATE INDEX clientes_nome_trgm ON clientes USING gin (nome gin_trgm_ops);

-- Duas empresas com o mesmo CNPJ na mesma organização são a mesma empresa
-- cadastrada duas vezes. O campo é opcional; quando preenchido, é único.
CREATE UNIQUE INDEX clientes_cnpj
  ON clientes (organizacao_id, cnpj)
  WHERE cnpj IS NOT NULL AND excluido_em IS NULL;

-- A FK que ficou pendente na migração 0001, quando `clientes` ainda não existia.
ALTER TABLE membro_escopos
  ADD CONSTRAINT membro_escopos_cliente_fk
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

-- Uma pessoa pode responder por mais de uma empresa.
CREATE TABLE cliente_contatos (
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  contato_id uuid NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  papel      text,
  PRIMARY KEY (cliente_id, contato_id)
);
CREATE INDEX cliente_contatos_contato ON cliente_contatos (contato_id);

CREATE TABLE etiquetas (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome           text NOT NULL,
  cor            text NOT NULL DEFAULT 'cinza',
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX etiquetas_nome ON etiquetas (organizacao_id, lower(nome));

-- Vínculo polimórfico: evita quinze colunas de chave estrangeira espalhadas por
-- quinze tabelas. Sem integridade referencial do Postgres, então o CHECK abaixo
-- limita os tipos aceitos e um job semanal (fase 3) apaga órfãos.
CREATE TABLE vinculos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  tipo_origem    text NOT NULL CHECK (tipo_origem IN ('etiqueta','arquivo')),
  origem_id      uuid NOT NULL,
  tipo_entidade  text NOT NULL
    CHECK (tipo_entidade IN ('cliente','contato','lead','demanda','proposta')),
  entidade_id    uuid NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_origem, origem_id, tipo_entidade, entidade_id)
);
CREATE INDEX vinculos_entidade ON vinculos (tipo_entidade, entidade_id);

-- Linha do tempo visível ao usuário. Diferente de `auditoria`, que é
-- append-only e existe para conformidade: esta é produto, é lida o tempo todo e
-- some junto com a entidade.
CREATE TABLE eventos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  tipo_entidade  text NOT NULL,
  entidade_id    uuid NOT NULL,
  tipo           text NOT NULL,
  ator_id        uuid REFERENCES usuarios(id),
  dados          jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eventos_entidade ON eventos (tipo_entidade, entidade_id, criado_em DESC);
CREATE INDEX eventos_org ON eventos (organizacao_id, criado_em DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE contatos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos          FORCE  ROW LEVEL SECURITY;
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes          FORCE  ROW LEVEL SECURITY;
ALTER TABLE etiquetas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE etiquetas         FORCE  ROW LEVEL SECURITY;
ALTER TABLE vinculos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos          FORCE  ROW LEVEL SECURITY;
ALTER TABLE eventos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos           FORCE  ROW LEVEL SECURITY;
ALTER TABLE cliente_contatos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_contatos  FORCE  ROW LEVEL SECURITY;

CREATE POLICY contatos_isolamento ON contatos
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY clientes_isolamento ON clientes
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY etiquetas_isolamento ON etiquetas
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY vinculos_isolamento ON vinculos
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY eventos_isolamento ON eventos
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY cliente_contatos_isolamento ON cliente_contatos
  USING (
    app_admin()
    OR EXISTS (SELECT 1 FROM clientes c
                WHERE c.id = cliente_contatos.cliente_id
                  AND c.organizacao_id = app_org())
  )
  WITH CHECK (
    app_admin()
    OR EXISTS (SELECT 1 FROM clientes c
                WHERE c.id = cliente_contatos.cliente_id
                  AND c.organizacao_id = app_org())
  );

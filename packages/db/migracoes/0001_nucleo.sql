-- 0001 — Núcleo de identidade: organizações, usuários, papéis, membros, sessões.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE organizacoes (
  id              uuid PRIMARY KEY,
  nome            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  proprietario_id uuid,
  plano           text NOT NULL DEFAULT 'interno',
  configuracoes   jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  excluido_em     timestamptz
);

CREATE TABLE usuarios (
  id             uuid PRIMARY KEY,
  email          citext NOT NULL,
  nome           text NOT NULL,
  senha_hash     text,
  avatar_url     text,
  telefone_e164  text,
  ultimo_acesso  timestamptz,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz
);

-- Parcial: um e-mail liberado por exclusão lógica pode ser reutilizado.
CREATE UNIQUE INDEX usuarios_email ON usuarios (email) WHERE excluido_em IS NULL;

ALTER TABLE organizacoes
  ADD CONSTRAINT organizacoes_proprietario_fk
  FOREIGN KEY (proprietario_id) REFERENCES usuarios(id);

CREATE TABLE papeis (
  id             uuid PRIMARY KEY,
  organizacao_id uuid REFERENCES organizacoes(id),
  chave          text NOT NULL,
  nome           text NOT NULL,
  descricao      text,
  sistema        boolean NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- NULLS NOT DISTINCT para que dois papéis de sistema (organizacao_id NULL) não
-- possam repetir a mesma chave. Sem isso o índice deixaria passar duplicata,
-- porque em Postgres NULL <> NULL.
CREATE UNIQUE INDEX papeis_chave
  ON papeis (organizacao_id, chave) NULLS NOT DISTINCT;

CREATE TABLE papel_permissoes (
  papel_id  uuid NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  permissao text NOT NULL,
  PRIMARY KEY (papel_id, permissao),
  -- A trava do financeiro pessoal também no banco: nem um INSERT manual
  -- concede. A regra existe em @mark/core; aqui ela vira restrição.
  CONSTRAINT permissao_concedivel
    CHECK (permissao NOT LIKE 'financeiro.pessoal.%')
);

CREATE TABLE membros (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  usuario_id     uuid NOT NULL REFERENCES usuarios(id),
  papel_id       uuid NOT NULL REFERENCES papeis(id),
  cargo          text,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX membros_org_usuario ON membros (organizacao_id, usuario_id);
CREATE INDEX membros_usuario ON membros (usuario_id) WHERE ativo;

-- cliente_id ganha FK na migração 0003, junto com a tabela clientes.
CREATE TABLE membro_escopos (
  membro_id  uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL,
  PRIMARY KEY (membro_id, cliente_id)
);

CREATE TABLE sessoes (
  id             uuid PRIMARY KEY,
  usuario_id     uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  token_hash     text NOT NULL,
  ip             inet,
  agente         text,
  expira_em      timestamptz NOT NULL,
  revogada_em    timestamptz,
  ultimo_uso     timestamptz NOT NULL DEFAULT now(),
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sessoes_token ON sessoes (token_hash);
CREATE INDEX sessoes_usuario ON sessoes (usuario_id) WHERE revogada_em IS NULL;
-- Usado pela limpeza periódica do worker.
CREATE INDEX sessoes_expiradas ON sessoes (expira_em);

-- 0004 — Cofre de credenciais.
--
-- Guarda token da Meta, senha de plataforma do cliente e credencial de
-- integração. Nada em texto puro: as colunas são bytea com envelope
-- AES-256-GCM produzido por @mark/cofre.

CREATE TABLE credenciais (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  cliente_id     uuid REFERENCES clientes(id) ON DELETE CASCADE,

  plataforma     text NOT NULL,        -- meta_ads, google_ads, instagram, wordpress…
  rotulo         text,                 -- para distinguir duas contas na mesma plataforma
  login          text,
  link           text,

  -- nonce ‖ texto cifrado ‖ tag. O AAD é `organizacao_id:id`, o que impede
  -- copiar a linha para outro cliente ou outra organização: a decifragem falha.
  segredo_cifrado bytea NOT NULL,
  dek_cifrada     bytea NOT NULL,
  versao_kek      int   NOT NULL,

  -- Pistas para reconhecer o segredo sem revelá-lo. Nunca o suficiente para
  -- reconstruí-lo.
  dica           text,
  expira_em      date,

  observacoes    text,
  responsavel_id uuid REFERENCES usuarios(id),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz,
  criado_por     uuid REFERENCES usuarios(id),
  atualizado_por uuid REFERENCES usuarios(id)
);

CREATE INDEX credenciais_cliente ON credenciais (organizacao_id, cliente_id)
  WHERE excluido_em IS NULL;
CREATE INDEX credenciais_plataforma ON credenciais (organizacao_id, plataforma)
  WHERE excluido_em IS NULL;

-- Duas credenciais da mesma plataforma para o mesmo cliente precisam de rótulo
-- diferente, senão ninguém sabe qual é qual três meses depois.
CREATE UNIQUE INDEX credenciais_unica
  ON credenciais (organizacao_id, cliente_id, plataforma, coalesce(rotulo, ''))
  WHERE excluido_em IS NULL;

-- ---------------------------------------------------------------------------
-- Auditoria de revelação
-- ---------------------------------------------------------------------------
-- Tabela separada e imutável. Toda revelação é gravada ANTES de o segredo sair
-- do servidor: se a gravação falhar, o segredo não é entregue. Auditoria que
-- pode ser desligada pela mesma falha que se quer auditar não serve.
CREATE TABLE credencial_acessos (
  id            bigserial PRIMARY KEY,
  organizacao_id uuid NOT NULL,
  credencial_id uuid NOT NULL,
  usuario_id    uuid,
  acao          text NOT NULL CHECK (acao IN ('revelou','copiou','editou','criou','excluiu')),
  ip            inet,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credencial_acessos_credencial
  ON credencial_acessos (credencial_id, criado_em DESC);
CREATE INDEX credencial_acessos_usuario
  ON credencial_acessos (organizacao_id, usuario_id, criado_em DESC);

-- Imutabilidade por gatilho, e não por REVOKE.
--
-- REVOKE UPDATE/DELETE não vale para o dono da tabela, que é como a aplicação
-- conecta em Postgres gerenciado — o mesmo motivo pelo qual a RLS precisa de
-- FORCE. Um gatilho vale para todo mundo, inclusive para quem tem a credencial
-- do banco em mãos.
CREATE OR REPLACE FUNCTION credencial_acessos_imutavel() RETURNS trigger
  LANGUAGE plpgsql AS
$$
BEGIN
  RAISE EXCEPTION 'credencial_acessos é somente-anexação: % não é permitido', TG_OP;
END;
$$;

CREATE TRIGGER credencial_acessos_sem_alteracao
  BEFORE UPDATE OR DELETE ON credencial_acessos
  FOR EACH ROW EXECUTE FUNCTION credencial_acessos_imutavel();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE credenciais         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credenciais         FORCE  ROW LEVEL SECURITY;
ALTER TABLE credencial_acessos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credencial_acessos  FORCE  ROW LEVEL SECURITY;

CREATE POLICY credenciais_isolamento ON credenciais
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY credencial_acessos_isolamento ON credencial_acessos
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

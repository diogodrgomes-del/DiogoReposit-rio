-- 0007 — Pipeline comercial: etapas, leads, atividades e propostas.

CREATE TABLE pipelines (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome           text NOT NULL,
  tipo           text NOT NULL CHECK (tipo IN ('vendas','operacional')),
  padrao         boolean NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- Um pipeline padrão por tipo e por organização: é o que a tela abre sem
-- ninguém escolher.
CREATE UNIQUE INDEX pipelines_padrao
  ON pipelines (organizacao_id, tipo)
  WHERE padrao;

-- Etapas são DADOS, não enum. É isso que permite "criar etapas personalizadas"
-- sem migração — e `ALTER TYPE` do Postgres trava a tabela, o que num sistema
-- em uso significa parada.
CREATE TABLE pipeline_etapas (
  id          uuid PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  ordem       int  NOT NULL,
  cor         text,
  -- Marca semanticamente onde ganho e perda acontecem, para a taxa de conversão
  -- não depender do nome que alguém deu à coluna.
  tipo        text NOT NULL DEFAULT 'aberta' CHECK (tipo IN ('aberta','ganho','perda')),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pipeline_etapas_ordem ON pipeline_etapas (pipeline_id, ordem);
CREATE INDEX pipeline_etapas_pipeline ON pipeline_etapas (pipeline_id);

CREATE TABLE leads (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),

  -- Nome e telefone vivem no contato, não aqui. É o que faz "transformar lead
  -- em cliente" não duplicar dado nem partir o histórico em dois — e o que
  -- permite a conversa de WhatsApp seguir a mesma pessoa antes e depois.
  contato_id     uuid NOT NULL REFERENCES contatos(id),

  empresa        text,
  site           text,
  cidade         text,
  estado         char(2),
  segmento       text,
  origem         text,
  servico        text,
  valor_estimado numeric(14,2),
  temperatura    text CHECK (temperatura IN ('quente','morno','frio')),

  responsavel_id uuid REFERENCES usuarios(id),
  etapa_id       uuid NOT NULL REFERENCES pipeline_etapas(id),

  -- Ordenação fracionária: um card entre as posições 3 e 4 recebe 3.5.
  -- Arrastar vira UM update de UMA linha, em vez de reindexar a coluna inteira.
  -- Com 200 cards é a diferença entre 4ms e 400ms, e dois usuários arrastando
  -- ao mesmo tempo não disputam lock.
  ordem          numeric NOT NULL,

  proxima_acao       text,
  proximo_contato_em date,

  motivo_perda   text,
  fechado_em     timestamptz,
  perdido_em     timestamptz,
  -- Preenchido pelo onboarding, quando o lead vira cliente.
  cliente_id     uuid REFERENCES clientes(id) ON DELETE SET NULL,

  observacoes    text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz,
  criado_por     uuid REFERENCES usuarios(id),
  atualizado_por uuid REFERENCES usuarios(id)
);

-- Índice do Kanban: cobre exatamente a consulta que monta uma coluna.
CREATE INDEX leads_coluna
  ON leads (organizacao_id, etapa_id, ordem)
  WHERE excluido_em IS NULL;

-- "Meus leads em aberto", o filtro mais usado do módulo.
CREATE INDEX leads_responsavel
  ON leads (organizacao_id, responsavel_id)
  WHERE excluido_em IS NULL AND fechado_em IS NULL AND perdido_em IS NULL;

CREATE INDEX leads_contato ON leads (contato_id);

-- Sem retorno: leads cujo próximo contato já venceu. Vira card do painel geral.
CREATE INDEX leads_retorno
  ON leads (organizacao_id, proximo_contato_em)
  WHERE excluido_em IS NULL AND fechado_em IS NULL AND perdido_em IS NULL;

CREATE TABLE atividades (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  lead_id        uuid REFERENCES leads(id) ON DELETE CASCADE,
  cliente_id     uuid REFERENCES clientes(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  titulo         text NOT NULL,
  responsavel_id uuid REFERENCES usuarios(id),
  agendada_para  timestamptz,
  concluida_em   timestamptz,
  lembrete_min   int,
  observacao     text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz,
  criado_por     uuid REFERENCES usuarios(id),

  -- Atividade solta, sem lead nem cliente, não tem onde aparecer.
  CONSTRAINT atividade_tem_dono CHECK (lead_id IS NOT NULL OR cliente_id IS NOT NULL)
);

CREATE INDEX atividades_pendentes
  ON atividades (organizacao_id, responsavel_id, agendada_para)
  WHERE concluida_em IS NULL AND excluido_em IS NULL;

CREATE INDEX atividades_lead ON atividades (lead_id, criado_em DESC);

CREATE TABLE propostas (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  lead_id        uuid REFERENCES leads(id) ON DELETE SET NULL,
  cliente_id     uuid REFERENCES clientes(id) ON DELETE SET NULL,
  numero         serial,
  plano          text,
  servicos       jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor          numeric(14,2),
  desconto       numeric(14,2) NOT NULL DEFAULT 0,
  validade       date,
  enviada_em     timestamptz,
  visualizada_em timestamptz,
  status         text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviada','visualizada','aguardando',
                      'negociacao','aprovada','recusada','vencida')),
  responsavel_id uuid REFERENCES usuarios(id),
  observacoes    text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz,
  criado_por     uuid REFERENCES usuarios(id)
);

CREATE INDEX propostas_lead ON propostas (lead_id);
CREATE INDEX propostas_abertas
  ON propostas (organizacao_id, status, validade)
  WHERE excluido_em IS NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE pipelines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines       FORCE  ROW LEVEL SECURITY;
ALTER TABLE pipeline_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_etapas FORCE  ROW LEVEL SECURITY;
ALTER TABLE leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads           FORCE  ROW LEVEL SECURITY;
ALTER TABLE atividades      ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades      FORCE  ROW LEVEL SECURITY;
ALTER TABLE propostas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas       FORCE  ROW LEVEL SECURITY;

CREATE POLICY pipelines_isolamento ON pipelines
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY pipeline_etapas_isolamento ON pipeline_etapas
  USING (
    app_admin()
    OR EXISTS (SELECT 1 FROM pipelines p
                WHERE p.id = pipeline_etapas.pipeline_id
                  AND p.organizacao_id = app_org())
  )
  WITH CHECK (
    app_admin()
    OR EXISTS (SELECT 1 FROM pipelines p
                WHERE p.id = pipeline_etapas.pipeline_id
                  AND p.organizacao_id = app_org())
  );

CREATE POLICY leads_isolamento ON leads
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY atividades_isolamento ON atividades
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY propostas_isolamento ON propostas
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

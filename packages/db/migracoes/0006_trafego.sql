-- 0006 — Contas de anúncio e métricas diárias.
--
-- O painel lê a Graph API a cada requisição. Para um cliente por vez isso está
-- certo: o dado vive na Meta e copiar não ajudaria. Para a carteira inteira,
-- não: são vinte chamadas sequenciais a uma API de terceiro com limite de taxa,
-- e uma queda da Meta derruba a tela.
--
-- Com a série no banco, a consulta é indexada, funciona com a Meta fora do ar,
-- e o histórico deixa de depender dos 37 meses que a Meta guarda.

CREATE TABLE contas_anuncio (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  cliente_id     uuid REFERENCES clientes(id) ON DELETE CASCADE,

  plataforma     text NOT NULL DEFAULT 'meta_ads'
    CHECK (plataforma IN ('meta_ads','google_ads','tiktok_ads')),
  -- Id na plataforma: `act_123456789` no Meta. Não é o nosso uuid.
  externo_id     text NOT NULL,
  nome           text NOT NULL,
  moeda          text NOT NULL DEFAULT 'BRL',

  -- Qual credencial destranca esta conta. Sem ela o sync não roda.
  credencial_id  uuid REFERENCES credenciais(id) ON DELETE SET NULL,

  ativa                boolean NOT NULL DEFAULT true,
  ultima_sincronizacao timestamptz,
  ultimo_erro          text,

  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  excluido_em    timestamptz
);

CREATE UNIQUE INDEX contas_anuncio_externa
  ON contas_anuncio (organizacao_id, plataforma, externo_id)
  WHERE excluido_em IS NULL;

CREATE INDEX contas_anuncio_cliente
  ON contas_anuncio (organizacao_id, cliente_id)
  WHERE excluido_em IS NULL AND ativa;

-- ---------------------------------------------------------------------------
-- Métricas
-- ---------------------------------------------------------------------------
-- Uma linha por conta, por campanha e por dia. `campanha_externa_id` nulo
-- guarda o total da conta naquele dia — evita somar dezenas de campanhas toda
-- vez que alguém abre o painel da carteira.
CREATE TABLE metricas_diarias (
  organizacao_id      uuid NOT NULL REFERENCES organizacoes(id),
  conta_id            uuid NOT NULL REFERENCES contas_anuncio(id) ON DELETE CASCADE,
  campanha_externa_id text,
  dia                 date NOT NULL,

  campanha_nome     text,
  campanha_status   text,
  campanha_objetivo text,

  -- numeric, não float: gasto é dinheiro, e float erra centavo de um jeito que
  -- acumula ao somar noventa dias.
  gasto         numeric(14,2) NOT NULL DEFAULT 0,
  impressoes    bigint  NOT NULL DEFAULT 0,
  alcance       bigint  NOT NULL DEFAULT 0,
  cliques       bigint  NOT NULL DEFAULT 0,
  cliques_link  bigint  NOT NULL DEFAULT 0,

  -- A métrica que decide para onde vai a verba.
  conversas     bigint  NOT NULL DEFAULT 0,
  resposta1     bigint  NOT NULL DEFAULT 0,
  prof2         bigint  NOT NULL DEFAULT 0,
  prof3         bigint  NOT NULL DEFAULT 0,
  prof5         bigint  NOT NULL DEFAULT 0,

  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

-- Índice único em vez de PRIMARY KEY: chave primária implica NOT NULL em
-- Postgres, e `campanha_externa_id` é nulo justamente na linha que interessa
-- mais — o total do dia daquela conta.
--
-- NULLS NOT DISTINCT faz dois totais do mesmo dia colidirem como deveriam. Sem
-- isso, cada sincronização inseriria uma linha nova de total em vez de
-- atualizar a existente, porque em Postgres NULL <> NULL.
CREATE UNIQUE INDEX metricas_chave
  ON metricas_diarias (conta_id, dia, campanha_externa_id) NULLS NOT DISTINCT;

CREATE INDEX metricas_periodo
  ON metricas_diarias (organizacao_id, conta_id, dia DESC);

-- Serve a consulta da carteira: soma por dia de todas as contas da organização.
CREATE INDEX metricas_org_dia
  ON metricas_diarias (organizacao_id, dia DESC)
  WHERE campanha_externa_id IS NULL;

-- ---------------------------------------------------------------------------
-- Execuções de sincronização
-- ---------------------------------------------------------------------------
-- Sem este registro, "os números estão velhos" vira investigação. Com ele,
-- vira uma consulta.
CREATE TABLE sync_execucoes (
  id             bigserial PRIMARY KEY,
  organizacao_id uuid NOT NULL,
  conta_id       uuid REFERENCES contas_anuncio(id) ON DELETE CASCADE,
  origem         text NOT NULL,        -- cron, manual
  estado         text NOT NULL CHECK (estado IN ('rodando','ok','erro')),
  dias           int,
  linhas         int,
  erro           text,
  iniciado_em    timestamptz NOT NULL DEFAULT now(),
  terminado_em   timestamptz
);

CREATE INDEX sync_execucoes_conta ON sync_execucoes (conta_id, iniciado_em DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE contas_anuncio   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_anuncio   FORCE  ROW LEVEL SECURITY;
ALTER TABLE metricas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_diarias FORCE  ROW LEVEL SECURITY;
ALTER TABLE sync_execucoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_execucoes   FORCE  ROW LEVEL SECURITY;

CREATE POLICY contas_anuncio_isolamento ON contas_anuncio
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY metricas_isolamento ON metricas_diarias
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

CREATE POLICY sync_execucoes_isolamento ON sync_execucoes
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

# MARK SISTEM — Modelagem de Dados e Permissões

Documento 2 de 3. Esquema do banco, entidades, relacionamentos, índices e o
modelo de permissões.

- [`00-arquitetura.md`](00-arquitetura.md) — arquitetura geral
- [`02-roadmap.md`](02-roadmap.md) — riscos e MVP

O DDL abaixo é desenho, não migração final. Serve para ser revisado antes de
virar código.

---

## 1. Convenções

Valem para todas as tabelas. São o que mantém 40 tabelas legíveis.

| Convenção | Decisão | Motivo |
|---|---|---|
| Nomes | Português, `snake_case`, plural | O domínio é falado em português; traduzir mentalmente a cada consulta gera erro |
| Chave primária | `uuid` v7 | Ordenável por tempo — ao contrário de v4, não fragmenta o índice B-tree |
| Multi-tenant | `organizacao_id uuid NOT NULL` em toda tabela de negócio | Retrofit depois é reescrita |
| Datas | `timestamptz`, sempre UTC | Fuso é problema de exibição, não de armazenamento |
| Exclusão | `excluido_em timestamptz NULL` | Sem `DELETE` físico em tabela de negócio |
| Autoria | `criado_por`, `atualizado_por` | Auditoria barata, sempre disponível |
| Dinheiro | `numeric(14,2)` | `float` erra centavo; o erro acumula |
| Telefone | `telefone_e164 text` gerado na normalização | Chave de casamento entre WhatsApp e CRM |
| Enum | `text` + `CHECK` | `ALTER TYPE` do Postgres trava tabela; `CHECK` é alterável a quente |

Colunas de rodapé, em toda tabela de negócio:

```sql
criado_em     timestamptz NOT NULL DEFAULT now(),
atualizado_em timestamptz NOT NULL DEFAULT now(),
excluido_em   timestamptz,
criado_por    uuid REFERENCES usuarios(id),
atualizado_por uuid REFERENCES usuarios(id)
```

Índice parcial padrão, para as consultas nunca lerem lixo:

```sql
CREATE INDEX <tabela>_ativos ON <tabela> (organizacao_id)
  WHERE excluido_em IS NULL;
```

---

## 2. Núcleo — organização, usuários, permissões

```sql
CREATE TABLE organizacoes (
  id              uuid PRIMARY KEY,
  nome            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  proprietario_id uuid,                    -- FK adicionada após usuarios
  plano           text NOT NULL DEFAULT 'interno',
  configuracoes   jsonb NOT NULL DEFAULT '{}',
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id             uuid PRIMARY KEY,
  email          citext NOT NULL UNIQUE,
  nome           text NOT NULL,
  senha_hash     text,                     -- argon2id
  avatar_url     text,
  telefone_e164  text,
  ultimo_acesso  timestamptz,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- Um usuário pode pertencer a várias organizações (SaaS futuro).
CREATE TABLE membros (
  id              uuid PRIMARY KEY,
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  usuario_id      uuid NOT NULL REFERENCES usuarios(id),
  papel_id        uuid NOT NULL REFERENCES papeis(id),
  cargo           text,                    -- "Designer", "Gestor de Tráfego"
  ativo           boolean NOT NULL DEFAULT true,
  UNIQUE (organizacao_id, usuario_id)
);

CREATE TABLE papeis (
  id             uuid PRIMARY KEY,
  organizacao_id uuid REFERENCES organizacoes(id),  -- NULL = papel do sistema
  nome           text NOT NULL,
  chave          text NOT NULL,            -- proprietario, admin, comercial…
  descricao      text,
  sistema        boolean NOT NULL DEFAULT false,     -- não editável na tela
  UNIQUE (organizacao_id, chave)
);

CREATE TABLE papel_permissoes (
  papel_id  uuid NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  permissao text NOT NULL,                 -- vendas.lead.editar
  PRIMARY KEY (papel_id, permissao)
);

-- Restringe um membro a um subconjunto de clientes.
-- Sem linha aqui = acesso a todos os clientes permitidos pelo papel.
CREATE TABLE membro_escopos (
  membro_id  uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  PRIMARY KEY (membro_id, cliente_id)
);

CREATE TABLE sessoes (
  id           uuid PRIMARY KEY,
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,       -- sha256; o token cru só no cookie
  ip           inet,
  agente       text,
  expira_em    timestamptz NOT NULL,
  revogada_em  timestamptz,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessoes_usuario ON sessoes (usuario_id) WHERE revogada_em IS NULL;
```

**Sessão em banco, não só JWT.** O painel atual usa JWT puro — simples e
correto para ele, mas um JWT válido não pode ser cassado antes de expirar.
Demitir alguém às 14h e o acesso continuar até as 2h da manhã é inaceitável num
sistema com financeiro e senhas. Com registro em banco, revogar é um `UPDATE`.

---

## 3. Contatos, clientes e leads

A parte mais consequente do modelo.

```sql
-- Pessoa física. A âncora de identidade do sistema inteiro.
CREATE TABLE contatos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome           text NOT NULL,
  telefone_e164  text,                     -- +5544999998888
  email          citext,
  foto_url       text,
  instagram      text,
  observacoes    text,
  <rodapé padrão>
);

-- Impede dois contatos com o mesmo telefone na mesma organização.
-- É esta restrição que faz o WhatsApp encontrar o CRM de forma confiável.
CREATE UNIQUE INDEX contatos_telefone_unico
  ON contatos (organizacao_id, telefone_e164)
  WHERE telefone_e164 IS NOT NULL AND excluido_em IS NULL;

CREATE INDEX contatos_busca ON contatos
  USING gin (to_tsvector('portuguese', nome));

CREATE TABLE clientes (
  id                uuid PRIMARY KEY,
  organizacao_id    uuid NOT NULL REFERENCES organizacoes(id),
  nome              text NOT NULL,         -- ÚNICO campo obrigatório (10.1)
  nome_fantasia     text,
  cnpj              text,
  segmento          text,
  telefone_e164     text,
  email             citext,
  cidade            text,
  estado            char(2),
  endereco          text,
  instagram         text,
  facebook          text,
  tiktok            text,
  site              text,
  google_meu_negocio text,
  responsavel_id    uuid REFERENCES usuarios(id),
  contato_principal_id   uuid REFERENCES contatos(id),
  contato_financeiro_id  uuid REFERENCES contatos(id),
  contato_marketing_id   uuid REFERENCES contatos(id),
  status            text NOT NULL DEFAULT 'onboarding'
    CHECK (status IN ('ativo','onboarding','pausado','inadimplente',
                      'em_risco','cancelado','encerrado')),
  saude             text NOT NULL DEFAULT 'verde'
    CHECK (saude IN ('verde','amarelo','vermelho')),
  origem_lead_id    uuid REFERENCES leads(id),   -- rastreia de onde veio
  observacoes       text,
  <rodapé padrão>
);
CREATE INDEX clientes_status ON clientes (organizacao_id, status)
  WHERE excluido_em IS NULL;

CREATE TABLE leads (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  contato_id     uuid NOT NULL REFERENCES contatos(id),   -- nome e telefone vivem aqui
  empresa        text,
  site           text,
  cidade         text,
  estado         char(2),
  segmento       text,
  origem         text,                    -- indicacao, meta_ads, organico…
  servico        text,
  valor_estimado numeric(14,2),
  temperatura    text CHECK (temperatura IN ('quente','morno','frio')),
  responsavel_id uuid REFERENCES usuarios(id),
  etapa_id       uuid NOT NULL REFERENCES pipeline_etapas(id),
  ordem          numeric NOT NULL,         -- ordenação fracionária do Kanban
  proxima_acao   text,
  proximo_contato_em date,
  motivo_perda   text,
  fechado_em     timestamptz,
  perdido_em     timestamptz,
  cliente_id     uuid REFERENCES clientes(id),  -- preenchido no onboarding
  observacoes    text,
  <rodapé padrão>
);

-- Índice do Kanban: cobre exatamente a consulta que monta a coluna.
CREATE INDEX leads_coluna ON leads (organizacao_id, etapa_id, ordem)
  WHERE excluido_em IS NULL;
CREATE INDEX leads_responsavel ON leads (organizacao_id, responsavel_id)
  WHERE excluido_em IS NULL AND fechado_em IS NULL AND perdido_em IS NULL;
```

**Obrigatoriedade mínima, garantida pelo esquema.** Em `leads`, só
`contato_id`, `etapa_id` e `ordem` são `NOT NULL` — e os três são preenchidos
pelo sistema. Em `clientes`, só `nome`. O banco *não consegue* exigir o que o
briefing manda não exigir; nenhuma regra de tela precisa lembrar disso.

**Por que o lead aponta para contato em vez de guardar nome e telefone.**
Sem o contato, transformar lead em cliente copia dados e a conversa do WhatsApp
fica órfã. Com ele, a conversa não muda de dono — só passa a resolver para
cliente em vez de lead. Um telefone, uma identidade, um histórico.

---

## 4. Pipeline e comercial

```sql
CREATE TABLE pipelines (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome           text NOT NULL,
  tipo           text NOT NULL CHECK (tipo IN ('vendas','operacional')),
  padrao         boolean NOT NULL DEFAULT false
);

CREATE TABLE pipeline_etapas (
  id          uuid PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  ordem       int  NOT NULL,
  cor         text,
  tipo        text NOT NULL DEFAULT 'aberta'
    CHECK (tipo IN ('aberta','ganho','perda')),
  UNIQUE (pipeline_id, ordem)
);
```

Etapas são **dados**, não `enum`. É o que permite "criar etapas personalizadas"
(7.2) sem migração. `tipo` marca semanticamente onde ganho e perda acontecem —
assim a taxa de conversão não depende do nome que alguém deu à coluna.

```sql
CREATE TABLE atividades (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  lead_id        uuid REFERENCES leads(id),
  cliente_id     uuid REFERENCES clientes(id),
  tipo           text NOT NULL,     -- ligacao, reuniao, follow_up, visita…
  titulo         text NOT NULL,
  responsavel_id uuid REFERENCES usuarios(id),
  agendada_para  timestamptz,
  concluida_em   timestamptz,
  lembrete_min   int,
  observacao     text,
  <rodapé padrão>
);
CREATE INDEX atividades_pendentes
  ON atividades (organizacao_id, responsavel_id, agendada_para)
  WHERE concluida_em IS NULL AND excluido_em IS NULL;

CREATE TABLE propostas (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  lead_id        uuid REFERENCES leads(id),
  cliente_id     uuid REFERENCES clientes(id),
  numero         serial,
  plano          text,
  servicos       jsonb NOT NULL DEFAULT '[]',
  valor          numeric(14,2),
  desconto       numeric(14,2) DEFAULT 0,
  validade       date,
  enviada_em     timestamptz,
  visualizada_em timestamptz,
  status         text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviada','visualizada','aguardando',
                      'negociacao','aprovada','recusada','vencida')),
  responsavel_id uuid REFERENCES usuarios(id),
  observacoes    text,
  <rodapé padrão>
);
```

---

## 5. Operacional

```sql
CREATE TABLE projetos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  cliente_id     uuid REFERENCES clientes(id),   -- NULL = projeto interno
  nome           text NOT NULL,
  pipeline_id    uuid REFERENCES pipelines(id),
  <rodapé padrão>
);

CREATE TABLE demandas (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  projeto_id     uuid REFERENCES projetos(id),
  cliente_id     uuid REFERENCES clientes(id),
  titulo         text NOT NULL,             -- obrigatório (15.4)
  descricao      text,
  tipo           text,                      -- design, copy, edicao_video…
  etapa_id       uuid NOT NULL REFERENCES pipeline_etapas(id),
  ordem          numeric NOT NULL,
  prioridade     text NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  responsavel_id uuid REFERENCES usuarios(id),
  aprovador_id   uuid REFERENCES usuarios(id),
  prazo          timestamptz,
  tempo_estimado_min int,
  tempo_gasto_min    int NOT NULL DEFAULT 0,  -- desnormalizado, mantido por trigger
  concluida_em   timestamptz,
  <rodapé padrão>
);

-- Índice do quadro operacional
CREATE INDEX demandas_coluna
  ON demandas (organizacao_id, etapa_id, ordem)
  WHERE excluido_em IS NULL;
-- Índice de "minhas demandas atrasadas" — o card mais clicado do painel
CREATE INDEX demandas_atrasadas
  ON demandas (organizacao_id, responsavel_id, prazo)
  WHERE concluida_em IS NULL AND excluido_em IS NULL;

CREATE TABLE subtarefas (
  id            uuid PRIMARY KEY,
  demanda_id    uuid NOT NULL REFERENCES demandas(id) ON DELETE CASCADE,
  titulo        text NOT NULL,
  responsavel_id uuid REFERENCES usuarios(id),
  prazo         timestamptz,
  concluida_em  timestamptz,
  ordem         numeric NOT NULL
);

CREATE TABLE apontamentos_tempo (
  id          uuid PRIMARY KEY,
  demanda_id  uuid NOT NULL REFERENCES demandas(id) ON DELETE CASCADE,
  usuario_id  uuid NOT NULL REFERENCES usuarios(id),
  iniciado_em timestamptz NOT NULL,
  encerrado_em timestamptz,
  minutos     int,                          -- preenchido ao encerrar
  observacao  text
);
-- Um cronômetro aberto por usuário. Impede o erro clássico de dois relógios.
CREATE UNIQUE INDEX apontamento_aberto ON apontamentos_tempo (usuario_id)
  WHERE encerrado_em IS NULL;

CREATE TABLE gravacoes (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  cliente_id     uuid REFERENCES clientes(id),
  demanda_id     uuid REFERENCES demandas(id),
  evento_id      uuid REFERENCES eventos_agenda(id),
  local          text,
  equipe         uuid[] NOT NULL DEFAULT '{}',
  equipamentos   text,
  roteiro_pronto boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'planejada'
    CHECK (status IN ('planejada','confirmada','aguardando_roteiro',
                      'pronta','realizada','cancelada','reagendada')),
  observacoes    text,
  <rodapé padrão>
);
```

---

## 6. Financeiro

Uma tabela para receita e despesa, empresarial e pessoal. Alternativa
considerada e recusada: quatro tabelas separadas — inviabilizaria a "visão
consolidada" (13.4) sem `UNION` em toda consulta, e quadruplicaria a superfície
de erro de permissão.

```sql
CREATE TABLE categorias_financeiras (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome           text NOT NULL,
  natureza       text NOT NULL CHECK (natureza IN ('receita','despesa')),
  escopo         text NOT NULL CHECK (escopo IN ('empresarial','pessoal')),
  pai_id         uuid REFERENCES categorias_financeiras(id)
);

CREATE TABLE lancamentos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),

  natureza       text NOT NULL CHECK (natureza IN ('receita','despesa')),
  escopo         text NOT NULL DEFAULT 'empresarial'
                   CHECK (escopo IN ('empresarial','pessoal')),
  -- Obrigatório quando escopo='pessoal'; é o que a RLS confere.
  proprietario_id uuid REFERENCES usuarios(id),

  descricao      text NOT NULL,
  categoria_id   uuid REFERENCES categorias_financeiras(id),
  cliente_id     uuid REFERENCES clientes(id),
  fornecedor     text,
  contrato_id    uuid REFERENCES contratos(id),

  valor          numeric(14,2) NOT NULL,
  valor_pago     numeric(14,2) NOT NULL DEFAULT 0,   -- recebimento parcial (13.6)
  vencimento     date NOT NULL,
  liquidado_em   date,
  forma_pagamento text,

  status         text NOT NULL DEFAULT 'previsto'
    CHECK (status IN ('previsto','pendente','liquidado','atrasado','cancelado')),

  recorrencia_id uuid REFERENCES recorrencias(id),
  parcela        int,
  parcelas_total int,
  comprovante_id uuid REFERENCES arquivos(id),
  observacoes    text,
  <rodapé padrão>,

  CONSTRAINT pessoal_tem_dono
    CHECK (escopo = 'empresarial' OR proprietario_id IS NOT NULL)
);

CREATE INDEX lancamentos_vencimento
  ON lancamentos (organizacao_id, escopo, status, vencimento)
  WHERE excluido_em IS NULL;
CREATE INDEX lancamentos_cliente
  ON lancamentos (organizacao_id, cliente_id, vencimento)
  WHERE excluido_em IS NULL;

CREATE TABLE recorrencias (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  modelo         jsonb NOT NULL,        -- campos do lançamento a gerar
  frequencia     text NOT NULL CHECK (frequencia IN ('mensal','trimestral','anual')),
  dia_vencimento int  NOT NULL,
  proxima_geracao date NOT NULL,
  fim            date,
  ativa          boolean NOT NULL DEFAULT true
);
```

**Recorrência gera linhas reais, não é calculada na leitura.** Um cron do worker
materializa os próximos 90 dias. Assim o fluxo de caixa futuro é uma consulta
indexada simples, e alterar uma parcela específica (o caso real: "esse mês o
cliente pediu desconto") não exige quebrar a série.

`CHECK (pessoal_tem_dono)` é a trava estrutural: lançamento pessoal sem dono não
entra no banco, então a RLS nunca encontra uma linha pessoal sem filtro possível.

```sql
CREATE TABLE contratos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  cliente_id     uuid NOT NULL REFERENCES clientes(id),
  plano          text,
  servicos       jsonb NOT NULL DEFAULT '[]',
  valor_mensal   numeric(14,2),
  inicio         date,
  dia_vencimento int,
  meses          int,
  renovacao_em   date,
  status         text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','pausado','encerrado','cancelado')),
  responsavel_id uuid REFERENCES usuarios(id),
  <rodapé padrão>
);
```

---

## 7. WhatsApp

```sql
CREATE TABLE wa_numeros (
  id              uuid PRIMARY KEY,
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  nome            text NOT NULL,           -- "Comercial", "Financeiro"
  telefone_e164   text NOT NULL,
  provedor        text NOT NULL CHECK (provedor IN ('cloud_api','ponte_qr')),
  credencial_id   uuid REFERENCES credenciais(id),   -- token cifrado no cofre
  status          text NOT NULL DEFAULT 'desconectado'
    CHECK (status IN ('conectado','desconectado','conectando','erro')),
  ultima_sincronizacao timestamptz,
  responsavel_id  uuid REFERENCES usuarios(id),
  UNIQUE (organizacao_id, telefone_e164)
);

CREATE TABLE wa_conversas (
  id              uuid PRIMARY KEY,
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  numero_id       uuid NOT NULL REFERENCES wa_numeros(id),
  contato_id      uuid NOT NULL REFERENCES contatos(id),   -- sempre o contato
  responsavel_id  uuid REFERENCES usuarios(id),
  nao_lidas       int  NOT NULL DEFAULT 0,
  ultima_mensagem_em   timestamptz,
  ultima_mensagem_texto text,
  aguardando_resposta  boolean NOT NULL DEFAULT false,  -- filtro 8.2
  janela_expira_em     timestamptz,        -- 24h da Cloud API
  arquivada_em    timestamptz,
  UNIQUE (numero_id, contato_id)
);

-- Ordena a caixa de entrada sem tocar em wa_mensagens.
CREATE INDEX wa_conversas_caixa
  ON wa_conversas (organizacao_id, ultima_mensagem_em DESC)
  WHERE arquivada_em IS NULL;

CREATE TABLE wa_mensagens (
  id             uuid,
  organizacao_id uuid NOT NULL,
  conversa_id    uuid NOT NULL,
  externo_id     text,                     -- id no WhatsApp; garante idempotência
  direcao        text NOT NULL CHECK (direcao IN ('entrada','saida')),
  tipo           text NOT NULL,            -- texto, audio, imagem, video, documento
  texto          text,
  midia_id       uuid REFERENCES arquivos(id),
  responde_a     uuid,
  autor_id       uuid REFERENCES usuarios(id),   -- quem enviou, se saída
  status         text,                     -- enviada, entregue, lida, erro
  -- Reservado para a IA da fase 4. Nulável hoje; nenhuma migração depois.
  intencao       text,
  temperatura    text,
  resumo         text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, criado_em)
) PARTITION BY RANGE (criado_em);

CREATE UNIQUE INDEX wa_mensagens_externo
  ON wa_mensagens (organizacao_id, externo_id, criado_em)
  WHERE externo_id IS NOT NULL;
CREATE INDEX wa_mensagens_conversa
  ON wa_mensagens (conversa_id, criado_em DESC);
```

**Particionamento por mês, declarado agora e barato.** É a única tabela com
crescimento sem teto — 4 números ativos geram facilmente 500 mil mensagens/ano.
Particionar depois exige migrar a tabela inteira com o sistema parado.
Declarar hoje custa uma linha; o worker cria a partição do mês seguinte.

`externo_id` único torna o webhook idempotente: a Meta reenvia webhooks e sem
isso a conversa duplica mensagens.

```sql
CREATE TABLE wa_campanhas (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome           text NOT NULL,
  numero_id      uuid NOT NULL REFERENCES wa_numeros(id),
  modelo         text NOT NULL,            -- template aprovado; obrigatório
  filtro         jsonb NOT NULL,           -- critérios de seleção (8.6)
  status         text NOT NULL DEFAULT 'rascunho',
  envios_por_hora int NOT NULL DEFAULT 60, -- proteção contra banimento
  agendada_para  timestamptz,
  <rodapé padrão>
);

CREATE TABLE contato_consentimento (
  contato_id  uuid PRIMARY KEY REFERENCES contatos(id) ON DELETE CASCADE,
  aceito_em   timestamptz,
  recusado_em timestamptz,
  origem      text
);
```

`modelo` é `NOT NULL` de propósito: o esquema não permite campanha sem template
aprovado. A regra de "não queimar o número" está no banco, não num aviso de
tela.

---

## 8. Tabelas transversais

Cinco tabelas polimórficas evitam quarenta colunas de chave estrangeira
espalhadas.

```sql
CREATE TABLE arquivos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  cliente_id     uuid REFERENCES clientes(id),
  pasta_id       uuid REFERENCES pastas(id),
  nome           text NOT NULL,
  chave_r2       text NOT NULL,            -- caminho no bucket
  mime           text NOT NULL,
  tamanho        bigint NOT NULL,
  versao         int NOT NULL DEFAULT 1,
  versao_de      uuid REFERENCES arquivos(id),   -- histórico de versões
  <rodapé padrão>
);

CREATE TABLE vinculos (
  id            uuid PRIMARY KEY,
  tipo_origem   text NOT NULL,   -- 'arquivo' | 'etiqueta'
  origem_id     uuid NOT NULL,
  tipo_entidade text NOT NULL,   -- 'lead' | 'demanda' | 'cliente' | 'proposta'
  entidade_id   uuid NOT NULL,
  UNIQUE (tipo_origem, origem_id, tipo_entidade, entidade_id)
);
CREATE INDEX vinculos_entidade ON vinculos (tipo_entidade, entidade_id);

CREATE TABLE comentarios (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  tipo_entidade  text NOT NULL,
  entidade_id    uuid NOT NULL,
  autor_id       uuid NOT NULL REFERENCES usuarios(id),
  texto          text NOT NULL,
  mencoes        uuid[] NOT NULL DEFAULT '{}',
  responde_a     uuid REFERENCES comentarios(id),
  resolvido_em   timestamptz,
  <rodapé padrão>
);
CREATE INDEX comentarios_entidade
  ON comentarios (tipo_entidade, entidade_id, criado_em);

-- Linha do tempo visível ao usuário (requisito 7.5, 10.4)
CREATE TABLE eventos (
  id             uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  tipo_entidade  text NOT NULL,
  entidade_id    uuid NOT NULL,
  tipo           text NOT NULL,     -- lead.etapa_alterada, demanda.concluida…
  ator_id        uuid REFERENCES usuarios(id),
  dados          jsonb NOT NULL DEFAULT '{}',  -- {de:"Proposta", para:"Fechado"}
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eventos_entidade
  ON eventos (tipo_entidade, entidade_id, criado_em DESC);

-- Auditoria de conformidade. Tabela DIFERENTE de eventos, de propósito.
CREATE TABLE auditoria (
  id             bigserial PRIMARY KEY,
  organizacao_id uuid NOT NULL,
  usuario_id     uuid,
  acao           text NOT NULL,     -- credencial.revelada, permissao.alterada
  tipo_entidade  text,
  entidade_id    uuid,
  antes          jsonb,
  depois         jsonb,
  ip             inet,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON auditoria FROM app_usuario;
```

**Eventos e auditoria são coisas separadas.** `eventos` é produto: alimenta a
linha do tempo, é apagável junto com a entidade, e é lido o tempo todo.
`auditoria` é conformidade: append-only, imutável até para a aplicação, e lida
raramente. Juntar as duas obriga a escolher entre "quero limpar isso" e "isso
não pode ser alterado" — e a resposta é diferente para cada uma.

**Sobre polimorfismo.** `vinculos`, `comentarios` e `eventos` não têm chave
estrangeira real, então o Postgres não impede um `entidade_id` órfão. A
alternativa — uma tabela de junção por tipo de entidade — daria integridade
referencial ao custo de ~15 tabelas quase idênticas e de reescrever a busca de
comentários a cada módulo novo. Aceito o polimorfismo e mitigo com: `CHECK` na
lista de `tipo_entidade` válidos, e um job semanal que apaga órfãos e reporta.

```sql
CREATE TABLE credenciais (
  id              uuid PRIMARY KEY,
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  cliente_id      uuid REFERENCES clientes(id),
  plataforma      text NOT NULL,
  login           text,
  link            text,
  segredo_cifrado bytea NOT NULL,      -- AES-256-GCM
  nonce           bytea NOT NULL,
  dek_cifrada     bytea NOT NULL,
  versao_kek      int   NOT NULL,
  observacoes     text,
  responsavel_id  uuid REFERENCES usuarios(id),
  <rodapé padrão>
);

CREATE TABLE notificacoes (
  id            uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL,
  usuario_id    uuid NOT NULL REFERENCES usuarios(id),
  tipo          text NOT NULL,
  titulo        text NOT NULL,
  corpo         text,
  tipo_entidade text,
  entidade_id   uuid,
  lida_em       timestamptz,
  arquivada_em  timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notificacoes_pendentes ON notificacoes (usuario_id, criado_em DESC)
  WHERE lida_em IS NULL AND arquivada_em IS NULL;

-- Garantia de entrega de efeitos colaterais
CREATE TABLE outbox (
  id            bigserial PRIMARY KEY,
  organizacao_id uuid NOT NULL,
  tipo          text NOT NULL,
  carga         jsonb NOT NULL,
  tentativas    int NOT NULL DEFAULT 0,
  processado_em timestamptz,
  erro          text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pendente ON outbox (criado_em)
  WHERE processado_em IS NULL;

-- Índice único da busca global
CREATE TABLE busca_indice (
  organizacao_id uuid NOT NULL,
  tipo           text NOT NULL,
  entidade_id    uuid NOT NULL,
  titulo         text NOT NULL,
  subtitulo      text,
  corpo          text,
  cliente_id     uuid,                -- para filtrar por escopo do membro
  tsv            tsvector NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, entidade_id)
);
CREATE INDEX busca_tsv   ON busca_indice USING gin (tsv);
CREATE INDEX busca_trgm  ON busca_indice USING gin (titulo gin_trgm_ops);
```

O índice `gin_trgm_ops` é o que atende "tolerante a pequenas diferenças de
escrita": `SIMILARITY(titulo, 'oticas gouvea') > 0.3` encontra "Óticas Gouveia".

### Demais tabelas

Mesmo padrão, sem DDL completo aqui:

`pastas`, `estrategias` (1:1 com cliente, campos do item 11 + `historico jsonb`),
`contas_anuncio`, `campanhas`, `metricas_diarias` (série do sync de Ads),
`eventos_agenda`, `aprovacoes`, `aprovacao_versoes`, `wiki_paginas`,
`wiki_categorias`, `pesquisas`, `avisos`, `modelos_onboarding`,
`preferencias_notificacao`, `etiquetas`, `convites`.

---

## 9. Row Level Security

Duas políticas, aplicadas a todas as tabelas com `organizacao_id`.

```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY isolamento_org ON leads
  USING (organizacao_id = current_setting('app.organizacao_id')::uuid);
```

A camada de dados abre toda transação com:

```sql
SET LOCAL app.organizacao_id = '...';
SET LOCAL app.usuario_id     = '...';
```

`SET LOCAL` (e não `SET`) é essencial: o valor morre com a transação e não
vaza para a próxima requisição que reusar a conexão do pool. Um `SET` comum aqui
seria uma falha de isolamento entre organizações.

A política do financeiro pessoal está em
[`00-arquitetura.md`](00-arquitetura.md#financeiro--o-requisito-mais-afiado-do-briefing).

**Teste obrigatório:** toda política tem um caso automatizado que prova que ela
*nega*. Política de RLS que ninguém testou negando costuma estar permitindo.

---

## 10. Permissões

### Formato

`modulo.recurso.acao` — hierárquico, com curinga:

```
vendas.lead.ver          vendas.lead.editar        vendas.lead.excluir
vendas.proposta.*        operacional.demanda.*     clientes.cliente.editar
financeiro.lancamento.ver              financeiro.lancamento.editar
financeiro.pessoal.*     ← não concedível pela tela
credenciais.ver          credenciais.revelar       credenciais.editar
config.usuarios.*        config.auditoria.ver      relatorios.exportar
```

Separar `credenciais.ver` de `credenciais.revelar` é deliberado: a equipe precisa
saber que existe acesso ao Google Ads do cliente sem que todos possam ler a
senha.

### Papéis padrão

| Papel | Alcance |
|---|---|
| `proprietario` | Tudo, incluindo financeiro pessoal. Um por organização, definido por `organizacoes.proprietario_id` |
| `administrador` | Tudo menos financeiro pessoal |
| `gestor` | Operacional completo, clientes, vendas; financeiro só leitura |
| `comercial` | Vendas, WhatsApp, contatos, agenda |
| `trafego` | Clientes atribuídos, tráfego, estratégia, demandas |
| `social_media` / `designer` / `editor` / `filmmaker` | Demandas próprias, arquivos, aprovações dos clientes atribuídos |
| `financeiro` | Financeiro empresarial; sem acesso ao pessoal |
| `colaborador` | Só as próprias demandas |

### Verificação

```ts
// packages/core/contexto.ts
export type Contexto = {
  organizacaoId: string
  usuarioId: string
  permissoes: Set<string>       // carregado na sessão
  clientesPermitidos: string[] | null   // null = todos
  ehProprietario: boolean
}

export function pode(ctx: Contexto, permissao: string, alvo?: { clienteId?: string }): boolean
export function exigir(ctx: Contexto, permissao: string, alvo?): void  // lança 404/403
```

`pode()` resolve na ordem: curinga → permissão exata → escopo de cliente →
trava de proprietário para `financeiro.pessoal.*`. A mesma função é importada
pelo servidor (autoritativa) e pelo cliente (só para esconder UI).

### Onde a checagem acontece

```
Componente        pode()  → esconde o botão              (conveniência)
Server Action     exigir() → 403                          (barreira)
core/*            exigir() → 403                          (barreira real)
Postgres          RLS      → 0 linhas                     (rede de segurança)
```

Segunda e terceira linhas parecem redundantes. Não são: `exigir()` no core é o
que protege quando alguém chama a função de dentro do worker, de um script ou
de uma API futura — caminhos que nunca passam por Server Action.

---

## 11. Ordem das migrações

Cada bloco é uma migração Drizzle reversível.

| # | Conteúdo |
|---|---|
| 1 | Extensões (`citext`, `pg_trgm`, `unaccent`, `uuid-ossp`), `organizacoes`, `usuarios`, `papeis`, `papel_permissoes`, `membros`, `sessoes` |
| 2 | RLS + funções auxiliares + papel de banco `app_usuario` |
| 3 | `contatos`, `clientes`, `etiquetas`, `vinculos` |
| 4 | `pipelines`, `pipeline_etapas`, `leads`, `atividades`, `propostas` |
| 5 | `eventos`, `auditoria`, `outbox`, `notificacoes` |
| 6 | `projetos`, `demandas`, `subtarefas`, `comentarios`, `apontamentos_tempo` |
| 7 | `eventos_agenda`, `gravacoes` |
| 8 | `contratos`, `categorias_financeiras`, `recorrencias`, `lancamentos` + RLS do pessoal |
| 9 | `pastas`, `arquivos` |
| 10 | `credenciais` |
| 11 | `busca_indice` + gatilhos |
| 12 | `wa_numeros`, `wa_conversas`, `wa_mensagens` particionada, `wa_campanhas`, `contato_consentimento` |
| 13 | `estrategias`, `contas_anuncio`, `campanhas`, `metricas_diarias` |
| 14 | `aprovacoes`, `wiki_paginas`, `pesquisas`, `avisos` |

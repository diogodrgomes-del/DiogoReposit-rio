# 04 — Banco de dados

PostgreSQL 16. Cerca de 60 tabelas em 4 schemas. Prisma para migrations e para
95% das queries; SQL cru onde o SQL precisa ser bom (painéis, busca, fluxo de
caixa).

## Schemas

| Schema | Contém | Por quê separado |
|---|---|---|
| `public` | tudo que não é financeiro | — |
| `financeiro` | lançamentos, pagamentos, categorias, recorrências | fronteira física; permissão de banco separada; um `SELECT *` acidental não alcança |
| `auditoria` | `audit_logs`, `credential_access_log` | append-only, com `UPDATE`/`DELETE` revogados no papel da aplicação |
| `busca` | `search_index` | reconstruível; fica fora do dump lógico |

Extensões: `uuid-ossp` (ou `pg_uuidv7`), `unaccent`, `pg_trgm`, `btree_gin`.

---

## Convenções gerais

Toda tabela de domínio tem:

```sql
id              uuid PRIMARY KEY DEFAULT uuidv7()
organization_id uuid NOT NULL REFERENCES organizations(id)
criado_em       timestamptz NOT NULL DEFAULT now()
atualizado_em   timestamptz NOT NULL DEFAULT now()
criado_por      uuid REFERENCES users(id)
deleted_em      timestamptz            -- exclusão lógica
```

### Dinheiro

Sempre `BIGINT`, sempre em centavos, sempre com sufixo `_cents`:

```sql
valor_cents  bigint NOT NULL
```

Nunca `float`, nunca `real`, nunca `double precision`. `0.1 + 0.2 ≠ 0.3` em
ponto flutuante binário, e o lugar onde isso aparece é o fechamento do mês, com
uma diferença de centavos que ninguém consegue explicar. `NUMERIC` também
serviria, mas `BIGINT` é mais rápido, ocupa menos e força a conversão a ser
explícita em um lugar só (`packages/core/dinheiro.ts`).

### Exclusão lógica

`deleted_em IS NULL` é filtrado por uma extensão do Prisma, e todo índice de
listagem é parcial:

```sql
CREATE INDEX idx_demandas_org_stage ON demands (organization_id, stage_id, posicao)
  WHERE deleted_em IS NULL;
```

Índice parcial importa: sem ele, o índice cresce com o lixo que ninguém consulta.

### Ordenação de kanban

Card em quadro usa `posicao double precision`, não `ordem int`. Arrastar um card
entre dois outros grava `posicao = (anterior + seguinte) / 2` — **uma linha
atualizada**, não a coluna inteira. Um job de manutenção renumera a coluna
quando o menor intervalo fica abaixo de `1e-6` (na prática, quase nunca).

---

## Multi-tenant

`organization_id` em toda tabela de domínio, **desde a primeira migration**.

Não porque haverá outra empresa amanhã, mas porque essa é a migração mais cara
que existe: acrescentar tenancy depois significa alterar 60 tabelas com dados,
reescrever todas as queries e conviver com a chance de uma consulta esquecida
vazar dado de uma empresa para outra. Agora custa uma coluna e um índice.

**Três camadas, em ordem de importância:**

**1. Extensão do Prisma (mecanismo principal).** `forTenant(ctx)` devolve um
cliente em que todo `where` recebe `organization_id` e todo `create` recebe o
valor. O cliente cru não é exportado do pacote `@mark/db` — a única forma de
alcançá-lo é importar `@mark/db/unsafe`, o que aparece em code review e em
`grep`.

**2. Row Level Security (rede de proteção).** RLS ligado em todas as tabelas,
com política para o papel da aplicação:

```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (organization_id = current_setting('app.org_id', true)::uuid);
```

`SET LOCAL app.org_id` é emitido no início de cada transação. Como o Neon usa
pool de conexões, **`SET LOCAL` dentro de transação é obrigatório** — `SET`
simples vazaria o valor para a próxima requisição que reaproveitasse a conexão.
Isso é o tipo de detalhe que causa incidente de vazamento entre tenants; está
escrito aqui para não ser descoberto em produção.

**3. Índice composto sempre começando por `organization_id`.** Isso faz o
isolamento ser também a otimização, não um custo.

**Modelagem:**

```
organizations ──< memberships >── users
      │                │
      │                └──< client_assignments >── clients
      │
      └──< (todas as demais tabelas)
```

`users` é global (uma pessoa pode pertencer a duas organizações no futuro);
`memberships` carrega o papel e é onde a permissão vive.

---

## Entidades

### Identidade e organização

```
organizations      id, nome, slug, plano, fuso, moeda, config jsonb, ativo
users              id, email ᵁ, nome, avatar_file_id, senha_hash, senha_algo,
                   mfa_secret_cipher, mfa_ativo, email_verificado_em,
                   ultimo_login_em, ativo
memberships        id, organization_id, user_id, papel, cargo, ativo
                   UNIQUE (organization_id, user_id)
permission_grants  id, membership_id, permissao, efeito ALLOW|DENY
                   -- sobrescreve o papel, caso a caso
client_assignments id, membership_id, client_id     -- escopo por cliente
sessions           id, user_id, token_hash ᵁ, ip, user_agent, criada_em,
                   expira_em, ultima_atividade_em, revogada_em, step_up_em
invites            id, organization_id, email, papel, token_hash, expira_em, aceito_em
```

Sessão em banco, não JWT sem estado: sem isso não há como derrubar a sessão de
alguém que saiu da equipe, e é exatamente o cenário que uma agência enfrenta.
`step_up_em` guarda a última re-autenticação — é o que permite exigir senha de
novo para ver credencial de cliente.

### Contatos, leads, pipeline

```
contacts       id, org, nome, telefone_e164 ᵁ(org), email, foto_url, instagram,
               empresa, cidade, uf, origem_id, opt_out_em
               -- entidade única de pessoa. Lead, cliente e conversa de
               -- WhatsApp apontam todos para cá. É o que faz o WhatsApp
               -- reconhecer o número sem duplicar cadastro.

pipelines      id, org, nome, tipo VENDAS|OPERACIONAL, padrao
pipeline_stages id, pipeline_id, nome, ordem, cor,
               tipo ABERTO|GANHO|PERDIDO, wip_limit

leads          id, org, contact_id, pipeline_id, stage_id, responsavel_id,
               titulo, valor_estimado_cents, origem_id, temperatura,
               servico_interesse, proxima_acao, proxima_acao_em,
               entrou_no_estagio_em, ganho_em, perdido_em, motivo_perda_id,
               client_id (nulo até converter), posicao, deleted_em

lead_origens   id, org, nome, ativo         -- configurável, não enum
motivos_perda  id, org, nome, ordem, ativo  -- idem

activities     id, org, tipo LIGACAO|REUNIAO|FOLLOWUP|MENSAGEM|VISITA|
               APRESENTACAO|PROPOSTA|TAREFA, titulo, descricao,
               lead_id?, client_id?, demand_id?, contact_id?,
               responsavel_id, inicia_em, duracao_min, concluida_em,
               status, lembrete_min

proposals      id, org, numero (sequencial por org), lead_id, client_id?,
               plano_id?, valor_cents, desconto_cents, validade_em,
               status RASCUNHO|ENVIADA|VISUALIZADA|AGUARDANDO|NEGOCIACAO|
                      APROVADA|RECUSADA|VENCIDA,
               enviada_em, visualizada_em, decidida_em, file_id, responsavel_id
proposal_items id, proposal_id, servico_id?, descricao, qtd,
               valor_unit_cents, ordem
```

`lead_origens` e `motivos_perda` são tabelas, não enums: o comercial vai querer
adicionar "indicação do Micael" sem pedir deploy.

`entrou_no_estagio_em` existe para calcular tempo médio por etapa — indicador
que o briefing pede (§7.1) e que é impossível reconstruir depois se não for
gravado no momento da mudança.

### Clientes e contratos

```
clients          id, org, razao_social, nome_fantasia, cnpj, segmento,
                 telefone, whatsapp, email, cidade, uf, endereco,
                 instagram, facebook, tiktok, site, gmn_url,
                 responsavel_id, status ATIVO|ONBOARDING|PAUSADO|
                   INADIMPLENTE|EM_RISCO|CANCELADO|ENCERRADO,
                 saude VERDE|AMARELO|VERMELHO, entrou_em, encerrado_em,
                 observacoes, deleted_em
                 -- só razao_social é NOT NULL, conforme §10.1

client_contacts  id, client_id, contact_id,
                 papel PRINCIPAL|FINANCEIRO|MARKETING|OUTRO, principal bool

plans            id, org, nome, valor_base_cents, descricao, ativo
services         id, org, nome, categoria, ativo
plan_services    plan_id, service_id

contracts        id, org, client_id, plano_id?, valor_mensal_cents,
                 inicio_em, dia_vencimento, prazo_meses, renova_em,
                 status ATIVO|PAUSADO|ENCERRADO, reajuste_indice,
                 reajuste_proximo_em, file_id, responsavel_id
contract_services contract_id, service_id, valor_cents?
```

`saude` é coluna, não cálculo em tempo real: é recalculada por job (atraso
financeiro + demanda parada + ausência de reunião) e assim pode ser filtrada e
indexada. Calcular na tela custaria três subqueries por linha da lista.

### Estratégia e pesquisa

```
client_strategies  id, org, client_id ᵁ,
                   objetivo_principal, posicionamento, publico_alvo,
                   persona, tom_de_voz, regioes text[],
                   diferenciais text[], concorrentes text[],
                   palavras_permitidas text[], palavras_proibidas text[],
                   pilares_conteudo text[], objecoes text[],
                   dores text[], desejos text[],
                   campos_extras jsonb,        -- cauda longa, sem migration
                   atualizado_por, atualizado_em
strategy_versions  id, strategy_id, snapshot jsonb, autor_id, criado_em
research_items     id, org, client_id, tipo CONCORRENTE|REFERENCIA|ANUNCIO|
                   PERFIL|TENDENCIA|INSIGHT, titulo, url, notas,
                   file_id?, criado_por
```

Os campos que se filtra e se busca são colunas de verdade; o resto vai em
`campos_extras jsonb`. Estratégia é o tipo de tabela onde surgem seis campos
novos por trimestre, e nem todo campo novo merece uma migration.

`strategy_versions` guarda snapshot inteiro a cada salvamento com mais de 5
minutos do anterior — barato, e responde "o que a gente tinha combinado em
março".

### Operacional

```
projects       id, org, client_id?, nome, descricao, status, responsavel_id
               -- client_id nulo = projeto interno da agência

demands        id, org, titulo, descricao, client_id?, project_id?,
               pipeline_id, stage_id, tipo_id, prioridade BAIXA|NORMAL|ALTA|URGENTE,
               responsavel_id, aprovador_id, solicitante_id,
               prazo_em, iniciada_em, concluida_em,
               tempo_estimado_min, posicao, arquivada_em, deleted_em
               -- NOT NULL só em titulo e (client_id OR project_id), conforme §15.4

demand_types   id, org, nome, cor, icone, checklist_padrao jsonb, ativo
subtasks       id, demand_id, titulo, responsavel_id, prazo_em,
               concluida_em, concluida_por, ordem, depende_de_id?
comments       id, org, entidade_tipo, entidade_id, autor_id,
               corpo_json, parent_id?, resolvido_em, editado_em, deleted_em
mentions       id, comment_id, user_id, lida_em
time_entries   id, org, demand_id, user_id, inicio_em, fim_em,
               minutos, manual bool, observacao
tags           id, org, nome, cor, escopo
taggings       tag_id, entidade_tipo, entidade_id
```

**Checklist e subtarefa são a mesma tabela.** O briefing pede as duas (§15.7),
mas a diferença entre "item de checklist" e "subtarefa" é só se tem responsável
e prazo — que são colunas opcionais. Duas tabelas quase idênticas produzem duas
telas, duas APIs e a pergunta eterna de qual usar. Uma tabela, e a UI mostra o
item como checkbox simples enquanto responsável e prazo estiverem vazios.

`comments`, `taggings` e `file_links` são polimórficos (`entidade_tipo` +
`entidade_id`). É a escolha certa quando o mesmo recurso se aplica a 8 entidades:
a alternativa (`lead_comments`, `demand_comments`, `client_comments`…) multiplica
código por oito. O custo é não ter chave estrangeira; compensa-se com
`CHECK (entidade_tipo IN (...))`, índice `(entidade_tipo, entidade_id)` e um job
semanal que reporta órfãos.

### Agenda e gravações

```
events              id, org, tipo REUNIAO|GRAVACAO|VISITA|ENTREGA|PRODUCAO|
                    CAMPANHA|PRAZO|EVENTO|VIAGEM|INTERNO|FOLLOWUP,
                    titulo, descricao, client_id?, demand_id?,
                    inicio_em, fim_em, dia_inteiro,
                    local, link_reuniao, rrule, evento_pai_id?, cancelado_em,
                    google_event_id, google_calendar_id
event_participants  event_id, user_id, status CONVIDADO|CONFIRMADO|RECUSADO
event_reminders     event_id, minutos_antes, canal
recording_details   event_id ᵁ, equipe text[], equipamentos text[],
                    roteiro_file_id?, duracao_prevista_min,
                    status PLANEJADA|CONFIRMADA|AGUARDANDO_ROTEIRO|
                           PRONTA|REALIZADA|CANCELADA|REAGENDADA,
                    materiais_pendentes text[]
```

Gravação **é** um evento, com detalhes em tabela 1:1. Modelar gravação como
entidade separada duplicaria agenda, participantes, lembretes e conflito de
horário. A tela `/agenda/gravacoes` é um filtro, não outro módulo.

Recorrência guardada como `rrule` (RFC 5545) e expandida na leitura, com
materialização só das ocorrências alteradas (`evento_pai_id`). Gravar 200 linhas
para "toda segunda-feira" é o erro clássico aqui.

### Tráfego

```
ad_accounts      id, org, client_id, plataforma META|GOOGLE|TIKTOK,
                 external_id, nome, moeda, credential_id,
                 business_manager_id, pixel_id, ativo, ultimo_sync_em
ad_metrics_daily id, org, ad_account_id, data, nivel CONTA|CAMPANHA|CONJUNTO|ANUNCIO,
                 external_id, nome, objetivo, status,
                 gasto_cents, impressoes, alcance, cliques, cliques_link,
                 conversas, resposta1, prof2, prof3, prof5,
                 metricas_extras jsonb, sincronizado_em
                 UNIQUE (ad_account_id, data, nivel, external_id)
                 -- particionada por mês
ad_budgets       id, ad_account_id, data, saldo_cents, aporte_cents
traffic_notes    id, org, client_id, ad_account_id?, data,
                 tipo DECISAO|OBSERVACAO|TESTE, corpo, autor_id
                 -- herda o `registro` do painel atual
```

`ad_metrics_daily` é a mudança de fundo em relação ao painel de hoje, que
consulta a Meta a cada renderização e não guarda nada. Gravar diariamente traz
três coisas que hoje são impossíveis: **comparação histórica** (a Meta limita
janela e muda atribuição retroativamente), **painel que carrega em 50 ms** em vez
de esperar a Graph API, e **funcionamento com a Meta fora do ar**.

O `UNIQUE` permite `ON CONFLICT DO UPDATE`: reprocessar os últimos 7 dias todo
dia corrige atribuição retroativa sem duplicar linha.

### WhatsApp

```
wa_numbers        id, org, rotulo, telefone_e164, provider CLOUD_API|QR,
                  status DESCONECTADO|CONECTANDO|CONECTADO|BANIDO,
                  credential_id, responsavel_id, ultima_sync_em, ativo
wa_conversations  id, org, wa_number_id, contact_id?, wa_chat_id,
                  responsavel_id, status ABERTA|PENDENTE|RESOLVIDA,
                  nao_lidas, ultima_mensagem_em, ultima_mensagem_previa,
                  janela_expira_em          -- 24h de atendimento
                  UNIQUE (wa_number_id, wa_chat_id)
wa_messages       id, org, conversation_id, external_id ᵁ,
                  direcao ENTRADA|SAIDA, tipo TEXTO|IMAGEM|AUDIO|VIDEO|DOC|
                  LOCALIZACAO|MODELO, corpo, file_id?,
                  autor_user_id?, responde_a_id?,
                  status ENFILEIRADA|ENVIADA|ENTREGUE|LIDA|FALHOU,
                  erro, enviada_em, entregue_em, lida_em
                  -- particionada por mês
wa_templates      id, org, nome, categoria, idioma, corpo,
                  status_meta APROVADO|PENDENTE|REJEITADO, external_id
wa_campaigns      id, org, nome, template_id, filtro jsonb,
                  status, agendada_para, iniciada_em, concluida_em,
                  total, enviados, falhas
wa_campaign_targets campaign_id, contact_id, status, mensagem_id?, erro
wa_optouts        id, org, telefone_e164 ᵁ(org), motivo, em
```

`external_id` único é o que garante **idempotência**: webhook do WhatsApp
reentrega o mesmo evento com frequência, e sem isso a conversa enche de
mensagem duplicada.

`janela_expira_em` implementa a regra de 24 horas da Cloud API: passado esse
prazo, só mensagem de modelo aprovado. A UI precisa dessa informação para
desabilitar o campo de texto com uma explicação, em vez de deixar o envio falhar.

`wa_messages` e `ad_metrics_daily` são as duas tabelas que crescem sem parar.
Particionamento mensal declarativo desde o começo, com job que cria a partição do
mês seguinte. Criar partição depois de a tabela ter 50 milhões de linhas é
downtime.

### Arquivos e credenciais

```
folders     id, org, client_id?, nome, parent_id?, caminho, sistema bool
files       id, org, client_id?, folder_id?, nome, storage_key ᵁ,
            mime, tamanho_bytes, sha256, largura, altura, duracao_s,
            versao, arquivo_pai_id?, uploader_id, deleted_em
file_links  file_id, entidade_tipo, entidade_id

credentials             id, org, client_id?, plataforma, login,
                        segredo_cipher bytea, segredo_iv bytea, segredo_tag bytea,
                        dek_id, url, notas_cipher bytea,
                        responsavel_id, atualizado_em, atualizado_por
credential_access_log   id, credential_id, user_id,
                        acao VER|COPIAR|CRIAR|EDITAR|EXCLUIR,
                        ip, user_agent, em          -- schema auditoria
data_encryption_keys    id, org, chave_cipher bytea, ativa, criada_em, rotacionada_em
```

Nenhuma senha em texto puro, em nenhuma coluna, em nenhum log, em nenhum backup.
`sha256` em `files` habilita deduplicação e detecta upload corrompido.
Detalhes de criptografia em [06](06-seguranca.md#cofre-de-credenciais).

### Aprovações, wiki, comunicação

```
approvals        id, org, tipo ARTE|VIDEO|ROTEIRO|CAMPANHA|LP|RELATORIO|
                 PLANEJAMENTO|DOCUMENTO, titulo, client_id, demand_id?,
                 versao, status AGUARDANDO|APROVADO|APROVADO_COM_OBS|
                 ALTERACAO|REPROVADO,
                 solicitado_por, aprovador_id, aprovador_externo_email?,
                 token_publico ᵁ,        -- portal do cliente, futuro
                 decidido_em, comentario
approval_assets  approval_id, file_id, ordem
wiki_pages       id, org, titulo, slug ᵁ(org), corpo_json, categoria_id?,
                 parent_id?, autor_id, visibilidade, favorito_de uuid[],
                 atualizado_em, deleted_em
wiki_versions    id, page_id, corpo_json, autor_id, criado_em
posts            id, org, titulo, corpo_json, autor_id, escopo GERAL|CLIENTE|PROJETO,
                 client_id?, project_id?, fixado, deleted_em
```

`token_publico` já existe em `approvals` desde o começo: é a única coisa que o
portal externo do cliente (§20, futuro) exigiria no schema. Uma coluna agora
evita uma migration depois.

### Financeiro — schema `financeiro`

```
fin_accounts     id, org, nome, tipo BANCO|CAIXA|CARTAO,
                 escopo EMPRESA|PESSOAL, owner_user_id?, saldo_inicial_cents
fin_categories   id, org, nome, tipo RECEITA|DESPESA,
                 escopo EMPRESA|PESSOAL|AMBOS, parent_id?, ativo
fin_entries      id, org,
                 escopo EMPRESA|PESSOAL,
                 owner_user_id,           -- NOT NULL quando escopo = PESSOAL
                 tipo RECEITA|DESPESA, descricao,
                 client_id?, fornecedor, category_id, account_id?,
                 valor_cents, valor_pago_cents,
                 vencimento_em, competencia_em, quitado_em,
                 status PREVISTO|PENDENTE|PAGO|RECEBIDO|ATRASADO|CANCELADO,
                 forma_pagamento, recurrence_id?, contract_id?,
                 comprovante_file_id?, observacoes, deleted_em
fin_payments     id, entry_id, valor_cents, data_em, forma, file_id?
                 -- recebimento e pagamento parcial: várias linhas por lançamento
fin_recurrences  id, org, escopo, modelo jsonb, regra, proxima_em, ativa, fim_em

CONSTRAINT pessoal_tem_dono
  CHECK (escopo <> 'PESSOAL' OR owner_user_id IS NOT NULL)
```

Três decisões:

**Uma tabela para receita e despesa**, com `tipo`. São a mesma entidade com sinal
trocado: mesmos campos, mesmo ciclo de status, mesmas telas de listagem e mesmo
fluxo de caixa. Duas tabelas dobrariam as queries do fluxo de caixa sem ganho.

**Pagamento parcial em tabela própria.** O briefing pede recebimento parcial
(§13.6). Guardar só `valor_pago_cents` no lançamento perderia a data e a forma de
cada parcela — que é o que o cliente pergunta quando reclama de cobrança.

**`escopo` + `owner_user_id` com `CHECK`.** O financeiro pessoal não é outra
tabela nem outro banco: é a mesma estrutura com escopo. A separação é garantida
por permissão e por predicado de query, e o `CHECK` impede que exista lançamento
pessoal órfão. Ver [05](05-permissoes.md#financeiro-pessoal).

### Sistema

```
notifications             id, org, user_id, tipo, titulo, corpo,
                          entidade_tipo, entidade_id, url,
                          permissao_exigida,        -- filtro na entrega
                          lida_em, arquivada_em, criado_em
notification_preferences  user_id, tipo, in_app, email, push, antecedencia_min
audit_logs                id, org, user_id, acao, entidade_tipo, entidade_id,
                          antes jsonb, depois jsonb, ip, user_agent, em
                          -- schema auditoria, append-only
outbox                    id, org, tipo, payload jsonb, tentativas,
                          processado_em, erro, criado_em
search_index              org, entidade_tipo, entidade_id, titulo, corpo,
                          tsv tsvector, client_id?, permissao,
                          atualizado_em         -- schema busca
```

`permissao_exigida` em `notifications` é o que cumpre "notificação financeira não
chega para quem não pode ver" (§14): a checagem acontece na entrega, não só na
renderização, então nem o payload do WebSocket carrega o dado.

`outbox` é o coração da confiabilidade: escrito na **mesma transação** da
mudança que o originou. Ou a demanda foi criada e a notificação será enviada, ou
nenhuma das duas coisas aconteceu. Nunca "criou e perdeu a notificação".

---

## Índices críticos

Os que decidem o desempenho das telas mais usadas. Todos parciais em
`deleted_em IS NULL`.

```sql
-- Kanban de vendas e de demandas: a query mais frequente do sistema
CREATE INDEX ON leads   (organization_id, stage_id, posicao)   WHERE deleted_em IS NULL;
CREATE INDEX ON demands (organization_id, stage_id, posicao)   WHERE deleted_em IS NULL;

-- "Minhas demandas" e "atrasadas" — o painel de cada colaborador
CREATE INDEX ON demands (organization_id, responsavel_id, prazo_em)
  WHERE deleted_em IS NULL AND concluida_em IS NULL;

-- Leads sem retorno
CREATE INDEX ON leads (organization_id, proxima_acao_em)
  WHERE deleted_em IS NULL AND ganho_em IS NULL AND perdido_em IS NULL;

-- Caixa de entrada do WhatsApp, ordenada por atividade
CREATE INDEX ON wa_conversations (organization_id, ultima_mensagem_em DESC);
CREATE INDEX ON wa_conversations (organization_id, responsavel_id, status);

-- Rolagem da conversa (paginação por cursor, do mais novo para o mais velho)
CREATE INDEX ON wa_messages (conversation_id, enviada_em DESC);

-- Reconhecer o número que está chamando: precisa ser instantâneo
CREATE UNIQUE INDEX ON contacts (organization_id, telefone_e164)
  WHERE deleted_em IS NULL;

-- Contas a pagar / a receber / fluxo de caixa
CREATE INDEX ON financeiro.fin_entries (organization_id, escopo, status, vencimento_em)
  WHERE deleted_em IS NULL;
CREATE INDEX ON financeiro.fin_entries (organization_id, client_id, vencimento_em)
  WHERE deleted_em IS NULL AND escopo = 'EMPRESA';

-- Agenda: eventos que cruzam um intervalo
CREATE INDEX ON events USING gist (organization_id, tstzrange(inicio_em, fim_em));

-- Painéis de tráfego
CREATE INDEX ON ad_metrics_daily (organization_id, ad_account_id, data DESC, nivel);

-- Comentários, tags e arquivos polimórficos
CREATE INDEX ON comments   (organization_id, entidade_tipo, entidade_id, criado_em);
CREATE INDEX ON file_links (entidade_tipo, entidade_id);

-- Auditoria: "o que fulano fez", "quem mexeu neste registro"
CREATE INDEX ON auditoria.audit_logs (organization_id, em DESC);
CREATE INDEX ON auditoria.audit_logs (entidade_tipo, entidade_id, em DESC);

-- Busca global
CREATE INDEX ON busca.search_index USING gin (tsv);
CREATE INDEX ON busca.search_index USING gin (titulo gin_trgm_ops);

-- Sino de notificações
CREATE INDEX ON notifications (user_id, criado_em DESC) WHERE lida_em IS NULL;

-- Fila outbox
CREATE INDEX ON outbox (criado_em) WHERE processado_em IS NULL;
```

Índice de intervalo GiST na agenda é o que faz "quais eventos aparecem nesta
semana" ser um índice em vez de varredura — e é o que detecta conflito de
horário de gravação sem ler a tabela inteira.

---

## Auditoria

`auditoria.audit_logs` é append-only, de verdade:

```sql
REVOKE UPDATE, DELETE ON auditoria.audit_logs FROM app_role;
```

O papel da aplicação só tem `INSERT` e `SELECT`. Nem um bug, nem um `deleteMany`
mal escrito, nem alguém com acesso ao painel do Prisma apaga registro de
auditoria. Alterar auditoria exige o papel de dono do banco, que a aplicação
nunca usa.

**O que é registrado:** criação, alteração e exclusão de lead, cliente, contrato,
demanda, lançamento financeiro e credencial; mudança de permissão; troca de
responsável; visualização de senha; exportação; login e logout; falha de login.

**Como:** extensão do Prisma intercepta as mutações e grava `antes`/`depois` em
JSONB, com uma lista de campos redigidos (senha, token, segredo) que nunca entram
no diff.

`credential_access_log` é separada porque tem outro ciclo: cresce rápido, é
consultada por outra tela e tem retenção própria (2 anos).

---

## Migrations

Prisma Migrate, com três regras:

1. **Migration destrutiva é sempre em duas etapas.** Para renomear uma coluna:
   adiciona a nova, copia, faz o deploy que escreve nas duas, depois o deploy que
   lê só da nova, depois remove a antiga. Nunca renomeia direto — o deploy não é
   atômico e há um intervalo em que código velho e schema novo convivem.
2. **Toda migration roda antes em branch do Neon**, com cópia dos dados de
   produção. É automático no preview do PR.
3. **`CREATE INDEX CONCURRENTLY`** em tabela com mais de 100 mil linhas, fora da
   transação da migration.

`prisma db push` não é usado fora do ambiente local.

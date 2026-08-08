# 07 — Desempenho

O briefing pede que o sistema pareça um aplicativo desktop. Isso não vem de
otimizar depois — vem de quatro decisões estruturais tomadas antes.

## Metas

Números, porque "rápido" não é verificável.

| Interação | p50 | p95 | Como se mede |
|---|---|---|---|
| Navegar entre módulos | 100 ms | 250 ms | percebido: transição do App Router |
| Abrir kanban (200 cards) | 300 ms | 600 ms | TTFB + hidratação |
| Arrastar card | **0 ms** | 0 ms | otimista: a confirmação é assíncrona |
| Abrir ficha de lead/demanda | 200 ms | 450 ms | |
| Busca global (⌘K) | 80 ms | 200 ms | com debounce de 150 ms |
| Enviar mensagem no WhatsApp | **0 ms** na tela | — | otimista, com status de entrega |
| Painel Geral completo | 400 ms | 900 ms | 12 indicadores agregados |
| Rolar caixa de entrada | 60 fps | — | lista virtualizada |

Meta de orçamento de JS: **< 200 KB** comprimido na primeira carga. É o número
que decide o desempenho em celular e em conexão ruim, e é o mais fácil de perder
sem perceber. Verificado no CI a cada PR.

---

## 1. Servidor por padrão

React Server Components fazem a busca de dados no mesmo processo que renderiza.
Não existe `useEffect` que busca dados para pintar tela — que é a origem da
cascata de requisições que faz um sistema parecer lento mesmo com o banco rápido.

Cliente só onde há interatividade real: kanban, editor, caixa de entrada,
gráficos, ⌘K. Cada `"use client"` é uma decisão, não um reflexo.

**Suspense por região.** O Painel Geral não espera o indicador mais lento: cada
card é um limite de Suspense com seu skeleton. A tela aparece em ~150 ms e os
números entram conforme chegam.

---

## 2. Consultas que não degradam

**Paginação por cursor, nunca `OFFSET`.** `OFFSET 10000` faz o Postgres ler e
descartar 10 mil linhas. Cursor sobre `(criado_em, id)` custa o mesmo na página
1 e na página 500. Vale para conversas, mensagens, atividades, auditoria e
listagens.

**Sem N+1.** Prisma com `select` explícito — nunca `include` de árvore inteira.
Uma listagem de 50 demandas com cliente e responsável é **uma** consulta, não 101.
Em desenvolvimento, um contador de queries por requisição avisa acima de 10.

**Agregação no banco, não em JS.** Os 12 indicadores do Painel Geral são uma
consulta com `FILTER`:

```sql
SELECT
  count(*) FILTER (WHERE prazo_em < now() AND concluida_em IS NULL) AS atrasadas,
  count(*) FILTER (WHERE prazo_em::date = current_date)            AS hoje,
  count(*) FILTER (WHERE prioridade = 'URGENTE')                   AS urgentes
FROM demands
WHERE organization_id = $1 AND deleted_em IS NULL;
```

Uma varredura de índice, um round-trip. Doze consultas separadas seriam doze
round-trips ao Neon, e cada um custa uns 20 ms.

**Colunas derivadas onde o cálculo é caro.** `clients.saude`,
`wa_conversations.nao_lidas` e `wa_conversations.ultima_mensagem_previa` são
mantidas por trigger ou job. Calcular na leitura significa subquery por linha na
listagem — o padrão que funciona com 10 clientes e trava com 300.

---

## 3. Cache em camadas

| Camada | O que | Invalidação |
|---|---|---|
| React `cache()` | `TenantContext`, permissões | fim da requisição |
| `unstable_cache` do Next | listas de configuração (etapas, tipos, categorias, planos) | por tag, na escrita |
| Redis | painéis agregados, contadores | TTL 60 s + tag |
| TanStack Query | quadros e caixa de entrada | `staleTime` 30 s, revalida ao focar |
| CDN | estáticos | hash no nome |

Métricas de tráfego têm cache mais agressivo (5 min): vêm de
`ad_metrics_daily`, que só muda uma vez por dia na sincronização.

**Invalidação por tag, não por tempo.** Criar demanda invalida
`org:{id}:demandas` e `org:{id}:painel`. Esperar TTL expirar é o que faz o
usuário criar algo e não ver aparecer — e é o pior sintoma possível num sistema
de uso diário.

---

## 4. Escrita otimista de verdade

Arrastar card, marcar tarefa, trocar responsável, marcar conta como paga: a tela
muda **antes** do servidor responder.

```
1. UI aplica a mudança             (0 ms — o usuário já vê)
2. Server Action em segundo plano
3a. sucesso → confirma silenciosamente
3b. erro    → reverte + toast com o motivo + botão "tentar de novo"
```

Para que isso não vire perda de dado, três garantias: **chave de idempotência**
em toda mutação otimista (reenviar não duplica), **fila local** das escritas
pendentes se a conexão cair, e **reversão visível** — nunca falha silenciosa.

---

## Listas grandes

- **Virtualização** (TanStack Virtual) na caixa de entrada, no histórico de
  conversa, na auditoria e em qualquer tabela acima de 100 linhas. Renderiza ~30
  itens, não 5.000.
- **Kanban:** 20 cards por coluna, com "carregar mais". Uma coluna com 400 leads
  não renderiza 400 cards.
- **Imagens:** `next/image` com AVIF/WebP; miniatura gerada no worker no upload
  (a listagem de arquivos nunca carrega o original).
- **Divisão de código:** editor rico, gráficos e o cliente de WhatsApp entram por
  `dynamic()`. Quem não abre a wiki não baixa o TipTap.

---

## Busca global

### Decisão 8 — Postgres, não Meilisearch

Meilisearch é melhor em busca. Também é mais um serviço para hospedar,
monitorar, atualizar e manter em sincronia com o banco — e o pior modo de falha
de um índice externo é ficar dessincronizado em silêncio.

Postgres resolve bem até a ordem de 1 milhão de registros, que está muito além do
horizonte desta agência. A migração fica prevista e barata: `search_index` já é
uma tabela única e desnormalizada, com o formato que um Meilisearch consumiria.

**Como funciona.** Tabela `busca.search_index` com uma linha por entidade
pesquisável, alimentada pelo `outbox` (o worker atualiza o índice depois da
escrita — assíncrono, para não deixar a escrita mais lenta).

```sql
tsv = setweight(to_tsvector('portuguese', unaccent(titulo)), 'A')
   || setweight(to_tsvector('portuguese', unaccent(corpo)),  'B')
```

- `unaccent` — "orcamento" encontra "Orçamento". Em português isso não é luxo.
- `pg_trgm` para erro de digitação: se o `tsquery` não devolver nada, uma segunda
  consulta usa similaridade por trigrama ("Carvaho" → "Casa Carvalho").
- `setweight` faz o título pesar mais que o corpo.
- Filtro de permissão **na query**, sempre — ver [05](05-permissoes.md).
- Debounce de 150 ms; a requisição anterior é cancelada por `AbortController`.

---

## Sincronização e filas

Tudo que fala com API externa roda em fila, nunca no caminho da requisição.

| Fila | Concorrência | Retry |
|---|---|---|
| `meta-sync` | 2 | 5×, backoff exponencial, respeitando o *rate limit* da Meta |
| `whatsapp-envio` | 1 por número | 3×, com limitador por número |
| `notificacoes` | 10 | 3× |
| `email` | 5 | 5× |
| `outbox` | 5 | infinito com teto, alerta após 10 falhas |

**Sincronização da Meta:** 05:00, reprocessando os últimos 7 dias por conta. A
janela de 7 dias existe porque a Meta reajusta atribuição retroativamente — sem
isso, o número de ontem fica errado para sempre. `ON CONFLICT DO UPDATE` no
`UNIQUE (ad_account_id, data, nivel, external_id)` torna o reprocessamento
idempotente.

---

## Conexões com o banco

Serverless abre conexão por invocação; Postgres tem limite. Sem cuidado, um pico
de tráfego esgota o pool e o sistema inteiro cai com "too many connections" —
que é o modo de falha mais comum de Next + Postgres.

- `apps/web` usa o **pooler do Neon** (PgBouncer, modo transação), com
  `connection_limit=1` na URL do Prisma.
- `apps/worker` usa conexão direta, pool de 10 — ele é um processo só e roda
  transações longas, que o modo transação do PgBouncer não suporta bem.
- Migrations usam a URL direta (`DIRECT_URL` do Prisma).

**Cold start do Neon:** o plano gratuito suspende o banco após inatividade, e a
primeira consulta depois disso leva ~500 ms. Para uso diário isso incomoda; o
plano pago mantém sempre ligado. É a primeira despesa que vale pagar.

---

## Monitoramento

Não dá para melhorar o que não se mede.

- **Sentry** — erros e *performance tracing* no web e no worker, com o `orgId` e
  o `userId` em cada evento.
- **Vercel Analytics** — Web Vitals reais, não de laboratório.
- **Log de query lenta** — Postgres com `log_min_duration_statement = 200ms`;
  revisão semanal.
- **Painel de filas** — Bull Board, atrás de autenticação de admin: tamanho da
  fila, taxa de falha, idade do job mais antigo.
- **Alertas:** `outbox` com item não processado há mais de 5 min; fila do
  WhatsApp acima de 100; taxa de erro acima de 1%; p95 de rota acima de 1 s.

O alerta do `outbox` é o mais importante do conjunto: enquanto ele estiver
silencioso, nenhuma ação de usuário se perdeu.

# 01 — Arquitetura geral

## Visão em uma tela

```
                        ┌─────────────────────────────────────┐
   Navegador ──────────▶│  apps/web  —  Next.js 15 (Vercel)   │
   (desktop, mobile)    │                                     │
                        │  React Server Components (leitura)  │
                        │  Server Actions (escrita)           │
                        │  Route Handlers (webhooks, upload)  │
                        └──────────┬──────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
       ┌────────────┐      ┌──────────────┐     ┌──────────────┐
       │ PostgreSQL │      │    Redis     │     │ Cloudflare R2│
       │  (Neon)    │      │  (Upstash)   │     │  (arquivos)  │
       │            │      │              │     │              │
       │ dados +    │      │ cache, filas │     │ upload direto│
       │ busca +    │      │ rate limit   │     │ do navegador │
       │ auditoria  │      │ pub/sub      │     │ presigned URL│
       └─────▲──────┘      └──────▲───────┘     └──────────────┘
             │                    │
             │                    │
       ┌─────┴────────────────────┴──────────────────────────┐
       │  apps/worker  —  Node sempre ligado (Railway/Fly)   │
       │                                                     │
       │  BullMQ workers   WebSocket gateway   cron          │
       │  sessões WhatsApp   sync Meta/Google   e-mail       │
       └──────────┬──────────────────────────────────────────┘
                  │
                  ▼
       ┌──────────────────────────────────────────────────┐
       │  APIs externas                                    │
       │  Meta Graph · WhatsApp Cloud · Google Ads         │
       │  Google Calendar · Resend · Sentry                │
       └──────────────────────────────────────────────────┘
```

---

## Decisão 1

### O MARK SISTEM absorve este repositório

O caminho óbvio seria começar um projeto novo em branco. Não é o certo aqui.

`src/lib/meta.ts` tem 836 linhas que codificam conhecimento operacional real da
Graph API, e nada disso está escrito em documentação em lugar nenhum:

- a taxonomia de `action_type` que separa conversa iniciada, primeira resposta e
  profundidade 2/3/5 (`ACAO`, linhas 5–14);
- o fato — documentado em comentário — de que essas métricas **não formam funil**,
  porque conversa iniciada tem janela de atribuição de 7 dias e as de
  profundidade não têm janela nenhuma;
- leitura de orçamento e aportes da conta, que a API não entrega de forma direta;
- o *change log* da conta e o cálculo de impacto antes/depois de cada alteração;
- a limpeza do token de toda mensagem de erro antes que ela vire log
  (`limpar()`), que é o tipo de detalhe que só se aprende vazando um token uma
  vez.

Reescrever isso custaria semanas e reintroduziria bugs já corrigidos. Ele vira
`packages/integrations/meta`, com duas mudanças: o token deixa de vir de variável
de ambiente e passa a vir do cofre de credenciais, e os resultados passam a ser
gravados em `ad_metrics_daily` em vez de descartados.

**Consequência prática:** o módulo 12 (Gestão de Tráfego) nasce com dados reais
da Meta. O briefing previa "primeira versão com registros manuais" — isso não é
mais necessário, e é uma melhoria em relação ao que foi pedido.

### Herança do painel atual

| Ativo atual | Destino |
|---|---|
| `src/lib/meta.ts` | → `packages/integrations/meta` — **aproveitado quase inteiro** |
| `src/lib/presets.ts`, `periodo.ts` | → `packages/core/periodo` — presets de período do Gerenciador, reaproveitados |
| `src/lib/format.ts` | → `packages/ui/format` — formatação pt-BR |
| `src/lib/impostos.ts` | → regra de negócio do módulo de tráfego, com alíquota vinda do banco |
| `src/lib/registro.ts` | → base do `traffic_notes`, agora com Prisma |
| `src/lib/diagnostico.ts` | → mantido, vira o `/api/saude` do sistema novo |
| `src/components/*` (Recharts) | → reaproveitados como componentes do módulo de tráfego, sob o novo design system |
| Disciplina de segredo (`limpar()`, nada de `NEXT_PUBLIC_`, token só no servidor) | → vira regra do projeto, com lint |
| `src/lib/auth.ts` (PBKDF2 + `jose`) | **substituído** — ver decisão 4 |
| `src/lib/clientes.ts` (tokens em `META_TOKENS`) | **substituído** pelo cofre de credenciais |
| Scripts Python na raiz | mantidos como utilitários avulsos, fora do build |

A migração dos usuários atuais de `DASH_USERS` é um script de seed: cada entrada
`usuario:pbkdf2.iteracoes.salt.hash` vira uma linha em `users`, com o hash
preservado. O verificador PBKDF2 existente continua no código para essas contas
antigas; senhas novas usam Argon2id, e a conta migra de algoritmo no primeiro
login bem-sucedido. Ninguém precisa trocar de senha.

---

## Decisão 2

### Dois processos, não um

O briefing sugere deploy na Vercel. Para o front, certo. Para o sistema inteiro,
não — e essa é a decisão de infraestrutura mais consequente do projeto.

Quatro coisas que o MARK SISTEM precisa **não funcionam em serverless**:

1. **Sessão de WhatsApp.** Uma conexão de WhatsApp é um socket que precisa ficar
   aberto por dias. Função serverless morre em segundos.
2. **Filas.** Um worker BullMQ é um processo que fica escutando o Redis. Não é
   uma requisição HTTP.
3. **WebSocket.** A caixa de entrada do WhatsApp e as notificações em tempo real
   precisam de conexão persistente. A Vercel não hospeda servidor WebSocket.
4. **Cron pesado.** Sincronizar métricas de 9 contas da Meta, gerar recorrências
   financeiras e varrer prazos vencidos passa do limite de execução de função.

Então:

| | `apps/web` | `apps/worker` |
|---|---|---|
| **Onde** | Vercel | Railway ou Fly.io (~US$ 10/mês) |
| **Modelo** | serverless, escala a zero | um processo, sempre ligado |
| **Faz** | render, leitura, escrita interativa, webhooks | filas, cron, sockets, sync, WebSocket |
| **Não faz** | nada que demore mais de 10 s | nada que responda a usuário direto |

Os dois compartilham `packages/*` — mesmo schema Prisma, mesmas regras de
permissão, mesmos tipos. Um monorepo pnpm com Turborepo.

**Alternativa considerada e rejeitada:** tudo em um VPS com Next em modo
`standalone`. É mais barato e mais simples de raciocinar, mas você perde preview
deploy por branch, CDN e rollback de um clique — coisas que importam muito num
projeto tocado por uma pessoa. Se o custo do worker incomodar, essa é a troca
disponível.

---

## Stack

Escolhida por estabilidade e por ser pequena. Cada item aqui é uma coisa a mais
para manter atualizada.

| Camada | Escolha | Por que essa |
|---|---|---|
| Framework | **Next.js 15** (App Router) | já é o que existe; RSC elimina metade das APIs REST |
| Linguagem | **TypeScript** estrito | `strict: true` já ligado no repo |
| UI | **Tailwind + shadcn/ui + Lucide** | shadcn é código no seu repo, não dependência — dá para adaptar sem fork |
| Estado servidor | **RSC + Server Actions** e **TanStack Query** só nos quadros interativos | menos JS no cliente; Query só onde há drag-and-drop e polling |
| Formulários | **React Hook Form + Zod** | mesmo schema Zod valida no cliente e no servidor |
| Banco | **PostgreSQL 16** (Neon) | já usado no projeto; FTS, JSONB, RLS e particionamento sem serviço extra |
| ORM | **Prisma 6** | migrations versionadas; `$queryRaw` disponível quando o SQL precisa ser bom |
| Auth | **Auth.js v5** + Argon2id + sessão em banco | ver decisão 4 e [06](06-seguranca.md) |
| Cache / fila | **Redis** (Upstash) + **BullMQ** | fila com retry, backoff e rate limit por fila — o que WhatsApp exige |
| Arquivos | **Cloudflare R2** (S3-compatível) | egress zero; uma agência move muito vídeo |
| Tempo real | **WebSocket no worker** + Redis pub/sub | sem Pusher: menos um fornecedor, menos um custo por conexão |
| Busca | **Postgres** `unaccent` + `pg_trgm` | ver [07](07-desempenho.md#busca-global) |
| E-mail | **Resend** | conforme briefing; bom DX, domínio próprio |
| Erros | **Sentry** | front e worker |
| Testes | **Vitest** + **Playwright** | ver [10](10-roadmap-e-mvp.md#testes) |

**Fora da stack, de propósito:** GraphQL (uma equipe, um cliente — REST + Server
Actions basta), tRPC (Server Actions já dão tipo fim a fim), Supabase (Neon +
Auth.js próprios evitam acoplar identidade e storage a um fornecedor só),
Kubernetes, microserviços.

---

## Fluxo de dados

**Leitura.** O componente é Server Component, chama uma função de
`packages/data` que já recebe o `TenantContext` (org + usuário + permissões), e
essa função monta a query Prisma com o escopo aplicado. Não existe fetch de API
interna a partir do navegador para renderizar tela.

**Escrita.** Server Action → valida com Zod → checa permissão com
`can(actor, permissao, recurso)` → executa em transação → grava `audit_logs` e
`outbox` na **mesma transação** → `revalidatePath`.

O `outbox` é o que torna o sistema confiável: nenhuma ação de usuário chama API
externa direto. Ela grava um evento na tabela `outbox` junto com a mudança, e o
worker lê e executa. Se a Meta estiver fora do ar, o lead foi criado do mesmo
jeito e a sincronização acontece quando ela voltar. É isso que cumpre o
requisito da seção 32 do briefing — "se o WhatsApp cair, o CRM continua".

**Tempo real.** O worker publica no Redis; o gateway WebSocket entrega para as
sessões conectadas daquela organização, filtrando por permissão antes de
enviar.

---

## Ambientes

| | Banco | Storage | Deploy |
|---|---|---|---|
| **Local** | Postgres em Docker | R2 bucket `dev` | `pnpm dev` |
| **Preview** | branch do Neon (cópia instantânea) | bucket `preview` | automático por PR |
| **Produção** | Neon principal, PITR 7 dias | bucket `prod` | merge na `main` |

Branch de banco do Neon por preview é o que permite testar migration destrutiva
sem medo. Custa nada e é o argumento mais forte a favor do Neon.

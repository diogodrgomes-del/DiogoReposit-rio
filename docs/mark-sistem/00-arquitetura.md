# MARK SISTEM — Arquitetura

Documento 1 de 3. Aqui estão as decisões estruturais: stack, infraestrutura,
módulos, navegação, pastas, segurança, desempenho e integrações.

- [`01-modelagem.md`](01-modelagem.md) — banco de dados, entidades, permissões
- [`02-roadmap.md`](02-roadmap.md) — riscos, ordem de desenvolvimento, MVP

Nenhuma linha de código de produção foi escrita ainda. Este documento existe para
ser discutido e contestado antes disso.

---

## 1. Ponto de partida: o que já existe

O repositório contém o **Painel de Campanhas da Marktiva** — Next.js 15 (App
Router), React 19, TypeScript, leitura ao vivo da Graph API da Meta, login por
`DASH_USERS` com PBKDF2, sessão JWT em cookie `HttpOnly`, e uma tabela de
anotações em Postgres.

Ele não é um protótipo descartável. É código com decisões defensáveis: token
nunca cruza para o navegador, comparação de senha em tempo constante, driver de
banco escolhido pela URL para não estourar conexões em serverless, paleta
validada para daltonismo.

**Decisão: o MARK SISTEM absorve esse painel como o módulo de Gestão de
Tráfego.** As telas e a camada `src/lib/meta.ts` migram quase inteiras. O que
muda são três coisas, e vale entender por quê:

| Hoje | No MARK SISTEM | Motivo |
|---|---|---|
| Clientes em `META_TOKENS` (variável de ambiente) | Clientes em tabela, token cifrado | O sistema inteiro gira em torno da entidade cliente; ela não pode viver num `.env` |
| Usuários em `DASH_USERS` | Tabela `usuarios` + papéis | Permissões granulares são requisito central |
| Leitura ao vivo da Meta a cada request | Sincronização por worker → banco | Um painel de 1 cliente aguenta; um dashboard com 20 clientes × 4 períodos, não |

A terceira é a mais importante e volto nela em [Desempenho](#10-desempenho).

---

## 2. Princípios de engenharia

Cinco regras que decidem os empates deste projeto.

**1. Autorização mora no acesso a dados, não na rota.**
Toda leitura e escrita passa por funções em `packages/core` que recebem um
`Contexto` (`{ organizacaoId, usuarioId, permissoes, escopos }`). Nenhum Server
Component, Server Action ou Route Handler consulta o banco diretamente. Isso
elimina a classe de bug mais comum em sistemas com permissão: a rota nova que
alguém escreveu sem lembrar de checar.

**2. O banco é a segunda parede, não a primeira.**
Row Level Security no Postgres com `organizacao_id` e escopo financeiro. Se a
aplicação errar, o banco recusa. Duas paredes independentes falham juntas com
muito menos frequência do que uma.

**3. Escrita de negócio e efeito colateral não compartilham transação.**
Criar uma demanda grava a demanda, o evento de linha do tempo e uma linha na
tabela `outbox` — tudo atômico. Notificar, indexar para busca e mandar WhatsApp
acontecem depois, no worker, lendo a `outbox`. Consequência prática: **o
WhatsApp cair não impede ninguém de trabalhar**, e nenhuma notificação se perde
por causa de um timeout.

**4. Nada de exclusão física.** `excluido_em timestamptz` em toda tabela de
negócio, lixeira por módulo, restauração. Erro de clique não destrói trabalho.

**5. Multi-tenant desde a primeira migração.** `organizacao_id` em todas as
tabelas, mesmo existindo só a Marktiva. Retrofit de multi-tenancy num sistema de
40 tabelas é reescrita, não refactor.

---

## 3. Stack — decisões e justificativas

### Mantido do painel atual

**Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · Vercel.**
Server Components resolvem sozinhos metade do problema de desempenho listado no
briefing: a página chega renderizada, sem cascata de `fetch` no cliente.

### Escolhas novas

**ORM: Drizzle — não Prisma.**
O briefing sugeriu Prisma. Recomendo Drizzle, por três razões concretas:

1. **RLS exige controle da conexão.** Cada transação precisa executar
   `SET LOCAL app.organizacao_id`. Em Drizzle isso é uma linha; em Prisma exige
   `$queryRaw` e escapar do modelo de sessão do próprio ORM.
2. **Serverless.** Drizzle é só TypeScript — sem query engine binário, sem
   cold start extra, funciona em Edge Runtime.
3. **Continuidade.** O SQL do painel atual é legível e deliberado. Drizzle
   preserva esse SQL; Prisma o esconderia atrás de um DSL, justamente na parte
   do sistema em que vamos brigar por índice e plano de execução.

Custo honesto: Prisma tem DX melhor para relações profundas e uma comunidade
maior. Drizzle exige escrever mais `join` à mão. Aceito a troca — o ganho em
controle de RLS e desempenho vale mais aqui.

**Banco: PostgreSQL (Neon).** Já é o banco do projeto. Neon dá branching de
banco por preview deploy, o que torna migração testável sem risco.

**Autenticação: Auth.js v5 (credentials) + sessão em banco.**
Não Clerk: identidade de uma agência interna não precisa virar dependência
externa paga, e o dado de usuário está entrelaçado com permissão, escopo por
cliente e auditoria — tudo dentro do nosso banco. Hash: **Argon2id** (o PBKDF2
atual é aceitável, mas Argon2id resiste melhor a GPU; migração transparente no
próximo login de cada usuário).

**Filas: BullMQ + Redis (Upstash).** Roda no worker, não na Vercel.

**Tempo real: SSE sobre Redis pub/sub.** Não Pusher, não Supabase Realtime.
Já vamos ter Redis e um serviço persistente; um endpoint `/api/eventos` com
Server-Sent Events resolve notificação, chat interno e atualização de Kanban sem
mais um fornecedor e sem mais uma fatura.

**Arquivos: Cloudflare R2** (API compatível com S3, egress zero). Upload
**direto do navegador via URL pré-assinada** — o arquivo nunca passa pelo
servidor Next.

**Busca: Postgres FTS + `unaccent` + `pg_trgm`.** Cobre "tolerante a pequenas
diferenças de escrita" sem Meilisearch. A interface de busca fica atrás de uma
função `buscar()`; trocar o motor depois é mudar uma implementação.

**Validação: Zod. Formulários: React Hook Form. Monitoramento: Sentry.
E-mail: Resend. UI: shadcn/ui + Lucide.** Como sugerido — são as escolhas
certas.

### Recusado de propósito

| Tecnologia | Por que não |
|---|---|
| GraphQL | Server Actions + RSC já dão tipagem ponta a ponta. GraphQL aqui só acrescenta camada e problema de N+1. |
| Microsserviços | Uma agência. Um monólito modular bem separado escala muito além disso, e um monólito com fronteiras claras vira serviços depois; o contrário não. |
| Kafka / event streaming | `outbox` em Postgres entrega a mesma garantia neste volume, com um sexto da operação. |
| tRPC | Redundante com Server Actions no App Router. |

---

## 4. Topologia de infraestrutura

O ponto que decide a infra: **a Vercel não sustenta processo de longa duração.**
Socket de WhatsApp, worker de fila e cron pesado precisam de outro lugar.

```
┌──────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                   │
│  Next.js (RSC) · Tailwind · shadcn/ui · TanStack Query       │
└───────┬──────────────────────────────────────────┬───────────┘
        │ HTTPS                                    │ SSE
┌───────▼──────────────────────────┐   ┌───────────▼───────────┐
│  apps/web — VERCEL               │   │  apps/worker — FLY.IO │
│  Server Components               │   │  BullMQ (filas)       │
│  Server Actions                  │   │  Ponte WhatsApp       │
│  Route Handlers (webhooks)       │   │  Sync Meta/Google Ads │
│  Middleware (sessão)             │   │  Cron (vencimentos)   │
│                                  │   │  Drenagem da outbox   │
└───────┬──────────────────────────┘   └───────────┬───────────┘
        │                                          │
        └──────────────┬───────────────────────────┘
                       │
   ┌───────────────────┼───────────────────┬──────────────────┐
   │                   │                   │                  │
┌──▼──────────┐  ┌─────▼──────┐  ┌─────────▼─────┐  ┌─────────▼──────┐
│ NEON        │  │ UPSTASH    │  │ CLOUDFLARE R2 │  │ APIS EXTERNAS  │
│ PostgreSQL  │  │ Redis      │  │ arquivos      │  │ Meta · Google  │
│ + RLS       │  │ fila/cache │  │ (pré-assinado)│  │ WhatsApp       │
│ + FTS       │  │ pub/sub    │  │               │  │ Resend         │
└─────────────┘  └────────────┘  └───────────────┘  └────────────────┘
```

Custo mensal estimado no porte da Marktiva: Vercel Pro US$ 20 · Fly.io ~US$ 10 ·
Neon ~US$ 20 · Upstash ~US$ 10 · R2 ~US$ 5 · Sentry gratuito. **~US$ 65/mês.**

---

## 5. Mapa dos módulos

Três anéis, por dependência. Um anel só depende dos anéis internos.

```
┌────────────────────────── NÚCLEO ──────────────────────────┐
│  Organizações · Usuários · Papéis e Permissões · Sessões   │
│  Contatos · Clientes · Etiquetas · Arquivos · Comentários  │
│  Eventos (linha do tempo) · Auditoria · Notificações       │
│  Busca global · Outbox                                     │
└────────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
┌───────┴────────┐  ┌────────┴────────┐  ┌────────┴─────────┐
│  COMERCIAL     │  │  OPERACIONAL    │  │  FINANCEIRO      │
│  Leads         │  │  Demandas       │  │  Lançamentos     │
│  Pipelines     │  │  Quadros        │  │  Contas a pagar  │
│  Atividades    │  │  Subtarefas     │  │  Contas a receber│
│  Propostas     │  │  Tempo          │  │  Fluxo de caixa  │
│  Onboarding    │  │  Gravações      │  │  Pessoal (cofre) │
└────────────────┘  └─────────────────┘  └──────────────────┘
        ▲                    ▲                    ▲
┌───────┴────────────────────┴────────────────────┴─────────┐
│  APOIO                                                     │
│  WhatsApp · Agenda · Estratégia · Tráfego · Aprovações     │
│  Senhas e Acessos · Wiki · Mural · Pesquisa · Config       │
└────────────────────────────────────────────────────────────┘
```

**O contato é a espinha dorsal.** Esta é a decisão de modelagem mais consequente
do sistema, e ela resolve sozinha o requisito 8.4 (WhatsApp ↔ CRM):

> Um telefone entra pelo WhatsApp. Normalizado para E.164, ele encontra — ou
> cria — um **contato**. O contato pode estar ligado a um **lead**, a um
> **cliente**, a nenhum dos dois, ou aos dois. A conversa nunca aponta para lead
> nem para cliente: aponta para o contato.

Sem isso, "transformar lead em cliente" duplica dados e a conversa do WhatsApp
perde o histórico no momento exato em que ele passa a valer mais.

### Os 17 módulos

| # | Módulo | Rota | Depende de |
|---|---|---|---|
| 1 | Painel Geral | `/` | todos (leitura agregada) |
| 2 | CRM de Vendas | `/vendas` | núcleo |
| 3 | WhatsApp | `/whatsapp` | núcleo, vendas |
| 4 | CRM de Gestão | `/gestao` | clientes, financeiro |
| 5 | Financeiro | `/financeiro` | núcleo, clientes |
| 6 | Clientes | `/clientes` | núcleo |
| 7 | CRM Operacional | `/operacional` | núcleo, clientes |
| 8 | Agenda | `/agenda` | núcleo |
| 9 | Estratégias | `/clientes/[id]/estrategia` | clientes |
| 10 | Gestão de Tráfego | `/clientes/[id]/trafego` | clientes |
| 11 | Arquivos | `/clientes/[id]/arquivos` | núcleo |
| 12 | Senhas e Acessos | `/clientes/[id]/acessos` | núcleo, cofre |
| 13 | Aprovações | `/aprovacoes` | operacional |
| 14 | Comunicação Interna | `/mural` | núcleo |
| 15 | Pesquisa | `/clientes/[id]/pesquisa` | clientes |
| 16 | Wiki | `/wiki` | núcleo |
| 17 | Configurações | `/config` | núcleo |

Módulo novo entra criando `packages/core/<modulo>`, `apps/web/src/modulos/<modulo>`
e registrando permissões e itens de menu. **Nenhum módulo existente é tocado** —
é isso que "adicionar módulos sem reestruturar" significa na prática.

---

## 6. Fluxo de navegação

### Estrutura de tela

```
┌────────────────────────────────────────────────────────────────┐
│ ⌘K Buscar…            MARK SISTEM              🔔 3   Diogo ▾  │  56px
├──────────┬─────────────────────────────────────────────────────┤
│ Painel   │                                                     │
│ Vendas   │                                                     │
│ WhatsApp │            ÁREA DE CONTEÚDO                         │
│ Clientes │            (streaming + skeleton)                   │
│ Operac.  │                                                     │
│ Agenda   │                                                     │
│ Financ.  │  ← oculto sem permissão                             │
│ ─────    │                                                     │
│ Wiki     │                                                     │
│ Config   │                                                     │
└──────────┴─────────────────────────────────────────────────────┘
   240px
```

Sidebar recolhível (persistida em cookie, não em `localStorage` — assim o
servidor já renderiza no estado certo e não há salto na primeira pintura).
Abaixo de 1024px vira gaveta; abaixo de 768px, barra inferior com os 5 módulos
mais usados.

### Três caminhos que definem o sistema

**A. Lead até cliente** — o fluxo que o sistema existe para servir:

```
WhatsApp: mensagem de número desconhecido
  → contato criado automaticamente
  → botão "Criar lead" (1 clique, nome + telefone já preenchidos)
  → card em "Lead novo"
  → arrasta para "Reunião agendada" → modal cria evento na Agenda
  → proposta gerada da ficha
  → arrasta para "Fechado"
  → modal: "Transformar em cliente?"  ← ONBOARDING AUTOMÁTICO
      cliente criado · contrato · projeto · pastas no R2
      tarefas do modelo · reunião de onboarding · lançamentos financeiros
      solicitação de acessos · notificações à equipe
  → mesma conversa de WhatsApp, agora mostrando ficha de cliente
```

Sem duplicação de dado e sem perda de histórico, porque tudo pendura no mesmo
`contato`.

**B. Painel Geral → ação.** Todo card do painel é um link para uma lista já
filtrada. "Demandas atrasadas: 7" leva a
`/operacional/quadro?status=atrasada&responsavel=eu`. Filtro vive na URL, então
é compartilhável, sobrevive a refresh e volta certo no botão voltar.

**C. Busca global (⌘K).** Um índice, sete tipos de entidade, resultados
agrupados, `Enter` navega. Respeita permissão: o que você não pode ver não
aparece — nem como título.

---

## 7. Estrutura de pastas

Monorepo com pnpm workspaces + Turborepo.

```
mark-sistem/
├── apps/
│   ├── web/                        Next.js 15 — UI e API
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (publico)/login/
│   │       │   ├── (app)/          layout com sidebar; tudo autenticado
│   │       │   │   ├── page.tsx            painel geral
│   │       │   │   ├── vendas/
│   │       │   │   ├── whatsapp/
│   │       │   │   ├── clientes/[id]/
│   │       │   │   ├── operacional/
│   │       │   │   ├── agenda/
│   │       │   │   ├── financeiro/         guardado por layout
│   │       │   │   ├── wiki/
│   │       │   │   └── config/
│   │       │   └── api/
│   │       │       ├── webhooks/           whatsapp, meta, resend
│   │       │       ├── eventos/            SSE
│   │       │       └── upload/             assinatura R2
│   │       ├── modulos/            código de tela por módulo
│   │       │   └── vendas/
│   │       │       ├── componentes/
│   │       │       ├── acoes.ts    Server Actions ("use server")
│   │       │       └── consultas.ts
│   │       ├── componentes/        compartilhados entre módulos
│   │       └── lib/
│   └── worker/                     Node persistente — Fly.io
│       └── src/
│           ├── filas/              definições BullMQ
│           ├── processadores/      notificacoes, indexacao, cobranca
│           ├── whatsapp/           ponte, sessões, reconexão
│           ├── sync/               meta-ads, google-ads
│           └── cron/
├── packages/
│   ├── db/                         Drizzle: esquema, migrações, RLS, seeds
│   ├── core/                       REGRA DE NEGÓCIO — sem HTTP, sem React
│   │   ├── contexto.ts             Contexto + pode()
│   │   ├── vendas/  operacional/  financeiro/  clientes/  …
│   │   └── outbox.ts
│   ├── auth/                       sessão, hash, papéis
│   ├── cofre/                      cifra envelopada de credenciais
│   ├── integracoes/                adaptadores externos
│   │   ├── whatsapp/               interface + provedores
│   │   ├── meta-ads/  google-ads/  storage/  email/
│   ├── ui/                         design system
│   └── contratos/                  schemas Zod compartilhados
└── docs/mark-sistem/
```

**A regra que sustenta a estrutura:** `packages/core` não importa nada de
`next`, `react` ou `apps/`. É TypeScript puro sobre Drizzle. Consequência: a
regra de negócio é testável sem subir servidor, o worker reusa exatamente a
mesma regra que a web, e um app mobile ou uma API pública futura entram sem
reescrever nada.

Isso é garantido por lint (`eslint-plugin-boundaries`), não por disciplina.

---

## 8. Design System

Tokens em CSS custom properties, consumidos pelo Tailwind. Tema claro é o
padrão; o escuro do painel atual é preservado.

```css
--azul-600: #2563EB;   /* primária, conforme briefing */
--azul-700: #1D4ED8;   /* hover */
--azul-50:  #EFF6FF;   /* fundo de seleção */

--cinza-50:  #F9FAFB;  /* fundo da aplicação */
--cinza-200: #E5E7EB;  /* bordas */
--cinza-500: #6B7280;  /* texto secundário */
--cinza-900: #111827;  /* texto primário */

--verde-600:  #059669; /* saudável, aprovado, recebido */
--ambar-500:  #F59E0B; /* atenção, aguardando */
--vermelho-600:#DC2626;/* risco, atrasado, reprovado */
```

**Semântica de status é fixa e global.** Verde/âmbar/vermelho significam a mesma
coisa em cliente, demanda, proposta e lançamento. É o que permite ler o painel
sem legenda.

- **Tipografia:** Inter (`next/font`, self-hosted — sem request externo).
  Escala 12/14/16/20/24/30. Corpo 14px: densidade de ferramenta de trabalho,
  não de site institucional.
- **Espaçamento:** grade de 4px. Raio: 6px em controles, 8px em cards.
- **Sombra:** só dois níveis — repouso e elevado (modal, popover).
- **Movimento:** 150ms `ease-out` em hover/foco, 200ms em modal. Framer Motion
  só no Kanban e em reordenação de lista. Tudo respeita
  `prefers-reduced-motion`.
- **Acessibilidade:** contraste AA mínimo; foco visível sempre; cor nunca é o
  único portador de informação (ícone + texto acompanham). A paleta do painel
  atual já é validada para deuteranopia, protanopia e tritanopia — mantida.

**Estados obrigatórios.** Todo componente de dados implementa os cinco:
carregando (skeleton com a forma do conteúdo real, não spinner), vazio (com ação
sugerida), erro (com botão de repetir), sem permissão, e sucesso. Componente sem
os cinco não passa em revisão.

---

## 9. Segurança

### Camadas

```
1. Rede        HTTPS · HSTS · CSP · Rate limit (Upstash)
2. Sessão      Cookie HttpOnly SameSite=Lax · registro em banco · revogável
3. Aplicação   pode() na camada de dados — nunca só na rota
4. Banco       RLS por organizacao_id e por escopo financeiro
5. Dado        Cifra envelopada de credenciais · auditoria imutável
```

### Autorização

Permissão é string `modulo.recurso.acao` — `vendas.lead.editar`,
`financeiro.lancamento.ver`, `credenciais.revelar`. Papéis agregam permissões;
membros recebem papéis e, opcionalmente, **escopo** (só estes clientes).

A mesma função `pode()` roda no servidor (autoritativa) e no cliente (só para
esconder UI). O cliente esconder é conveniência; o servidor recusar é a
segurança.

### Financeiro — o requisito mais afiado do briefing

O briefing exige que o financeiro seja invisível, não apenas bloqueado. Cinco
mecanismos, em camadas:

1. Item de menu não renderiza sem `financeiro.*`.
2. `layout.tsx` de `/financeiro` chama `exigir('financeiro.ver')` — acesso por
   URL direta responde 404, não 403. **404 não confirma que a área existe.**
3. Toda leitura financeira passa por `core/financeiro`, que exige a permissão.
4. Valores em outros módulos (ficha de cliente, card de lead) vêm de um seletor
   que devolve `null` sem permissão — o dado não chega ao HTML, então não está
   no "ver código-fonte".
5. Notificações financeiras são filtradas na geração, não na exibição.

**Financeiro pessoal do proprietário.** Escopo próprio, com RLS por
`proprietario_id`:

```sql
CREATE POLICY lancamento_pessoal ON lancamentos
  USING (
    escopo = 'empresarial'
    OR proprietario_id = current_setting('app.usuario_id')::uuid
  );
```

E uma trava de produto: a permissão `financeiro.pessoal.*` **não é concedível
pela tela de papéis** — é derivada de `organizacoes.proprietario_id`. Ninguém
concede acesso ao financeiro pessoal por engano, nem administradores.

### Cofre de senhas

Cifra envelopada, AES-256-GCM:

```
KEK (env / futuramente KMS)
 └── cifra a DEK (uma por credencial, aleatória)
      └── cifra o segredo
```

Guardados: `segredo_cifrado`, `nonce`, `dek_cifrada`, `versao_kek`. Rotacionar a
KEK reescreve só as DEKs — não o conteúdo. Nada em texto puro, em lugar nenhum,
nunca.

Revelar exige `credenciais.revelar`, é limitado a 10 revelações por hora por
usuário, e grava em auditoria **antes** de devolver o segredo — se a gravação
falhar, o segredo não sai. O valor vai por resposta única, nunca dentro do HTML
da página.

### Uploads

Validação por **magic bytes**, não por extensão. Bucket privado, download por
URL pré-assinada de 5 minutos. Servido de domínio separado com
`Content-Disposition: attachment` — assim um SVG ou HTML enviado por alguém não
executa script na origem do sistema. Antivírus (ClamAV no worker) em fase 2.

### Auditoria

Tabela append-only. `REVOKE UPDATE, DELETE ON auditoria FROM app_usuario` — nem
a aplicação consegue alterar. Registra: quem criou, editou, excluiu, revelou
senha, exportou, mudou permissão, mexeu em valor financeiro.

### Rate limiting

| Ação | Limite |
|---|---|
| Login | 5 tentativas / 15 min por IP+usuário |
| Revelar senha | 10 / hora por usuário |
| Busca global | 30 / min |
| Upload | 100 / hora |
| Webhook WhatsApp | 1000 / min por número |

---

## 10. Desempenho

### A decisão mais importante: não ler API externa no caminho da tela

O painel atual consulta a Graph API da Meta a cada request. Para um cliente por
vez, funciona. Para o painel de tráfego da carteira inteira, é 20 chamadas
sequenciais a uma API de terceiro com rate limit — 8 a 15 segundos, e uma queda
da Meta derruba a tela.

**No MARK SISTEM: o worker sincroniza Meta/Google Ads para o banco a cada 30
minutos; a tela lê o banco.** Resultado: p95 abaixo de 200ms, funciona com a
Meta fora do ar, e o histórico fica nosso — a Meta só devolve 37 meses.
Um botão "Atualizar agora" enfileira sync imediato para quem precisa do número
do minuto.

### Orçamento de desempenho (metas, não aspirações)

| Métrica | Alvo |
|---|---|
| LCP (painel geral) | < 1,2s |
| INP | < 200ms |
| Consulta p95 | < 100ms |
| Server Action p95 | < 300ms |
| JS inicial | < 180KB gzip |

Quebrar o orçamento reprova o build no CI.

### Técnicas

**Banco.** Paginação por cursor (`WHERE (criado_em, id) < (?, ?)`), nunca
`OFFSET` — `OFFSET 10000` lê 10 mil linhas para descartar. Índices compostos na
ordem em que se filtra (ver [`01-modelagem.md`](01-modelagem.md)). Sem N+1: o
DAL agrega por lote.

**Kanban — ordenação fracionária.** Card entre posições 3 e 4 recebe
`ordem = 3.5`. Arrastar é **um** `UPDATE` de uma linha, não reindexar a coluna.
Com 200 cards a diferença é entre 4ms e 400ms, e resolve conflito entre dois
usuários arrastando ao mesmo tempo sem lock.

**Frontend.** Server Components por padrão — `"use client"` só onde há estado.
`<Suspense>` por seção: o painel pinta o cabeçalho enquanto os números carregam.
Virtualização (TanStack Virtual) acima de 100 linhas. `useOptimistic` em
checkbox, arrastar e comentar. Autosave com debounce de 800ms + rascunho em
IndexedDB (fechar a aba não perde texto).

**Cache.** Agregados do painel em Redis com TTL de 60s, invalidados por evento
da outbox — número certo sem recalcular a cada F5.

---

## 11. Integrações

Toda integração implementa uma interface em `packages/integracoes`. O resto do
sistema conhece a interface, nunca o fornecedor. Trocar provedor de WhatsApp é
escrever uma classe nova.

```ts
interface ProvedorWhatsApp {
  conectar(numeroId: string): Promise<Conexao>
  enviarTexto(para: string, texto: string): Promise<Envio>
  enviarMidia(para: string, midia: Midia): Promise<Envio>
  enviarModelo(para: string, modelo: string, vars: string[]): Promise<Envio>
  aoReceber(cb: (m: MensagemRecebida) => void): void
  status(numeroId: string): Promise<StatusConexao>
}
```

### WhatsApp — o maior risco técnico do projeto

Preciso ser direto sobre isto, porque o briefing pede QR Code e QR Code tem um
custo que não aparece na especificação.

| | **Cloud API (oficial)** | **QR Code (não oficial)** |
|---|---|---|
| Como | API da Meta | Baileys/WPPConnect emulando o WhatsApp Web |
| Risco de banimento | Nenhum | **Real e permanente** |
| Número pessoal existente | Não — o número é migrado | Sim |
| Disparo em massa | Só modelo aprovado, 24h de janela | Sem limite técnico — e é assim que se perde o número |
| Custo | ~R$ 0,08 por conversa | Zero |
| Infra | Webhook (serverless serve) | Processo persistente + sessão em disco |

**Recomendação: Cloud API como padrão, ponte QR como opção consciente.**

Ambas atrás da mesma interface. A ponte QR roda isolada no worker, uma sessão
por número, com reconexão automática. Se ela cair, o restante do sistema não
percebe — a conversa fica marcada como "desconectado" e as mensagens ficam na
fila.

E uma regra de produto que a arquitetura impõe: **campanhas de disparo só rodam
por Cloud API com modelo aprovado**, com opt-out registrado por contato e
limite de envio por hora. Não vou construir o caminho que queima o número
comercial da Marktiva.

### Demais integrações

| Integração | Modo | Fase |
|---|---|---|
| Meta Ads | Sync a cada 30min → banco | 1 (já existe) |
| Google Ads | Sync a cada 30min | 3 |
| Google Calendar | Two-way, webhook | 3 |
| Gmail | OAuth, leitura de thread | 4 |
| Google Drive | Espelho de pastas | 4 |
| Resend | Notificação por e-mail | 1 |
| Assinatura eletrônica | Contrato no onboarding | 4 |
| IA (Claude) | Resumo, classificação, SDR | 4 |

**Preparação para IA, sem construir IA agora** (requisito 8.7): as mensagens
guardam `intencao`, `temperatura` e `resumo` como colunas nuláveis; o processador
`analisar-conversa` existe na fila e hoje é no-op. Ligar depois é implementar um
processador — não é migração de banco nem mudança de tela.

---

## 12. Estabilidade

**Se uma integração cair, o resto continua.** Garantido por três mecanismos, não
por intenção:

1. **Outbox.** Efeito externo nunca está na transação de negócio.
2. **Circuit breaker.** Integração com 5 falhas seguidas abre o circuito por 60s.
   A UI mostra "WhatsApp reconectando", o CRM segue normal.
3. **Retry com backoff** (1s, 4s, 16s, 64s) só em erro transitório. Erro 4xx não
   é retentado — é registrado.

**Error boundary por seção**, não por página: o gráfico de tráfego quebrar mostra
"não foi possível carregar este gráfico" com botão de repetir, e o resto do
painel continua de pé.

**Transações.** Toda operação com mais de uma escrita roda em transação. O
onboarding automático — 12 passos — é atômico: ou cria tudo, ou não cria nada.

**Idempotência.** Server Action recebe chave de idempotência; clicar duas vezes
em "Criar lead" cria um lead.

**Backup.** Neon com PITR de 30 dias (restaura para qualquer segundo). R2 com
versionamento. Dump semanal para bucket separado. E o teste que importa:
**restauração ensaiada trimestralmente em banco de staging** — backup que nunca
foi restaurado não é backup, é esperança.

---

## 13. Escalabilidade

O que a arquitetura já suporta sem reescrita:

| Eixo | Preparo |
|---|---|
| Múltiplas empresas | `organizacao_id` + RLS desde a migração 1 |
| Milhares de clientes | Índices compostos, cursor, virtualização |
| Milhões de mensagens | `wa_mensagens` particionada por mês (declarada, ativada quando o volume pedir) |
| Muitos arquivos | R2, upload direto, sem passar pelo servidor |
| App mobile | `packages/core` não conhece React — vira API REST/tRPC sem tocar em regra |
| Portal do cliente | Papel `cliente_externo` + escopo já cabem no modelo de permissão |
| BI | Réplica de leitura do Neon, sem impacto na produção |
| Novos módulos | Diretório novo + registro de permissões |

Quando um módulo pesar demais (o WhatsApp é o candidato natural), ele sai do
monólito para serviço próprio: já tem fronteira, fila e interface. É extração,
não reescrita.

---

## 14. Documentação e testes

`docs/mark-sistem/` — este conjunto, mais `instalacao.md`, `deploy.md`,
`variaveis.md`, `backup.md`, `integracoes.md` e um ADR por decisão relevante.

**Testes por camada, com foco em fluxo crítico:**

- **Unitário** (Vitest) — regras de negócio em `packages/core`. Alvo: 80% em
  financeiro e permissões, 60% no resto.
- **Integração** (Vitest + Postgres em Testcontainers) — DAL contra banco real,
  incluindo RLS. **Toda política de RLS tem teste que prova que ela nega.**
- **E2E** (Playwright) — os onze fluxos críticos do briefing: login, criar lead,
  mover pipeline, lead→cliente, criar demanda, trocar responsável, notificação,
  lançamento financeiro, permissão, revelar senha, upload.
- **Permissão** — matriz papel × rota gerada automaticamente. Rota nova sem
  entrada na matriz reprova o CI. É assim que a permissão não fica para trás.
- **Carga** (k6) antes do go-live: 50 usuários simultâneos, p95 < 500ms.

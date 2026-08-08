# 03 — Estrutura de pastas

Monorepo **pnpm workspaces + Turborepo**. Dois aplicativos, pacotes
compartilhados entre eles.

```
mark-sistem/
├── apps/
│   ├── web/                       Next.js 15 — Vercel
│   └── worker/                    Node sempre ligado — Railway/Fly
├── packages/
│   ├── db/                        Prisma: schema, migrations, cliente com tenant
│   ├── auth/                      sessão, permissões, can()
│   ├── domain/                    regras de negócio, por domínio
│   ├── data/                      funções de leitura (queries)
│   ├── integrations/              Meta, Google, WhatsApp, e-mail
│   ├── jobs/                      definição das filas e dos jobs
│   ├── ui/                        design system
│   └── core/                      utilitários sem dependência
├── docs/
├── scripts/
└── turbo.json  pnpm-workspace.yaml  .env.example
```

---

## `apps/web`

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/                       sem barra lateral
│   │   │   ├── login/page.tsx
│   │   │   ├── esqueci/page.tsx
│   │   │   └── convite/[token]/page.tsx
│   │   │
│   │   ├── (app)/                        com barra lateral — layout autenticado
│   │   │   ├── layout.tsx                resolve sessão + TenantContext
│   │   │   ├── page.tsx                  Painel Geral
│   │   │   │
│   │   │   ├── vendas/
│   │   │   │   ├── page.tsx              kanban
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── lead/[id]/page.tsx
│   │   │   │   ├── propostas/
│   │   │   │   ├── _components/          componentes só desta rota
│   │   │   │   └── _actions/             server actions só desta rota
│   │   │   │
│   │   │   ├── whatsapp/
│   │   │   │   ├── layout.tsx            lista de conversas persistente
│   │   │   │   └── [conversaId]/page.tsx
│   │   │   │
│   │   │   ├── clientes/[id]/
│   │   │   │   ├── layout.tsx            cabeçalho + abas do cliente
│   │   │   │   ├── page.tsx
│   │   │   │   ├── estrategia/  trafego/  acessos/  arquivos/  …
│   │   │   │
│   │   │   ├── demandas/  agenda/  aprovacoes/  arquivos/  wiki/  gestao/
│   │   │   │
│   │   │   ├── financeiro/
│   │   │   │   ├── layout.tsx            barreira de permissão do domínio
│   │   │   │   └── pessoal/layout.tsx    barreira extra: só o proprietário
│   │   │   │
│   │   │   └── configuracoes/
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── webhooks/
│   │   │   │   ├── whatsapp/route.ts     assinatura verificada, 200 imediato
│   │   │   │   └── meta/route.ts
│   │   │   ├── upload/route.ts           emite URL pré-assinada do R2
│   │   │   ├── busca/route.ts            ⌘K
│   │   │   └── saude/route.ts            diagnóstico (herdado do painel atual)
│   │   │
│   │   ├── globals.css
│   │   └── error.tsx  not-found.tsx  global-error.tsx
│   │
│   ├── components/                       compartilhados entre rotas
│   │   ├── layout/                       Sidebar, Topbar, CommandMenu
│   │   ├── kanban/                       quadro genérico, usado por vendas e demandas
│   │   ├── data-table/                   tabela genérica com filtro em URL
│   │   ├── forms/                        campos ligados ao React Hook Form
│   │   └── feedback/                     Skeleton, EmptyState, ErrorState
│   │
│   ├── hooks/
│   ├── lib/                              só cola específica do web
│   └── middleware.ts                     sessão + bloqueio de rota
└── next.config.mjs
```

**Duas convenções que valem a pena.** `_components/` e `_actions/` dentro da
rota: o underscore impede o Next de tratar como rota, e mantém junto o que muda
junto. Só sobe para `src/components/` o que for usado por dois módulos.

E os grupos `(auth)` / `(app)` existem para que o layout autenticado resolva
`TenantContext` **uma vez**, no `layout.tsx`, e todas as páginas abaixo herdem —
em vez de cada página resolver sessão por conta própria e alguém esquecer.

---

## `apps/worker`

```
apps/worker/
└── src/
    ├── index.ts                   sobe filas, cron e gateway
    ├── queues/
    │   ├── whatsapp-envio.ts      rate limit por número
    │   ├── whatsapp-recebimento.ts
    │   ├── meta-sync.ts           métricas diárias por conta
    │   ├── google-ads-sync.ts
    │   ├── notificacoes.ts
    │   ├── email.ts
    │   ├── outbox.ts              drena a tabela outbox
    │   └── manutencao.ts          purga da lixeira, rotação de chave
    ├── cron/
    │   ├── vencimentos.ts         03:00 — contas a vencer, prazos, follow-ups
    │   ├── recorrencias.ts        00:30 — gera lançamentos recorrentes
    │   ├── sync-diario.ts         05:00 — puxa métricas de ontem
    │   └── resumo-diario.ts       07:30 — e-mail do dia
    ├── realtime/
    │   ├── gateway.ts             WebSocket, autentica pelo cookie de sessão
    │   └── canais.ts              filtra evento por permissão antes de emitir
    └── whatsapp/
        ├── cloud-api.ts           adaptador oficial
        └── qr/                    adaptador não-oficial, isolado, opcional
```

O adaptador não-oficial mora numa pasta só dele, importado por
`import()` dinâmico atrás de flag. Se a decisão for não usá-lo, ele não é
carregado — e nada mais no sistema sabe que ele existe. Ver
[08](08-integracoes.md#whatsapp).

---

## `packages/`

### `db` — o banco e o tenant

```
packages/db/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                    org inicial + migração do DASH_USERS
└── src/
    ├── client.ts                  singleton Prisma
    ├── tenant.ts                  forTenant(ctx) — ver abaixo
    └── extensions/
        ├── tenant-scope.ts        injeta organization_id em toda query
        ├── soft-delete.ts         filtra deleted_at
        └── audit.ts               grava audit_logs nas mutações
```

`forTenant(ctx)` devolve um cliente Prisma estendido em que toda query já vem
com `organization_id` no `where` e todo insert já vem com ele no `data`. O
Prisma cru **não é exportado** do pacote — quem precisa dele importa
`unsafeGlobalClient` de um caminho separado, o que torna o uso visível em code
review e em `grep`. Ver [04](04-banco-de-dados.md#multi-tenant).

### `auth` — permissão em um lugar só

```
packages/auth/src/
├── session.ts              criar, ler, revogar
├── password.ts             Argon2id + verificador PBKDF2 legado
├── permissions.ts          catálogo de permissões (constantes)
├── roles.ts                papel → conjunto de permissões
├── can.ts                  can(actor, permissao, recurso?)
├── scope.ts                clientesVisiveis(actor) — predicado de query
└── step-up.ts              re-autenticação para senhas e financeiro pessoal
```

`can()` é a **única** função que decide permissão no sistema inteiro. Server
action, route handler, componente de servidor e worker chamam a mesma. A UI usa
`can()` para esconder; o servidor usa `can()` para negar. Testar permissão é
testar essa função.

### `domain` — regras, sem HTTP e sem React

```
packages/domain/src/
├── comercial/     lead.ts  proposta.ts  pipeline.ts  conversao.ts
├── operacao/      demanda.ts  agenda.ts  aprovacao.ts  tempo.ts
├── cliente/       cliente.ts  contrato.ts  estrategia.ts  onboarding.ts
├── financeiro/    lancamento.ts  recorrencia.ts  fluxo.ts  cobranca.ts
│                  └── public.ts   ← única porta de saída do domínio
├── trafego/       conta-anuncio.ts  metricas.ts
└── sistema/       notificacao.ts  auditoria.ts  busca.ts
```

`financeiro/public.ts` exporta um punhado de funções sem valor monetário
(`statusCobranca`, `temPendencia`, `diasDeAtraso`). É o **único** arquivo do
domínio financeiro que outros domínios podem importar; uma regra de ESLint
(`no-restricted-imports`) quebra o build se alguém importar outra coisa.

### `integrations` — tudo que fala com fora

```
packages/integrations/src/
├── meta/          ← src/lib/meta.ts de hoje, portado
├── google-ads/
├── google-calendar/
├── whatsapp/
│   ├── provider.ts        interface WhatsAppProvider
│   ├── cloud-api.ts       implementação oficial
│   └── tipos.ts
├── email/         Resend
└── storage/       R2, URLs pré-assinadas
```

Nenhum outro pacote importa `graph.facebook.com` ou o SDK do Resend. Quando a
Meta lançar a v22 e mudar um campo, o conserto é em um arquivo.

### `ui`, `core`, `data`, `jobs`

- **`ui`** — design system: primitivos shadcn adaptados, componentes compostos
  (`ClienteBadge`, `PrioridadeTag`, `MoneyInput`), tokens e formatação pt-BR.
- **`core`** — sem dependências: datas, período, `Result<T, E>`, `cents()`,
  slug, erros tipados.
- **`data`** — funções de leitura reaproveitadas por web e worker
  (`buscarPainelGeral`, `listarDemandas`), todas recebendo `TenantContext`.
- **`jobs`** — nomes de fila e tipos de payload, compartilhados: o `web`
  enfileira, o `worker` consome, e o tipo é o mesmo.

---

## Convenções

| Assunto | Regra |
|---|---|
| Idioma | **código, tabelas e colunas em português** — como já é hoje. Consistência vale mais que convenção anglófona |
| Arquivos | `kebab-case.ts`, componentes `PascalCase.tsx` |
| Banco | tabela plural `snake_case`; chave estrangeira `<entidade>_id` |
| Dinheiro | sempre `*_cents: BigInt`; nunca `Float` |
| Datas | `timestamptz`, UTC no banco, `America/Sao_Paulo` na exibição |
| IDs | `uuidv7` — ordenável no tempo, bom para índice, não vaza contagem |
| Imports | `@mark/db`, `@mark/auth`, `@mark/ui`… |
| Barril | proibido `index.ts` reexportando pasta inteira — mata tree-shaking |

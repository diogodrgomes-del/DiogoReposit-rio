# MARK SISTEM — Arquitetura

Documento de arquitetura do MARK SISTEM, o sistema operacional interno da
Agência Marktiva. Escrito antes de qualquer linha de código, para que as
decisões caras sejam tomadas uma vez só.

## Índice

| # | Documento | Responde |
|---|---|---|
| 01 | [Arquitetura geral](01-arquitetura-geral.md) | Como o sistema se divide em processos, por que, e qual stack |
| 02 | [Módulos e navegação](02-modulos-e-navegacao.md) | Os 17 módulos, o que cada um faz, como se navega entre eles |
| 03 | [Estrutura de pastas](03-estrutura-de-pastas.md) | Onde cada coisa mora no repositório |
| 04 | [Banco de dados](04-banco-de-dados.md) | Entidades, relacionamentos, índices, multi-tenant, auditoria |
| 05 | [Usuários e permissões](05-permissoes.md) | Papéis, permissões, escopo por cliente, isolamento do financeiro |
| 06 | [Segurança](06-seguranca.md) | Autenticação, cofre de senhas, uploads, LGPD, backup |
| 07 | [Desempenho](07-desempenho.md) | Metas de latência e como chegar nelas |
| 08 | [Integrações](08-integracoes.md) | Meta, Google, WhatsApp, e a camada que os desacopla |
| 09 | [Design system](09-design-system.md) | Cores, tipografia, espaçamento, componentes, estados |
| 10 | [Roadmap e MVP](10-roadmap-e-mvp.md) | Ordem de construção, o que entra e o que fica de fora |
| 11 | [Riscos técnicos](11-riscos.md) | O que pode dar errado e o que fazer a respeito |

---

## Sumário executivo

O MARK SISTEM é uma aplicação **Next.js 15 + PostgreSQL + Prisma**, dividida em
**dois processos** (um web serverless na Vercel, um worker sempre ligado) e
**multi-tenant desde a primeira migration**.

Onze decisões definem o projeto. Todas estão justificadas no documento
correspondente; aqui está o resumo e o motivo em uma linha.

| # | Decisão | Por quê | Onde |
|---|---|---|---|
| 1 | **O MARK SISTEM absorve este repositório**, não o substitui | `src/lib/meta.ts` já é um cliente maduro da Graph API; jogar fora custaria semanas e o conhecimento embutido nele não está escrito em lugar nenhum | [01](01-arquitetura-geral.md#decisão-1) |
| 2 | **Dois processos: `apps/web` (Vercel) + `apps/worker` (sempre ligado)** | WhatsApp, filas, WebSocket e cron não sobrevivem em serverless | [01](01-arquitetura-geral.md#decisão-2) |
| 3 | **Multi-tenant já na primeira migration**, não "preparado para" | Adicionar `organization_id` em 60 tabelas com dados dentro é a migração mais cara que existe. Agora custa uma coluna | [04](04-banco-de-dados.md#multi-tenant) |
| 4 | **Auth.js v5 com banco próprio**, não Clerk | Permissão por cliente exige que identidade e dados vivam no mesmo banco; e não se paga por usuário | [06](06-seguranca.md#autenticação) |
| 5 | **Financeiro é uma fronteira, não uma flag** | Schema separado, cliente Prisma separado, valores nunca entram no DTO de outro módulo | [05](05-permissoes.md#isolamento-do-financeiro) |
| 6 | **WhatsApp atrás de uma interface com dois adaptadores** | Cloud API oficial para campanhas; QR Code é risco de banimento permanente e fica isolado, opcional e desligado por padrão | [08](08-integracoes.md#whatsapp) |
| 7 | **Métricas de tráfego são gravadas, não só lidas** | O painel atual consulta a Meta a cada tela e não guarda nada — não dá para comparar mês a mês nem auditar o passado | [08](08-integracoes.md#meta-ads) |
| 8 | **Busca em PostgreSQL** (`unaccent` + `pg_trgm`), Meilisearch só depois | Português precisa de acento tolerante; Postgres resolve até ~1M linhas sem mais um serviço para manter | [07](07-desempenho.md#busca-global) |
| 9 | **Dinheiro em `BIGINT` de centavos**, sempre | `float` em dinheiro produz erro de arredondamento que aparece no fechamento do mês | [04](04-banco-de-dados.md#dinheiro) |
| 10 | **Arquivos no Cloudflare R2**, upload direto do navegador | Egress zero: uma agência move vídeo, e o egress da S3 é o que mata a conta | [06](06-seguranca.md#arquivos-e-uploads) |
| 11 | **O MVP são 6 módulos, não 17** | 17 módulos com uma equipe de 4 pessoas é como se abandona um projeto. Ver a proposta de corte | [10](10-roadmap-e-mvp.md) |

---

## Duas ressalvas ao pedido original

Registradas aqui porque são as duas únicas coisas do briefing com as quais eu
discordo tecnicamente. O resto está incorporado sem alteração.

**1. WhatsApp por QR Code conflita com o próprio briefing.** A seção 8.1 pede
conexão por QR Code; a 8.6 pede que nada seja feito de forma insegura que possa
causar bloqueio do número. As duas não coexistem: conectar por QR Code exige
biblioteca não-oficial, que viola os termos do WhatsApp e cujo desfecho comum é
banimento permanente do número — inclusive do número comercial da agência. A
arquitetura entrega as duas opções atrás da mesma interface, com a oficial como
padrão, e a decisão de ligar a não-oficial fica sua, explícita e reversível.
Detalhes e números em [08](08-integracoes.md#whatsapp) e [11](11-riscos.md#r1).

**2. Dezessete módulos é escopo de time grande.** O briefing pede uma plataforma
que substitui Trello, Notion, ClickUp, planilhas e agenda. Isso é possível — mas
não de uma vez. A proposta em [10](10-roadmap-e-mvp.md) entrega valor de uso
diário em ~10 semanas com 6 módulos, e trata os outros 11 como extensões
previstas na arquitetura, não como corte de escopo. Nenhuma decisão do MVP
impede qualquer um deles.

---

## Estado atual do repositório

O que existe hoje é o **Painel de Campanhas** da Marktiva: Next.js 15, React 19,
sem banco (opcionalmente Postgres para as anotações), autenticação por variável
de ambiente. Cerca de 4.700 linhas de TypeScript.

O que é aproveitado, o que muda e o que sai está em
[01 — Herança do painel atual](01-arquitetura-geral.md#herança-do-painel-atual).
Resumo: **`src/lib/meta.ts` e a disciplina de segredos são aproveitados quase
inteiros**; a autenticação por variável de ambiente e o armazenamento de tokens
em `META_TOKENS` são substituídos.

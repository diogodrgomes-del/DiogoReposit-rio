# MARK SISTEM

Sistema operacional interno da Agência Marktiva: comercial, clientes, produção,
agenda, financeiro e tráfego numa plataforma só.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL 16 ·
Prisma 6 · Tailwind 4

---

## Rodar em 5 minutos

Precisa de **Node 20+** e **PostgreSQL 16+**.

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL e DIRECT_URL
npm run db:deploy             # cria as tabelas
npm run db:seed               # organização, pipelines, listas e seu usuário
npm run dev                   # http://localhost:3000
```

O seed pergunta a senha do proprietário no terminal. Para criar dados de
exemplo (clientes, leads, demandas, lançamentos), rode com `SEED_EXEMPLOS=1`.

**Postgres local rápido, com Docker:**

```bash
docker run -d --name mark-db -p 5432:5432 \
  -e POSTGRES_USER=mark -e POSTGRES_PASSWORD=mark -e POSTGRES_DB=marksistem \
  postgres:16
# DATABASE_URL="postgresql://mark:mark@127.0.0.1:5432/marksistem"
```

---

## O que já funciona

| Módulo | Estado |
|---|---|
| **Autenticação** | login, sessão em banco (revogável), limite de tentativas, re-autenticação para áreas sensíveis |
| **Permissões** | 11 papéis, ~45 permissões, escopo por cliente, exceções caso a caso |
| **Painel Geral** | 12 indicadores agregados no banco, cada card leva à lista já filtrada |
| **CRM de Vendas** | pipeline kanban com arrastar e soltar, cadastro em 2 campos, ficha com salvamento automático, atividades, motivos de perda |
| **Onboarding** | lead ganho vira cliente + contrato + projeto + estratégia + primeira mensalidade, numa transação |
| **Clientes** | lista com filtros, ficha editável em linha, status, saúde, contrato, histórico |
| **Estratégias** | ficha por cliente com salvamento automático |
| **Demandas** | kanban, tipos, prioridades, checklist, comentários, filtros por cliente e responsável |
| **Agenda** | calendário mensal, eventos, gravações com status próprio, participantes |
| **Financeiro** | receitas, despesas, contas a pagar/receber, baixa total e parcial, dashboard |
| **Financeiro pessoal** | escopo separado, exclusivo do proprietário, com re-autenticação |
| **Notificações** | central com filtro por permissão na entrega |
| **Busca global** | ⌘K, sem acento, filtrada por permissão na consulta |
| **Auditoria** | histórico automático de toda ação relevante |
| **Tráfego** | painel de campanhas do Meta Ads (o sistema anterior, portado) |

**Ainda não construído:** WhatsApp, aprovações, arquivos, wiki, pesquisa,
comunicação interna, convite de usuários por e-mail. Ver
[roadmap](docs/arquitetura/10-roadmap-e-mvp.md).

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção (gera o Prisma Client antes) |
| `npm start` | servidor de produção |
| `npm run check` | verifica bytes de controle + typecheck |
| `npm run typecheck` | só o TypeScript |
| `npm run db:migrate` | cria uma migration nova a partir do schema |
| `npm run db:deploy` | aplica as migrations pendentes (produção) |
| `npm run db:seed` | popula organização, pipelines, listas e usuário |
| `npm run db:studio` | navegador visual do banco |
| `npm run db:reset` | **apaga tudo** e recria do zero |
| `node scripts/e2e.mjs` | verificação end-to-end no navegador (20 checagens) |

---

## Verificação

`scripts/e2e.mjs` sobe um Chromium e percorre os fluxos que quebram caro:
login, criação de lead, duplicata por telefone, conversão em cliente, demanda
com checklist e comentário, evento na agenda, lançamento e baixa financeira,
busca sem acento, e as barreiras de permissão.

```bash
npm run build && npm start &
node scripts/e2e.mjs http://localhost:3000
```

`npm run check` roda antes de qualquer commit. O verificador de bytes existe
porque um NUL invisível já entrou num literal de string uma vez, e o sintoma
apareceu longe da causa — a busca respondia 500 só para termos sem dígito,
enquanto TypeScript, lint e build passavam.

---

## Segurança

- Senhas em **PBKDF2-SHA256, 600 mil iterações**, sal por usuário, comparação em
  tempo constante. Contas migradas do painel antigo sobem para o padrão atual
  no primeiro login, sem ninguém trocar de senha.
- **Sessão em banco**, não JWT sem estado: dá para derrubar o acesso de alguém
  na hora.
- Toda escrita passa por `can()` **no servidor**. A interface esconde; o
  servidor nega.
- O escopo de cliente entra no `where` da consulta — o banco nunca devolve a
  linha de um cliente que a pessoa não pode ver.
- Área financeira responde **404** para quem não tem acesso, não 403: um 403
  confirma que a página existe.
- Auditoria de toda ação relevante, com campos sensíveis redigidos.

Detalhes em [docs/arquitetura/06-seguranca.md](docs/arquitetura/06-seguranca.md).

---

## Deploy

Ver [docs/deploy.md](docs/deploy.md). Resumo: Vercel + Postgres gerenciado
(Neon), `npm run db:deploy` na primeira subida, variáveis de ambiente conforme
`.env.example`.

---

## Arquitetura

O projeto foi desenhado antes de ser escrito. Os documentos em
[`docs/arquitetura/`](docs/arquitetura/README.md) explicam as decisões e o
motivo de cada uma — inclusive as que ainda não foram implementadas (WhatsApp,
worker separado, multi-tenant ativo).

Onde o código diverge do documento, e por quê:

| Documento | Implementado | Motivo |
|---|---|---|
| Auth.js v5 | autenticação própria (`jose` + PBKDF2) | não há login social por enquanto; Auth.js seria uma dependência a mais sem resolver nada que já não esteja resolvido. A troca continua barata: a interface é `getAtor()` |
| Argon2id | PBKDF2-SHA256 600k | Argon2 no Node exige binário nativo, causa número um de build quebrado em serverless. PBKDF2 pelo Web Crypto não tem dependência e atende ao OWASP |
| Monorepo, dois processos | app único | o worker só é necessário quando o WhatsApp entrar (fase 5). Dividir antes seria complexidade sem uso |
| Schemas separados no banco | schema único | o isolamento que vale é o do código (`financeiro/` só é alcançável pelas suas funções). Separar fisicamente vira hardening depois |
| `search_index` + tsvector | `sem_acento()` + trigrama nas tabelas | resolve bem nesta escala e não precisa manter índice sincronizado. A tabela dedicada entra quando o volume pedir |

---

## Scripts em Python

Na raiz há três utilitários avulsos, independentes do sistema, usados na análise
que originou o projeto: `verificar_meta.py`, `historico_meta.py` e
`metricas_gestao.py`. Todos leem o token de `META_ACCESS_TOKEN` e nunca o
imprimem.

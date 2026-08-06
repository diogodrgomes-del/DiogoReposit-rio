# Fase 0 — Fundação

O que foi construído, o que você precisa fazer, e as decisões tomadas no
caminho.

- [`00-arquitetura.md`](00-arquitetura.md) · [`01-modelagem.md`](01-modelagem.md) · [`02-roadmap.md`](02-roadmap.md)

---

## ⚠️ Duas coisas dependem de você

### 1. Vercel — Root Directory

O painel saiu da raiz do repositório e passou a viver em `apps/web`. **O deploy
atual quebra até você mudar isto:**

> Vercel → o projeto → Settings → General → **Root Directory** → `apps/web` → Save

Depois, um redeploy. Nada mais muda: as variáveis de ambiente continuam
valendo, o domínio continua o mesmo, e o painel volta exatamente como estava.

Se preferir conferir antes, use um deploy de preview desta branch.

### 2. Banco de dados

O sistema precisa de um Postgres. Na Vercel: **Storage → Create → Neon**, e a
`DATABASE_URL` entra sozinha no projeto. Depois, localmente:

```bash
npm install
npm run db:migrar    # cria as tabelas e liga a RLS
npm run db:semear    # organização, papéis e o seu usuário
```

O seed pergunta a senha sem exibi-la. Mínimo de 12 caracteres — este usuário
enxerga o financeiro pessoal e as senhas de todos os clientes.

---

## O que existe agora

```
mark-sistem/
├── apps/
│   ├── web/          o painel de campanhas, como estava
│   └── worker/       processo persistente: health + limpeza de sessões
├── packages/
│   ├── core/         permissões — sem React, sem Next, sem banco
│   ├── db/           esquema, migrações, RLS, seed
│   └── auth/         argon2id, sessões, montagem do contexto
├── testes/           fronteiras do monorepo
└── .github/workflows/ci.yml
```

**58 testes**, dos quais 13 rodam contra um Postgres real no CI.

| Peça | Estado |
|---|---|
| Monorepo (npm workspaces) | pronto |
| Migração 0001 — núcleo | pronta |
| Migração 0002 — RLS | pronta |
| `pode()` / `exigir()` | pronto, 23 testes |
| Argon2id + PBKDF2 herdado | pronto, 13 testes |
| Sessões em banco, revogáveis | pronto |
| Seed idempotente | pronto |
| Worker | health + limpeza de sessões |
| CI | lint, tipos, testes com Postgres, build |

---

## Decisões tomadas nesta fase

### npm workspaces, não pnpm

A arquitetura previa pnpm. O repositório já usava npm, e npm workspaces dá
conta deste tamanho. Trocar de gerenciador de pacotes é uma migração inteira
para ganhar disco — não vale o risco no mesmo commit que reestrutura o repo.
Se o monorepo crescer a ponto de doer, a troca continua possível.

### Migrações em SQL escrito à mão, não `drizzle-kit generate`

Detalhado em [`packages/db/migracoes/README.md`](../../packages/db/migracoes/README.md).
Resumo: quatro coisas que este banco precisa — políticas de RLS com subconsulta,
`FORCE ROW LEVEL SECURITY`, particionamento por intervalo e índices parciais —
o gerador não modela. Gerar e emendar à mão dá o pior dos dois mundos.

### `@node-rs/argon2` e `node:crypto`, não WebCrypto

O `@mark/auth` depende de um módulo nativo, então fingir que roda em Edge seria
ficção. A verificação do PBKDF2 herdado passou a usar `node:crypto`, que é mais
rápido e dispensa arrastar as tipagens de DOM para dentro do worker.

### Quem é o proprietário

O seed grava `organizacoes.proprietario_id`. É a **única** origem do acesso ao
financeiro pessoal — não existe papel que conceda. Você define isso ao
responder o e-mail no `npm run db:semear`.

Para transferir depois, é um `UPDATE` nessa coluna. Nenhuma tela vai oferecer
isso, de propósito.

---

## Três coisas que quase passaram despercebidas

Registradas porque cada uma teria virado incidente meses depois.

### 1. A RLS não valeria para a própria aplicação

Row Level Security é ignorada para o **dono da tabela** — que é exatamente como
a aplicação conecta em Postgres gerenciado. Sem `FORCE ROW LEVEL SECURITY`,
todas as políticas existiriam, todo teste de caminho feliz passaria, e o
isolamento entre organizações seria decorativo.

Agora toda tabela leva `FORCE`, e o primeiro teste do arquivo de RLS confere que
a conexão **não** é superusuário nem tem `BYPASSRLS` — porque se fosse, os
outros doze testes passariam sem provar nada.

### 2. O login não passaria pela própria RLS

Para achar a sessão pelo token ainda não se sabe o usuário; para achar o usuário
pelo e-mail ainda não se sabe a organização. Com as políticas ligadas, ninguém
conseguiria entrar.

Solução: `app_autenticando()`, uma válvula que **só** `usuarios` e `sessoes`
mencionam. Toda outra tabela permanece fechada mesmo com ela ligada, e quem a
liga é apenas o `@mark/auth`, em duas funções.

### 3. O lint de fronteira estava desligado sem avisar

`no-restricted-imports` não acumula entre blocos do ESLint: um bloco posterior
que case com o mesmo arquivo substitui o anterior por inteiro. A regra que
proibia `@mark/core` de importar banco existia, o lint passava verde, e ela não
protegia nada.

Corrigido, e agora `testes/fronteiras.test.ts` roda o ESLint de verdade sobre
código inventado e exige que ele reprove. Regra que ninguém viu reprovando não
conta como regra.

---

## Segurança de dependências

O `npm audit` apontou duas coisas que foram tratadas e duas que ficam
registradas:

**Tratadas**

- `drizzle-orm` < 0.45.2 tem SQL injection por escape incorreto de
  identificadores ([GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9)).
  Subiu para 0.45.2. Isto é a camada de dados inteira — não era negociável.
- `eslint-plugin-boundaries` arrastava um `handlebars` com injeção de JavaScript
  (crítico). O plugin saiu; a mesma fronteira ficou com `no-restricted-imports`,
  que é nativo e não tem dependência nenhuma.

**Registradas, sem correção agora**

- `postcss` e `sharp`, ambos transitivos do Next 15. Não existe 15.x corrigido —
  o conserto é Next 16, uma major. Subir major no mesmo commit que reestrutura
  o repositório tornaria qualquer quebra impossível de atribuir. **Fica como
  primeira tarefa da fase 1**, quando o `apps/web` for mexido de qualquer jeito.
- Exposição real hoje: baixa. A falha do `postcss` depende de CSS de origem
  não confiável passando pelo compilador, e todo o CSS deste projeto é nosso.

O CI reprova em vulnerabilidade **crítica**. `high` fica como aviso até o Next
16 entrar.

---

## Comandos

```bash
npm install
npm run dev          # painel em http://localhost:3000
npm run worker       # worker em http://localhost:8080/saude

npm run db:migrar    # aplica migrações pendentes (idempotente)
npm run db:semear    # organização, papéis, proprietário (idempotente)

npm run lint
npm run tipos
npm run teste        # RLS é pulado sem DATABASE_URL
npm run build
```

Para rodar os testes de RLS localmente, aponte `DATABASE_URL` para um Postgres
de descarte. Use um papel que **não** seja superusuário, senão os testes de
isolamento passam sem testar nada:

```sql
CREATE ROLE mark LOGIN PASSWORD 'mark';
CREATE DATABASE mark OWNER mark;
```

---

## Próximo: Fase 1

1. Next 15 → 16 (resolve `postcss` e `sharp`)
2. Login pelo banco, substituindo `DASH_USERS`
3. Casca da aplicação: barra lateral, tema, ⌘K, notificações
4. Migração 0003: `contatos`, `clientes`, `etiquetas`, `vinculos` — e a FK que
   falta em `membro_escopos.cliente_id`
5. Importação do `META_TOKENS` para `clientes` + `credenciais` cifradas
6. Painel de tráfego lendo do banco, alimentado pelo worker

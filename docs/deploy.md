# Deploy

Vercel para o app, Postgres gerenciado para o banco. Passo a passo, do zero.

---

## 1. Banco

Qualquer PostgreSQL 16+ serve. O caminho mais curto é o **Neon**, que a Vercel
provisiona sem sair do painel.

Na Vercel: **Storage → Create Database → Neon**. As variáveis `DATABASE_URL` e
`DATABASE_URL_UNPOOLED` entram sozinhas no projeto.

Cadastre `DIRECT_URL` com o valor de `DATABASE_URL_UNPOOLED`.

**Por que duas URLs.** O app roda em função serverless e abre conexão a cada
invocação — precisa do pooler, senão um pico esgota as conexões do Postgres e o
sistema inteiro cai com "too many connections". Já as migrations precisam de
conexão direta: PgBouncer em modo transação não suporta os comandos que o Prisma
Migrate emite. Sem pooler, repita o mesmo valor nas duas.

---

## 2. Variáveis de ambiente

Em **Settings → Environment Variables**, marcando Production, Preview e
Development. A lista completa está em `.env.example`.

| Variável | Obrigatória | O que é |
|---|---|---|
| `DATABASE_URL` | sim | Postgres, com pooler |
| `DIRECT_URL` | sim | Postgres, sem pooler (migrations) |
| `CREDENTIALS_MASTER_KEY` | para o cofre | 32 bytes em base64 |
| `META_TOKENS` | para o tráfego | um cliente por linha, `Nome = TOKEN` |
| `META_IMPOSTO` | não | alíquota sobre a verba |
| `SEED_EMAIL` / `SEED_NOME` / `SEED_SENHA` | só no primeiro seed | proprietário inicial |
| `DASH_USERS` | só migrando do painel antigo | contas antigas, hash preservado |

Gerar a chave mestra:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**A chave mestra é irrecuperável.** Perdida, as senhas guardadas no módulo
Senhas não voltam — nem do backup, que guarda só texto cifrado. Guarde cópia em
pelo menos dois lugares fora do servidor.

---

## 3. Primeira subida

```bash
git push -u origin <sua-branch>
```

Importe o repositório em [vercel.com/new](https://vercel.com/new). A Vercel
detecta Next.js sozinha — não precisa configurar Root Directory nem build
command. O `npm run build` já roda `prisma generate` antes do `next build`.

Depois do primeiro deploy, com as variáveis apontando para o banco de produção:

```bash
npm run db:deploy    # cria as tabelas
npm run db:seed      # organização, pipelines, listas e o proprietário
```

Rode os dois **da sua máquina**, com `DATABASE_URL` e `DIRECT_URL` de produção
no `.env`. São os únicos comandos que não devem rodar automaticamente no build:
migration disparada por deploy é como se apaga produção sem querer.

---

## 4. Deploys seguintes

Cada `git push` na branch dispara um deploy. Quando a mudança inclui migration:

```bash
npm run db:deploy    # antes de o novo código entrar no ar
git push
```

Nessa ordem, e não na inversa: o código novo pode depender de coluna que ainda
não existe.

### Migration destrutiva

Renomear coluna, mudar tipo ou adicionar `NOT NULL` numa tabela com dados exige
**duas etapas**, porque o deploy não é atômico e há um intervalo em que código
velho e schema novo convivem:

1. adiciona a coluna nova, deploy que escreve nas duas;
2. deploy que lê só da nova;
3. migration que remove a antiga.

Teste antes numa branch do Neon com cópia dos dados de produção — é instantâneo
e não custa nada.

---

## 5. Backup

O Neon mantém PITR (point-in-time recovery) de 7 dias no plano pago. Isso cobre
"a migration deu errado" e "apaguei sem querei".

Não cobre "perdi a conta do provedor". Para isso, dump lógico semanal:

```bash
pg_dump "$DIRECT_URL" --format=custom --file=mark-$(date +%F).dump
```

**Restauração é testada, não presumida.** A cada trimestre: restaure o dump mais
recente num banco descartável, aponte o app para ele, confira as contagens e
**descriptografe uma credencial de teste** — é o que prova que a chave mestra
guardada é a chave certa.

```bash
createdb mark_teste
pg_restore -d mark_teste mark-2026-08-08.dump
```

---

## 6. Depois de subir

Confira, nesta ordem:

1. `/login` abre e o login funciona.
2. `/` mostra os indicadores.
3. Crie um lead, mova no pipeline, converta em cliente.
4. Entre com um usuário sem permissão financeira e confirme que `/financeiro`
   responde 404.
5. `node scripts/e2e.mjs https://seu-dominio` — as 20 checagens contra o
   ambiente real.

O passo 4 é o que costuma passar despercebido e é o mais caro de descobrir tarde.

---

## Alternativa sem Vercel

O app é um Next.js comum e roda em qualquer lugar que execute Node 20:

```bash
npm ci
npm run build
npm run db:deploy
npm start        # porta 3000
```

Atrás de um proxy reverso com TLS. Um VPS pequeno dá conta com folga — perde-se
preview por branch e rollback de um clique, que é a troca a considerar.

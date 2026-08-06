# MARK SISTEM

Plataforma operacional da Agência Marktiva. Começou como painel de campanhas do
Meta Ads e está virando o sistema que administra a empresa inteira.

> 📄 **Comece por [`ENTREGA.md`](ENTREGA.md)** — o que fazer para subir, o que
> existe, e as decisões que valem discussão.

**Onde está:** painel geral, CRM de vendas, clientes, tráfego, cofre e busca
global funcionando. Financeiro, WhatsApp e operacional ainda não existem —
estão desenhados em `docs/mark-sistem/`.

- [`docs/mark-sistem/00-arquitetura.md`](docs/mark-sistem/00-arquitetura.md) — arquitetura, infraestrutura, segurança
- [`docs/mark-sistem/01-modelagem.md`](docs/mark-sistem/01-modelagem.md) — banco de dados e permissões
- [`docs/mark-sistem/02-roadmap.md`](docs/mark-sistem/02-roadmap.md) — riscos, fases, MVP
- [`docs/mark-sistem/03-fase-0.md`](docs/mark-sistem/03-fase-0.md) — fundação
- [`docs/mark-sistem/04-fase-1.md`](docs/mark-sistem/04-fase-1.md) — **o que fazer agora**
- [`docs/mark-sistem/05-fase-2.md`](docs/mark-sistem/05-fase-2.md) — CRM de vendas

> ⚠️ **Quem faz deploy na Vercel:** o painel saiu da raiz e foi para `apps/web`.
> Ajuste **Settings → General → Root Directory → `apps/web`** ou o próximo deploy
> falha. Detalhes em [`03-fase-0.md`](docs/mark-sistem/03-fase-0.md).

```
apps/web/       painel + sistema (Next 16)   packages/core/         regras e permissões
apps/worker/    sync, limpeza, cron          packages/db/           esquema, RLS, seed
                                             packages/auth/         senha e sessão
                                             packages/cofre/        cifra de segredos
                                             packages/integracoes/  Meta Ads
```

```bash
npm install
npm run dev        # painel
npm run db:migrar  # banco
npm run teste      # 147 testes
```

---

## Painel de Campanhas

Painel web das campanhas do Meta Ads para uma carteira de clientes, com login,
filtros de período iguais aos do Gerenciador de Anúncios, atualização automática
e exportação em PDF.

A métrica central é **conversa iniciada por mensagem** e o **custo por conversa** —
o que decide para onde vai a verba. Cliques e impressões aparecem como apoio.

---

## O que tem

- **Duas visões**: carteira (todos os clientes lado a lado, do custo por conversa
  mais baixo ao mais alto) e cliente (o painel completo de um deles).
- **Login por e-mail (MARK SISTEM) ou usuário (legado)**, em cookie `HttpOnly` de 12 h.
- **Períodos**: hoje, ontem, 7 / 14 / 28 / 30 / 90 dias, este mês, mês passado,
  este ano, máximo e intervalo personalizado.
- **Seletor de cliente e de conta**: cada cliente tem token próprio, e o painel
  descobre sozinho as contas atribuídas a cada um. Atribuiu uma conta nova no
  Business Manager? Ela aparece sem mexer no código.
- **Atualização automática** a cada 60 s, com botão para desligar.
- **PDF** pelo botão “Gerar PDF”, com layout próprio de impressão.
- **Tema claro e escuro**, acompanhando o sistema, com alternância manual.
- Paleta validada para daltonismo (deuteranopia, protanopia e tritanopia).

---

## Subir na Vercel

### 1. Enviar para o GitHub

```bash
git push -u origin <sua-branch>
```

### 2. Importar na Vercel

Em [vercel.com/new](https://vercel.com/new), importe o repositório.

Em **Settings → General**, defina **Root Directory** como `apps/web`. Isto é
obrigatório desde que o projeto virou monorepo — sem isso a Vercel procura o
Next.js na raiz e o build falha.

### 3. Cadastrar as variáveis de ambiente

Em **Settings → Environment Variables**, marcando Production, Preview e
Development nas três:

| Variável | O que é |
|---|---|
| `DATABASE_URL` | Postgres do sistema. Em **Storage → Create → Neon** ela entra sozinha |
| `COFRE_KEKS` | Chave mestra que cifra tokens e senhas. **Guarde cópia offline** |
| `META_TOKENS` | Um cliente por linha: `Nome = TOKEN`. Sai de cena após a importação |
| `SESSION_SECRET` | Assina a sessão do modo legado (mínimo 32 caracteres) |
| `DASH_USERS` | Usuários do painel antigo. Sai de cena quando todos migrarem |

Gerar a chave do cofre:

```bash
node -e "console.log('1:' + require('crypto').randomBytes(32).toString('base64url'))"
```

Perder essa chave torna todas as senhas guardadas irrecuperáveis. Ver
[`ENTREGA.md`](ENTREGA.md).

**Formato do `META_TOKENS`** — cole tudo num campo só; a Vercel aceita várias
linhas:

```
Marktiva = EAAaAQyGYHBU...
Bom pra home = EAAZCj6Mbo0E...
Casa Carvalho = EAAbxTAZA1Mf...
Óticas Gouveia = EAATuJuhHKOc...
```

O nome pode ter acento e espaço — é o que aparece na tela. O identificador usado
na URL é derivado dele sem acentos (`Óticas Gouveia` → `oticas-gouveia`).

**Gerar o `SESSION_SECRET`:**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Gerar cada usuário:**

```bash
npm run senha -- diogo
```

O comando pede a senha sem exibi-la e devolve uma linha pronta. Para mais de um
usuário, junte as linhas com vírgula:

```
DASH_USERS=diogo:pbkdf2.210000.xxx.yyy,equipe:pbkdf2.210000.aaa.bbb
```

A senha em si nunca é guardada — só o hash PBKDF2-SHA256 com 210 mil iterações e
sal aleatório por usuário.

### 4. Deploy

Clique em Deploy. Cada `git push` na branch dispara um deploy novo.

---

## Rodar no seu computador

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # preencha as três variáveis
npm run dev                                    # http://localhost:3000
```

---

## Onde o token fica

Os tokens são lidos **apenas no servidor**, dentro das rotas de API. Nenhum é
enviado ao navegador, nenhum aparece no JavaScript da página, e todos são removidos
das mensagens de erro antes de virarem log.

A rota `/api/clientes` devolve só `id` e `nome` de cada cliente — nunca o token.
É isso que permite o seletor de clientes existir no navegador sem expor nada.

Por isso nenhuma variável usa o prefixo `NEXT_PUBLIC_` — esse prefixo publicaria o
valor no pacote que vai para o navegador.

O middleware barra toda rota que não seja `/login`, e cada rota confere a sessão
outra vez por conta própria — passar no middleware nunca é o que autoriza.

---

## Sobre “tempo real”

Os dados vêm da Graph API a cada consulta, sem cache. Mas a Meta não é instantânea:
métricas de entrega costumam levar alguns minutos para consolidar, e conversas
iniciadas usam janela de atribuição de 7 dias. Os números de hoje ainda vão subir
ao longo do dia — isso é comportamento da plataforma, igual ao Gerenciador.

### Uma ressalva sobre o painel de profundidade

“Conversa iniciada” (`messaging_conversation_started_7d`) tem janela de atribuição
de 7 dias. As métricas de profundidade (1ª resposta, 2ª, 3ª e 5ª mensagem) não têm
janela: contam eventos ocorridos no período, inclusive de conversas iniciadas
antes dele.

Como as bases de contagem são diferentes, **não formam um funil** — em períodos
curtos a “5ª mensagem” pode passar do total de conversas iniciadas. Por isso o
painel mostra números absolutos, com as barras escaladas pelo maior valor, e não
percentuais encaixados.

---

## Gerar o PDF

O botão “Gerar PDF” abre a impressão do navegador com um layout dedicado: sem
menus nem filtros, tema claro, indicadores em linha única, tabela inteira sem
rolagem e quebra de página antes da lista de campanhas.

Escolha **Salvar como PDF** no destino. O texto sai vetorial — selecionável e
nítido em qualquer zoom.

- **iPhone / iPad**: botão de compartilhar → Imprimir → pinçar para abrir → compartilhar → Salvar em Arquivos.
- **Android**: menu do Chrome → Compartilhar → Imprimir → Salvar como PDF.
- **Computador**: a caixa de impressão já abre; escolha “Salvar como PDF”.

Marque “Gráficos de segundo plano” nas opções de impressão para as cores saírem.

---

## Se algo der errado

**“Nenhuma conta de anúncios acessível por este token”** — o token é válido, mas
nenhuma conta foi atribuída ao usuário do sistema. No Business Manager:
Configurações do Negócio → Usuários do sistema → selecione o usuário → Adicionar
ativos → Contas de anúncios → permissão **Ver desempenho**.

**“Servidor sem configuração de acesso”** — falta `DASH_USERS` ou `SESSION_SECRET`
na Vercel. Depois de cadastrar, faça um redeploy: variáveis novas só valem no
próximo build.

**Login sempre recusado, com as variáveis certas** — confira se o valor de
`DASH_USERS` foi colado inteiro. O hash não contém `$` justamente para sobreviver
a ferramentas que expandem variáveis, mas um copiar-e-colar truncado quebra do
mesmo jeito.

---

## Scripts em Python

Na raiz há três utilitários avulsos, independentes do painel, usados para a
análise que originou este projeto:

| Arquivo | Para quê |
|---|---|
| `verificar_meta.py` | Testa o token e lista as contas acessíveis |
| `historico_meta.py` | Exporta o histórico completo em CSV |
| `metricas_gestao.py` | Exporta o funil de mensagens e o custo por conversa |

Todos leem o token de `META_ACCESS_TOKEN` (um cliente por vez) e nunca o imprimem.

---

## Stack

**Painel** — Next.js 15 (App Router) · React 19 · TypeScript · Recharts · jose

**Sistema** — Drizzle · PostgreSQL com RLS · Argon2id · Vitest · ESLint

O painel ainda lê a Graph API a cada requisição, sem guardar nada, e para um
cliente por vez isso está certo. Não escala para a carteira inteira: são vinte
chamadas sequenciais a uma API de terceiro com limite de taxa, e uma queda da
Meta derruba a tela.

Na fase 1 o worker passa a sincronizar as métricas para o banco e o painel passa
a ler de lá — mais rápido, funciona com a Meta fora do ar, e o histórico deixa
de depender dos 37 meses que a Meta guarda. Os tokens saem das variáveis de
ambiente e vão cifrados para `credenciais`.

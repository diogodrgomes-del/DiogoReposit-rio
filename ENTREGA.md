# MARK SISTEM — Entrega

Diogo, este é o documento para ler primeiro. Ele diz **o que fazer para o
sistema subir**, o que já existe, o que ainda não existe, e as decisões que
valem discussão quando revisarmos juntos.

---

## Parte 1 — Colocar no ar

São cinco passos. O terceiro é o único irreversível se der errado, e está
marcado.

### 1. Vercel — Root Directory

O painel saiu da raiz do repositório e foi para `apps/web`. **O próximo deploy
falha até você mudar isto:**

> Vercel → o projeto → **Settings → General → Root Directory** → `apps/web` → Save

Depois, um redeploy. Variáveis de ambiente, domínio e tudo o mais continuam
valendo.

### 2. Criar o banco

Vercel → **Storage → Create → Neon**. A `DATABASE_URL` entra sozinha no projeto.

Qualquer Postgres 15 ou superior serve. Só há uma exigência: o papel de conexão
**não pode ser superusuário nem ter `BYPASSRLS`** — os dois ignoram Row Level
Security e o isolamento entre organizações vira enfeite. O papel padrão da Neon
já atende.

### 3. ⚠️ Gerar a chave do cofre

```bash
node -e "console.log('1:' + require('crypto').randomBytes(32).toString('base64url'))"
```

Cadastre o resultado na Vercel como `COFRE_KEKS`.

**Guarde uma cópia offline antes de continuar.** Essa chave cifra os tokens da
Meta e, mais adiante, as senhas de todas as plataformas dos clientes. Perdê-la
torna tudo isso irrecuperável — não há como reconstruir a partir do banco. É
essa a diferença entre um cofre e uma gaveta.

Se a chave vazar, dá para rotacionar sem parar o sistema: o formato é
`versao:chave,versao:chave`, a nova cifra e as antigas ainda decifram.

### 4. Migrar, semear, importar

Com `DATABASE_URL` e `COFRE_KEKS` no `.env.local`:

```bash
npm install
npm run db:migrar             # 7 migrações
npm run db:semear             # organização, papéis e você como proprietário
npm run db:importar-meta      # clientes e tokens saem do .env e vão cifrados
npm run db:descobrir-contas   # registra as contas de anúncio de cada token
```

O seed pergunta seu e-mail e sua senha (mínimo 12 caracteres, pedida sem
aparecer na tela). O e-mail que você responder vira o **proprietário** — a única
identidade que enxerga o financeiro pessoal, quando ele existir.

Os quatro comandos são idempotentes: rodar de novo não duplica nada. Reimportar
**atualiza** o token de quem já existe, que é o que se quer quando um token
expira.

### 5. Subir o worker

O sync do Meta Ads não roda na Vercel — função serverless morre em segundos, e
o sync é um processo que precisa acordar a cada 30 minutos.

```bash
fly launch --no-deploy --copy-config --config apps/worker/fly.toml
fly secrets set DATABASE_URL="..." COFRE_KEKS="..."
fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile
```

Sem o worker, tudo funciona menos a sincronização — o painel de campanhas segue
lendo a Meta ao vivo, como sempre fez.

### Conferir

Abra `/api/saude`. Ele responde sem login, de propósito: é a tela que se usa
justamente quando o login não funciona.

- `modoDeLogin` — diz se o banco já está valendo
- `migracoesAplicadas` — deve ser 7
- `cofreConfigurado` — deve ser `true`
- `pendencias` — lista o que falta, em português

Depois entre com **e-mail e senha**. O campo aceita os dois formatos; o servidor
decide.

---

## Parte 2 — O que existe

| Módulo | Estado |
|---|---|
| **Painel Geral** | Indicadores clicáveis, lista do que precisa de atenção hoje |
| **CRM de Vendas** | Quadro Kanban com arrastar, cadastro rápido, ficha, motivo de perda |
| **Onboarding** | Lead vira cliente sem perder histórico |
| **Clientes** | Lista com busca e filtros, ficha, linha do tempo, lixeira |
| **Gestão de Tráfego** | Sync do Meta Ads a cada 30 min, contas, série diária |
| **Cofre** | Tokens e senhas cifrados, auditoria imutável de cada revelação |
| **Busca global** | ⌘K, tolerante a erro de escrita, respeita permissão |
| **Equipe** | Leitura de quem é quem e com qual papel |
| **Autenticação** | E-mail e senha, sessão revogável, papéis e escopos |

**147 testes** — 122 rodam em qualquer lugar, 25 exigem Postgres e rodam no CI
contra um banco de verdade, com papel sem `BYPASSRLS`.

`npm audit`: **0 vulnerabilidades**.

### O que ainda não existe

Financeiro, WhatsApp, operacional (demandas), agenda, aprovações, estratégia,
pesquisa, Wiki e mural. Todos estão desenhados em
[`docs/mark-sistem/`](docs/mark-sistem/), com modelagem e ordem de construção.

Duas coisas ficaram com tabela e índice prontos, mas sem tela: **atividades**
(follow-ups) e **propostas**. São o próximo passo natural do comercial.

---

## Parte 3 — As decisões que mudam tudo

Cinco escolhas estruturais. Se alguma delas estiver errada, é melhor descobrir
agora do que na fase 5.

### 1. O contato é a espinha dorsal

Lead e cliente **não guardam nome e telefone**. Os dois apontam para o mesmo
`contato`, casado por telefone normalizado em E.164, único por organização.

Parece detalhe e não é. Quando um lead vira cliente, nada é copiado — o mesmo
contato passa a responder pelas duas fichas. Consequência prática: a conversa de
WhatsApp daquela pessoa não muda de dono no momento em que ela assina. Com nome
e telefone duplicados no lead, esse histórico se partiria em dois exatamente
quando passa a valer mais.

É também o que vai fazer o WhatsApp funcionar na fase 5: mensagem chega,
telefone normaliza, contato aparece com a ficha certa ao lado.

### 2. A autorização mora na camada de dados

Sistema com financeiro restrito não vaza por invasão — vaza pela rota nova que
alguém escreveu sem lembrar de checar. Toda leitura e escrita passa por funções
em `packages/core` que começam com `exigir()`. Uma rota que não passe por lá
simplesmente não tem como ler o dado.

E o banco é a segunda parede: Row Level Security em todas as tabelas, com
`FORCE` — sem ele a RLS seria ignorada para o dono da tabela, que é exatamente
como a aplicação conecta.

### 3. A tela lê o banco, não a Graph API

O painel atual consulta a Meta a cada requisição. Para um cliente por vez está
certo. Para a carteira inteira são vinte chamadas sequenciais a uma API de
terceiro com limite de taxa — oito a quinze segundos, e uma queda da Meta
derruba a tela.

O worker sincroniza; a tela lê o banco. Ganho colateral: o histórico passa a ser
seu, porque a Meta só devolve 37 meses.

### 4. WhatsApp por Cloud API, não por QR Code

Você pediu QR Code. Preciso repetir o preço, porque é a decisão mais cara do
projeto: QR Code usa biblioteca não oficial, a Meta detecta, e o banimento é
permanente — leva o número comercial junto.

A arquitetura suporta os dois, atrás da mesma interface. Mas a proteção está no
esquema, não num aviso de tela: `wa_campanhas.modelo` é `NOT NULL`, então o
banco recusa campanha sem template aprovado.

**Decisão que precisa de você:** migrar um número existente para a Cloud API o
tira do aplicativo do celular. Minha recomendação é comprar números novos para
os fluxos automatizados e manter os atuais no celular — zero interrupção.

### 5. Os dois modos de login convivem

Sem `DATABASE_URL`, o painel funciona exatamente como antes. Não é indecisão: um
deploy que exigisse banco no mesmo instante deixaria a equipe sem painel até
alguém terminar de configurar o Neon.

O modo legado abre **só o painel de campanhas**. Nenhum módulo do sistema entra
sem contexto de verdade — sem organização e sem papel não há como decidir
permissão, e chutar seria pior do que recusar.

Quando toda a equipe estiver no banco, `DASH_USERS` e `META_TOKENS` saem.

---

## Parte 4 — Onde as coisas estão

```
apps/web/            painel + módulos do sistema (Next.js 16)
  src/app/(sistema)/ telas do MARK SISTEM, com a casca
  src/modulos/       componentes e Server Actions por módulo
apps/worker/         processo persistente: sync, limpeza, cron

packages/core/       REGRA DE NEGÓCIO — permissões, clientes, leads, painel
  /navegador         entrada segura para componentes de cliente
packages/db/         esquema, migrações SQL, RLS, seed, CLIs
packages/auth/       argon2id, sessão, montagem do contexto
packages/cofre/      cifra envelopada de segredos
packages/integracoes/ Meta Ads (e, depois, WhatsApp e Google)

docs/mark-sistem/    arquitetura, modelagem, roadmap e o diário de cada fase
```

**A regra que sustenta a estrutura:** `packages/core` não conhece React, Next
nem sessão. Recebe um `Contexto` por parâmetro. É isso que permite a mesma regra
rodar na web, no worker, num script e — quando existir — num app mobile, sem
reescrever autorização. O lint aplica; `testes/fronteiras.test.ts` prova que o
lint está ligado.

### Comandos

```bash
npm run dev          # painel em localhost:3000
npm run worker       # worker em localhost:8080/saude
npm run teste        # 147 testes
npm run tipos        # TypeScript
npm run lint
npm run build

npm run db:migrar    npm run db:semear
npm run db:importar-meta    npm run db:descobrir-contas
```

---

## Parte 5 — Coisas que quase viraram incidente

Registradas porque cada uma teria aparecido meses depois, e porque explicam
decisões que de outro modo pareceriam arbitrárias.

**A RLS não valeria para a própria aplicação.** Row Level Security é ignorada
para o dono da tabela — que é como se conecta em Postgres gerenciado. Sem
`FORCE ROW LEVEL SECURITY`, todas as políticas existiriam, todo teste de caminho
feliz passaria, e o isolamento seria decorativo. O primeiro teste do arquivo de
RLS confere que a conexão não é superusuário; se fosse, os outros doze passariam
sem provar nada.

**O login não passaria pela própria RLS.** Duas vezes: primeiro para achar a
sessão pelo token sem saber o usuário, depois para achar a organização sem saber
a organização. As saídas foram válvulas estreitas — uma que só `usuarios` e
`sessoes` reconhecem, e uma cláusula que deixa cada um ver a própria filiação.

**O lint de fronteira estava desligado em silêncio.** `no-restricted-imports` não
acumula entre blocos do ESLint: um bloco posterior apagava o anterior. A regra
existia, o lint passava verde, e não protegia nada. Só apareceu porque testei se
ela realmente reprovava.

**Um import quebrou o navegador.** O quadro Kanban importava uma função do
`@mark/core`, que reexporta as regras de negócio — e um único import de valor
arrastou o driver do Postgres para o pacote do cliente. Daí
`@mark/core/navegador`, e um teste que varre os arquivos `"use client"`.

**`PRIMARY KEY` não servia para as métricas.** A linha mais importante é o total
do dia, que tem campanha nula — e chave primária implica `NOT NULL` em Postgres.
Virou índice único com `NULLS NOT DISTINCT`, senão cada sincronização inseriria
um total novo em vez de atualizar o existente.

**Uma dependência que eu mesmo escolhi tinha SQL injection.** `drizzle-orm`
abaixo de 0.45.2 (GHSA-gpj5-g38j-94v9). Corrigido no mesmo dia em que apareceu.
O CI agora reprova em vulnerabilidade crítica.

---

## Parte 6 — Por onde continuar

Na ordem que eu seguiria:

1. **Atividades e propostas** (~1 semana) — tabela e índice já existem, falta a
   tela. Fecha o ciclo comercial.
2. **Operacional** (~3 semanas) — demandas, quadro, comentários, tempo,
   aprovações. É o módulo que a equipe abre todo dia, e o de maior impacto
   diário: tira o Trello e o ClickUp do ar.
3. **Agenda** (~1 semana) — gravações e reuniões, que hoje vivem em agendas
   paralelas.
4. **Financeiro** (~3 semanas) — merece revisão de segurança dedicada antes de
   ir a produção. O isolamento do escopo pessoal já está desenhado na migração.
5. **WhatsApp** (~4 semanas) — maior risco técnico, por isso por último.

O diário de cada fase está em `docs/mark-sistem/`. Cada documento diz o que foi
decidido e por quê, para você poder discordar com contexto.

---

## O que eu mudaria se pudesse recomeçar

Duas coisas, para você saber onde estão as juntas frouxas:

**Tailwind e shadcn ficaram de fora.** A arquitetura os previa. Não entraram
porque o preflight do Tailwind reseta estilo global e derrubaria as 1650 linhas
de CSS do painel — no mesmo commit que reestruturava a navegação, seria
impossível atribuir qualquer quebra. O CSS atual segue os mesmos tokens e a
migração continua possível; o momento certo é quando o painel entrar na casca.

**As migrações são SQL escrito à mão.** Foi a escolha certa por causa de RLS,
particionamento e índices parciais, que o gerador não modela. Mas significa que
o esquema Drizzle e o SQL podem divergir se alguém alterar um sem o outro. Os
testes de RLS pegam parte disso; um teste que compare o esquema com o banco
migrado pegaria o resto, e vale escrever.

---

Qualquer coisa aqui é discutível — nada foi decidido para ser definitivo, e
tudo está documentado para poder ser desfeito com contexto. Quando você entrar,
comece pelo `/painel` e depois arraste um card no `/vendas`: são as duas telas
que melhor mostram como o sistema pensa.

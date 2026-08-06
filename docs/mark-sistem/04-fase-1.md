# Fase 1 — Em andamento

O que já está pronto, o que falta, e o que você precisa fazer.

- [`00-arquitetura.md`](00-arquitetura.md) · [`01-modelagem.md`](01-modelagem.md) · [`02-roadmap.md`](02-roadmap.md) · [`03-fase-0.md`](03-fase-0.md)

---

## ⚠️ O que depende de você

Além do **Root Directory na Vercel** (ver [`03-fase-0.md`](03-fase-0.md)), agora
há mais duas.

### 1. A chave do cofre

Gere e guarde **uma cópia offline** antes de qualquer outra coisa:

```bash
node -e "console.log('1:' + require('crypto').randomBytes(32).toString('base64url'))"
```

Cadastre o resultado como `COFRE_KEKS` na Vercel.

Sem ela, a importação dos tokens recusa rodar — de propósito, porque a
alternativa seria gravar token da Meta em texto puro. **Perder esta chave torna
todas as senhas de todos os clientes irrecuperáveis.** Não há como reconstruí-las
a partir do banco: é essa a diferença entre um cofre e uma gaveta.

### 2. Rodar a migração e importar a carteira

```bash
npm run db:migrar          # 5 migrações
npm run db:semear          # organização, papéis, você como proprietário
npm run db:importar-meta   # clientes e tokens saem do .env e vão cifrados
```

Depois disso você entra com **e-mail e senha**, não mais com usuário do
`DASH_USERS`. O campo de login aceita os dois — o servidor decide pelo formato.

Confira em `/api/saude`: o campo `modoDeLogin` diz o que está valendo, e
`pendencias` lista o que falta.

---

## O que ficou pronto

| Peça | Estado |
|---|---|
| Next 15 → 16 | pronto — `npm audit` acusa **0 vulnerabilidades** |
| `normalizarTelefone` | pronto, 31 testes |
| Migração 0003 — contatos, clientes, etiquetas, vínculos, eventos | pronta |
| Migração 0004 — credenciais + auditoria imutável | pronta |
| Migração 0005 — usuário enxerga a própria filiação | pronta |
| `@mark/cofre` — cifra envelopada | pronto, 22 testes |
| `core/clientes` — CRUD, lixeira, cursor, linha do tempo | pronto |
| `core/credenciais` — listar, revelar com auditoria, rotação | pronto |
| Importação do `META_TOKENS` | pronta, idempotente |
| Login pelo banco + legado convivendo | pronto |
| Sessão revogável no logout | pronta |
| Rotas do painel se defendendo sozinhas | pronto |

**125 testes**, 25 deles contra Postgres real no CI.

## O que falta na fase 1

1. Casca da aplicação — barra lateral, tema, ⌘K, notificações
2. Telas de clientes e contatos (o `core` está pronto; falta a interface)
3. Sync do Meta Ads pelo worker, e o painel lendo do banco em vez da Graph API
4. Tela de usuários e papéis
5. Aposentar `DASH_USERS` e `META_TOKENS`

---

## Decisões desta fase

### Os dois modos de login convivem

Sem `DATABASE_URL`, o painel continua funcionando exatamente como antes. Isso
não é indecisão: um deploy que exigisse banco no mesmo instante deixaria a
equipe sem painel até alguém terminar de configurar o Neon.

O modo legado dá acesso **só ao painel de campanhas**. Nenhum módulo do MARK
SISTEM abre sem `Contexto` de verdade — sem organização e sem papel não há como
decidir permissão, e chutar seria pior do que recusar.

Quando toda a equipe estiver no banco, o caminho legado sai junto com
`DASH_USERS`.

### O middleware deixou de ser a barreira

Antes, as rotas do painel não conferiam sessão: confiavam inteiramente no
middleware. Agora cada uma valida por conta própria, e o middleware só evita
renderizar tela para quem claramente não entrou.

O motivo é técnico e vale registrar: validar sessão de banco no middleware
obrigaria a carregar o driver do Postgres a cada requisição, inclusive nas que
não tocam em dado nenhum. E é arquitetura melhor — passar no middleware nunca
deveria ter sido o que autoriza.

### Contato é a âncora, e o índice de telefone é quem garante

`contatos (organizacao_id, telefone_e164)` é único. É esse índice que impede o
WhatsApp criar um contato novo a cada mensagem — e é por isso que
`normalizarTelefone` tem 31 testes para uma função de 60 linhas.

O padrão brasileiro tem três armadilhas, e todas as três aparecem na carteira
atual: o nono dígito (um `44 8888-7777` e um `44 98888-7777` são a mesma
pessoa), o zero de operadora, e o `55` que é código do país e também DDD do Rio
Grande do Sul.

### Imutabilidade por gatilho, não por REVOKE

`credencial_acessos` registra toda revelação de senha. `REVOKE UPDATE, DELETE`
não serviria: o dono da tabela mantém o privilégio, e é assim que a aplicação
conecta em Postgres gerenciado — o mesmo motivo que obriga o
`FORCE ROW LEVEL SECURITY`. Um gatilho vale para todo mundo, inclusive para
quem tem a credencial do banco em mãos.

E a auditoria é gravada **antes** de o segredo sair, na mesma transação: se ela
falhar, o segredo não é entregue.

---

## Três coisas que quase passaram despercebidas

### 1. A regra de lint da fase 0 bloquearia a fase 1

Eu havia proibido `@mark/core` de importar o banco — mais restrito do que a
arquitetura, que diz "TypeScript puro **sobre Drizzle**". Toda a camada de
negócio desta fase seria impossível.

Agora `core` fala com o banco, mas não com React, Next nem `@mark/auth` — este
último por ser circular. E `comoAdmin`, que ignora a RLS, continua proibida
também lá.

### 2. O login não passaria pela RLS — de novo

A fase 0 resolveu o caso da sessão. Faltava o seguinte: depois de conferir a
senha sabemos quem é o usuário, mas não a que organização ele pertence — e quem
responde isso é `membros`, cuja política exigia `organizacao_id = app_org()`.
A consulta voltava vazia e ninguém entrava.

A migração 0005 acrescenta `OR usuario_id = app_usuario()`. Mais estreito do que
abrir `membros` para o login inteiro, e correto por si: ver a que empresas você
pertence é informação sua. É também o que vai sustentar o seletor de organização
quando o sistema atender mais de uma empresa.

### 3. O barril do `@mark/auth` quebrava o Edge

O middleware importava a constante do cookie de `@mark/auth`, e o barril
arrastava argon2 — módulo nativo que não existe no runtime Edge. O build
quebrou na primeira vez que o `apps/web` de fato importou os pacotes.

`@mark/auth/cookie` agora é um módulo sem dependência nenhuma, com três
constantes. Importar de lá custa três constantes; importar do índice custava o
pacote inteiro.

---

## Comandos novos

```bash
npm run db:importar-meta   # META_TOKENS -> clientes + credenciais cifradas
```

Idempotente: rodar de novo não duplica cliente e **atualiza** o token de quem já
existe — que é exatamente o que se quer quando um token expira.

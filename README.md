# Marktiva — Painel de Campanhas e Financeiro

Painel web das campanhas do Meta Ads para uma carteira de clientes, com login,
filtros de período iguais aos do Gerenciador de Anúncios, atualização automática
e exportação em PDF — e um **financeiro** em `/financeiro`, com as contas da
Marktiva e as pessoais do Diogo separadas.

A métrica central é **conversa iniciada por mensagem** e o **custo por conversa** —
o que decide para onde vai a verba. Cliques e impressões aparecem como apoio.

---

## O que tem

- **Duas visões**: carteira (todos os clientes lado a lado, do custo por conversa
  mais baixo ao mais alto) e cliente (o painel completo de um deles).
- **Login por usuário e senha**, com sessão assinada em cookie `HttpOnly` de 12 h.
- **Períodos**: hoje, ontem, 7 / 14 / 28 / 30 / 90 dias, este mês, mês passado,
  este ano, máximo e intervalo personalizado.
- **Seletor de cliente e de conta**: cada cliente tem token próprio, e o painel
  descobre sozinho as contas atribuídas a cada um. Atribuiu uma conta nova no
  Business Manager? Ela aparece sem mexer no código.
- **Atualização automática** a cada 60 s, com botão para desligar.
- **PDF** pelo botão “Gerar PDF”, com layout próprio de impressão.
- **Tema claro e escuro**, acompanhando o sistema, com alternância manual.
- Paleta validada para daltonismo (deuteranopia, protanopia e tritanopia).
- **Financeiro** (`/financeiro`): entradas e saídas, contratos recorrentes com
  lembrete de cobrança e calendário brasileiro. Descrito na seção abaixo.

---

## Financeiro

Fica em `/financeiro`, atrás do mesmo login, com link no topo do painel de
campanhas. **Precisa do `DATABASE_URL`** — é o mesmo Postgres das anotações, e
as tabelas nascem sozinhas na primeira consulta (veja
[docs/ligar-anotacoes.md](docs/ligar-anotacoes.md)).

### Duas áreas que nunca se somam

A aba do topo troca entre **Marktiva** (empresa) e **Diogo** (pessoal). Cada
uma tem as próprias entradas, saídas, despesas e contratos — nada é somado
entre elas. É a separação que o painel existe para manter.

### Quatro seções

| Seção | Para quê |
|---|---|
| **Agenda** | O que precisa ser cobrado e o que precisa ser pago, de qualquer mês, com o calendário do mês ao lado |
| **Lançamentos** | Tudo da competência aberta, com o formulário de entrada e saída |
| **Recorrências** | Os contratos que se repetem, e o histórico de pagamento de cada um |
| **Despesas** | Para onde o dinheiro foi, por categoria, e a evolução mês a mês |

### Recorrência e cobrança

Um contrato recorrente (mensal, bimestral, trimestral, semestral ou anual) é a
regra que **fabrica a cobrança de cada competência sozinha** — sem agendador:
as cobranças nascem quando a tela é aberta, e o índice único no banco garante
que abrir dez vezes não duplica nada. A geração cobre até 12 meses para trás
(ao cadastrar um contrato antigo) e 2 meses para frente.

Cada contrato define **com quantos dias de antecedência quer o lembrete**. A
agenda acende o aviso nessa janela e continua aceso depois do vencimento. Dois
botões, com propósitos diferentes:

- **Cobrar** — registra que a cobrança foi enviada ao cliente. Não mexe no
  dinheiro; serve para o lembrete parar de pedir a mesma coisa todo dia.
- **Recebi / Paguei** — abre a data e a forma de pagamento antes de dar baixa.
  A data é escolhida, e não presumida como hoje, porque é exatamente ela que
  decide se o cliente pagou em dia. O resultado vira uma pastilha: **Em dia**,
  **Atrasado 5d** ou **Adiantado 3d**, e o cartão do contrato acumula quantas
  vezes aquele cliente atrasou e a média de atraso.

Baixa errada tem volta: **Desfazer baixa** devolve o lançamento para em aberto.

### Calendário brasileiro

Os feriados são **calculados, não tabelados** — os móveis saem da Páscoa, então
qualquer ano futuro já nasce certo, inclusive Carnaval e Corpus Christi. Inclui
o 20 de novembro (Consciência Negra), nacional desde a Lei 14.759/2023.

Serve para duas coisas: marcar os vencimentos sobre o mês (três boletos na
mesma segunda é algo que só aparece em formato de grade) e **empurrar o
vencimento para o próximo dia útil** quando o contrato pede — boleto em domingo
não compensa em domingo. Dia 31 em mês de 30 vira o último dia do mês.

---

## Subir na Vercel

### 1. Enviar para o GitHub

```bash
git push -u origin <sua-branch>
```

### 2. Importar na Vercel

Em [vercel.com/new](https://vercel.com/new), importe o repositório. A Vercel
detecta Next.js sozinha — **não precisa configurar Root Directory nem build
command**.

### 3. Cadastrar as variáveis de ambiente

Em **Settings → Environment Variables**, marcando Production, Preview e
Development em cada uma:

| Variável | O que é |
|---|---|
| `META_TOKENS` | Um cliente por linha: `Nome = TOKEN` |
| `SESSION_SECRET` | Chave que assina a sessão (mínimo 32 caracteres) |
| `DASH_USERS` | Usuários e senhas do painel |
| `DATABASE_URL` | Postgres das anotações e do financeiro (opcional para as campanhas, obrigatório para `/financeiro`) |

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
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
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

O middleware bloqueia toda rota que não seja `/login`: sem sessão válida, a API de
métricas nem chega a ser executada.

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

Next.js 15 (App Router) · React 19 · TypeScript · Recharts · jose · Postgres

As **métricas** não são guardadas em lugar nenhum: o painel lê a Graph API a
cada requisição, porque elas vivem na Meta e copiá-las só criaria uma segunda
versão da verdade. Usuários e tokens ficam em variáveis de ambiente.

O Postgres guarda só o que **nasce dentro do painel** e não existe em nenhuma
API para ser buscado de novo: as anotações do registro e o financeiro inteiro.
Sem `DATABASE_URL` as duas coisas ficam desligadas e o resto continua
funcionando normalmente.

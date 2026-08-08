# 11 — Riscos técnicos

Doze riscos, com o que fazer em cada um. Ordenados por gravidade —
probabilidade × custo de acontecer.

---

<a id="r1"></a>

## R1 — Banimento do número de WhatsApp

**Gravidade: crítica.** É o risco número um do projeto.

Conectar por QR Code exige biblioteca não-oficial, o que viola os Termos do
WhatsApp. A punição aplicada é banimento do número, com frequência permanente,
sem aviso e sem recurso. Se o número banido for o comercial da agência,
perdem-se o histórico com todos os clientes e o número impresso em todo material
de divulgação. O gatilho mais comum é volume de envio para contatos que não
responderam antes — exatamente o que a área de campanhas faz.

**O que fazer**

- Cloud API oficial para o número comercial e para **todas** as campanhas.
- Adaptador QR isolado, desligado por padrão, atrás de flag — e, se usado, em
  número secundário e descartável, nunca no comercial.
- Limitador por número em toda fila de envio, com aquecimento gradual.
- Opt-out verificado na montagem da campanha **e** de novo no envio.
- Modelos aprovados fora da janela de 24 h, com a interface impedindo o envio
  livre em vez de deixá-lo falhar.

**Se acontecer:** as conversas estão em `wa_messages`, no seu banco — não se
perdem com o número. Trocar o número é reconectar em `wa_numbers`; o histórico
por contato permanece. É por isso que as mensagens são gravadas localmente e não
só lidas do provedor.

---

<a id="r2"></a>

## R2 — Escopo grande demais para a equipe

**Gravidade: crítica.** É como projetos assim terminam — não com falha técnica,
com cansaço.

Dezessete módulos substituindo cinco ferramentas, tocado por poucas pessoas que
também precisam atender clientes. O modo de falha é seis meses de construção sem
nada em produção.

**O que fazer**

- As fases de [10](10-roadmap-e-mvp.md): valor real em uso a partir da semana 5.
- Cada fase substitui uma ferramenta inteira. Nunca metade de duas.
- O checklist de aceite impede módulo pela metade.
- Se atrasar, **corta módulo, não corta o checklist**. Sistema com seis módulos
  bons é usado; com quinze pela metade, não.

---

<a id="r3"></a>

## R3 — Vazamento entre organizações (multi-tenant)

**Gravidade: alta.** Baixa probabilidade hoje — há uma organização. Consequência
catastrófica se o sistema virar SaaS e alguém vir dado de outra agência.

O erro típico não é conceitual: é um `findUnique({ where: { id } })` esquecido
sem escopo, num endpoint pouco usado.

**O que fazer**

- `forTenant()` como único caminho; o cliente Prisma cru não é exportado de
  `@mark/db`.
- RLS ligado como rede de proteção, com `SET LOCAL app.org_id` **dentro de
  transação** — com pool de conexões, `SET` simples vazaria o valor para a
  requisição seguinte. Esse detalhe está em [04](04-banco-de-dados.md#multi-tenant)
  porque é a forma mais comum de errar isso.
- Lint proíbe `findUnique` sem escopo fora de `packages/db`.
- Teste de integração que cria duas organizações e verifica que nenhuma query
  atravessa.

---

<a id="r4"></a>

## R4 — Perda da chave mestra de criptografia

**Gravidade: alta, irreversível.**

Perdida a `MASTER_KEY`, as senhas dos clientes são irrecuperáveis — inclusive do
backup, que guarda só texto cifrado. Isso é o comportamento correto do sistema, e
é também um risco operacional real.

**O que fazer**

- Chave em três lugares independentes: gerenciador de segredos do provedor,
  cofre pessoal do proprietário e cópia física lacrada.
- Rotação anual, viável porque a criptografia é em envelope (rotaciona-se a
  chave mestra, não os N mil segredos).
- O teste trimestral de restauração **descriptografa uma credencial de teste** —
  é o que prova que a chave guardada é a chave certa.

---

<a id="r5"></a>

## R5 — Custo silencioso da infraestrutura

**Gravidade: média-alta.** Não derruba o sistema; derruba a disposição de mantê-lo.

Estimativa realista para a Marktiva:

| Item | Mês |
|---|---|
| Vercel Pro | US$ 20 |
| Neon (plano pago, sem suspensão) | US$ 19 |
| Worker (Railway/Fly) | US$ 5–10 |
| Upstash Redis | US$ 0–10 |
| Cloudflare R2 (~500 GB) | US$ 7 |
| Resend | US$ 0–20 |
| Sentry | US$ 0–26 |
| **Infra** | **~US$ 60–110** |
| WhatsApp Cloud API | variável, ~US$ 20–100 conforme volume |

Os dois itens que escapam do controle: **egress** (resolvido pelo R2, que cobra
zero) e **WhatsApp por conversa** (cresce com o volume de campanha).

**O que fazer**

- Alerta de orçamento em cada provedor, desde o primeiro dia.
- Painel de custo por integração no `/api/saude`.
- R2 com regra de ciclo de vida: original de vídeo com mais de 1 ano vai para
  armazenamento frio.

---

<a id="r6"></a>

## R6 — Esgotamento de conexões com o banco

**Gravidade: média-alta.** É o modo de falha mais comum de Next + Postgres, e
derruba o sistema inteiro de uma vez, com "too many connections".

Serverless abre conexão por invocação. Um pico esgota o pool.

**O que fazer**

- `apps/web` sempre pelo pooler do Neon, com `connection_limit=1`.
- `apps/worker` com conexão direta e pool de 10 (transação longa não funciona
  bem em modo transação do PgBouncer).
- Migrations pela `DIRECT_URL`.
- Alerta quando o uso de conexões passar de 70%.

---

<a id="r7"></a>

## R7 — Mudança de contrato nas APIs externas

**Gravidade: média.** Certa de acontecer: a Meta descontinua versão da Graph API
todo ano, e o painel atual já usa a v21.

**O que fazer**

- Versão da API fixada e visível em um lugar por integração.
- Zod validando **as respostas** externas: mudança de contrato vira erro claro na
  fila, não `undefined` propagando silenciosamente até a tela.
- Verificação diária de validade de token, com notificação de reconexão.
- Disjuntor por provedor.
- Métricas gravadas em `ad_metrics_daily`: com a Meta fora do ar, o painel mostra
  ontem em vez de mostrar nada.

---

<a id="r8"></a>

## R8 — Migration destrutiva em produção

**Gravidade: média-alta.**

Renomear coluna, mudar tipo, adicionar `NOT NULL` numa tabela com dados: o deploy
não é atômico, e há um intervalo em que código velho e schema novo convivem.

**O que fazer**

- Toda mudança destrutiva em duas etapas (adicionar → migrar → remover), nunca
  direta.
- Toda migration roda antes numa branch do Neon com cópia dos dados de produção
  — automático no preview do PR.
- `CREATE INDEX CONCURRENTLY` acima de 100 mil linhas.
- PITR de 7 dias como último recurso.

---

<a id="r9"></a>

## R9 — Tabelas que crescem sem parar

**Gravidade: média, cresce com o tempo.**

`wa_messages`, `ad_metrics_daily` e `audit_logs` crescem para sempre. Aos ~50
milhões de linhas, listagem e backup degradam — e particionar depois exige
parada.

**O que fazer**

- Particionamento mensal declarativo **desde a primeira migration** nas três, com
  job criando a partição do mês seguinte com antecedência.
- Retenção: mensagem de lead perdido purgada em 24 meses; auditoria arquivada em
  R2 após 2 anos; métricas de tráfego mantidas (são pequenas e valiosas).
- Paginação por cursor em toda listagem dessas tabelas.

---

<a id="r10"></a>

## R10 — Sincronização bidirecional de calendário

**Gravidade: média.** Integração que mais costuma dar errado neste tipo de
sistema: laço de eco (cada lado reagindo à alteração do outro) e evento
duplicado.

**O que fazer**

- `events.google_event_id` como correspondência única.
- `atualizado_em` mais recente vence; alteração vinda do Google não dispara
  escrita de volta.
- Canal de webhook renovado antes dos 7 dias — canal expirado para de entregar
  em silêncio, e o sintoma é "a agenda parou de sincronizar" semanas depois.
- Reconciliação diária comparando os dois lados.
- Fase 6, depois de o resto estar estável.

---

<a id="r11"></a>

## R11 — Adoção pela equipe

**Gravidade: alta, e não é técnica.** Um sistema perfeito que ninguém usa é um
sistema que falhou. A equipe volta ao Trello se o MARK SISTEM for mais lento ou
mais burocrático que ele.

**O que fazer**

- Cadastro mínimo obrigatório, levado a sério: dois campos para lead, dois para
  demanda.
- Importar o que já existe: leads da planilha, cards do Trello, clientes.
- Uma fase por vez, com a ferramenta antiga desligada de fato ao final —
  conviver com as duas garante que ninguém migra.
- As metas de latência de [07](07-desempenho.md) não são enfeite: são o que faz a
  pessoa preferir o sistema novo.

---

<a id="r12"></a>

## R12 — Fator caminhão

**Gravidade: média-alta.** Um sistema que administra a empresa inteira, com uma
pessoa entendendo como funciona.

**O que fazer**

- A documentação de [10](10-roadmap-e-mvp.md#documentação-a-manter) é entregável,
  não cortesia.
- Estes documentos de arquitetura atualizados quando a decisão mudar.
- Nada de infraestrutura configurada só pelo painel do provedor sem estar escrito.
- Acesso de administrador aos provedores em nome da empresa, com recuperação no
  cofre.

---

## Resumo

| # | Risco | Gravidade | Principal defesa |
|---|---|---|---|
| R1 | Banimento do WhatsApp | crítica | Cloud API por padrão; QR isolado e opcional |
| R2 | Escopo grande demais | crítica | 6 módulos no MVP; corta módulo, não qualidade |
| R3 | Vazamento entre tenants | alta | `forTenant()` + RLS + lint + teste |
| R4 | Perda da chave mestra | alta | 3 cópias; teste trimestral que descriptografa |
| R5 | Custo silencioso | média-alta | R2 sem egress; alerta de orçamento |
| R6 | Conexões esgotadas | média-alta | pooler + `connection_limit=1` |
| R7 | API externa muda | média | Zod na resposta; disjuntor; métricas gravadas |
| R8 | Migration destrutiva | média-alta | duas etapas; branch do Neon no PR |
| R9 | Tabelas gigantes | média | particionamento desde o início |
| R10 | Sync de calendário | média | correspondência por ID; sem eco; reconciliação |
| R11 | Equipe não adota | alta | cadastro mínimo; velocidade; migração real |
| R12 | Fator caminhão | média-alta | documentação como entregável |

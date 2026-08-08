# 08 — Integrações

## Princípio

Toda API externa vive em `packages/integrations/`, atrás de uma interface. O
resto do sistema não sabe que a Meta existe.

```
domain / data  ─────▶  interface  ─────▶  adaptador  ─────▶  API externa
                       (nossa)            (deles)
```

Três consequências que valem o esforço:

1. **Testabilidade.** O domínio é testado com um adaptador falso, sem rede.
2. **Substituibilidade.** Trocar o provedor de WhatsApp é trocar um arquivo.
3. **Contenção de falha.** Uma integração fora do ar é uma função que devolve
   `Result.erro`, não uma exceção que derruba a tela.

E a regra que amarra tudo: **nenhuma ação de usuário chama API externa de forma
síncrona**. A ação grava no `outbox`, na mesma transação da mudança, e o worker
executa. Se a Meta estiver fora do ar, o lead foi criado do mesmo jeito.

---

## Meta Ads

### Decisão 7 — gravar as métricas, não só ler

**O que já existe.** `src/lib/meta.ts` é um cliente maduro da Graph API v21:
paginação, taxonomia de `action_type` para conversas por mensagem, orçamento e
aportes da conta, *change log* e cálculo de impacto de alteração, e a limpeza do
token de toda mensagem de erro. Vai para `packages/integrations/meta` quase
inteiro.

**O que muda.** Duas coisas.

*Primeira: o token sai da variável de ambiente.* Hoje `META_TOKENS` guarda um
token por cliente em texto puro no painel da Vercel. Passa a viver em
`credentials`, cifrado, com auditoria — e conta de anúncio vira cadastro por tela
(`ad_accounts`), não redeploy.

*Segunda: os números passam a ser gravados.* Hoje toda tela consulta a Graph API
ao vivo e descarta o resultado. Isso custa três coisas:

| Hoje | Com `ad_metrics_daily` |
|---|---|
| Painel espera a Meta (1–4 s) | Painel lê o banco (~50 ms) |
| Meta fora do ar = painel vazio | Painel funciona com o dado de ontem |
| Sem histórico próprio: a Meta limita janela e reajusta atribuição retroativamente | Histórico completo, auditável, comparável mês a mês |

O job de 05:00 reprocessa **os últimos 7 dias** por conta, com
`ON CONFLICT DO UPDATE`. A janela de 7 dias não é folga: é porque a Meta ajusta
números para trás, e sem reprocessar, o dado de ontem congela errado.

O modo ao vivo continua disponível como botão "atualizar agora" — útil quando se
está acompanhando uma campanha subindo.

### Tokens

Token de usuário de sistema do Business Manager não expira, mas **é revogável** —
e revogação silenciosa é o modo de falha mais comum aqui. O worker verifica a
validade de cada token diariamente e, ao encontrar um revogado, marca
`ad_accounts.ativo = false` e notifica quem responde pela conta. O painel mostra
"reconectar", não um gráfico vazio sem explicação.

---

## WhatsApp

### Decisão 6 — uma interface, dois adaptadores

Esta é a integração de maior risco do projeto, e o briefing pede duas coisas que
não coexistem:

> §8.1 — "conectar os números por QR Code"
> §8.6 — "não criar soluções inseguras que possam causar bloqueio do número"

**Por que não coexistem.** Conectar por QR Code exige biblioteca não-oficial
(Baileys, WPPConnect, Venom), que simula o WhatsApp Web por engenharia reversa.
Isso viola os Termos de Serviço do WhatsApp. A consequência aplicada é banimento
do número — frequentemente permanente, sem aviso e sem recurso. Se o número
banido for o comercial da agência, perde-se o histórico de conversa com todos os
clientes e o número que está impresso em todo material de divulgação.

O gatilho mais comum não é nem a biblioteca em si: é **volume de envio para
contatos que não responderam antes**, que é exatamente o que a área de campanhas
(§8.6) faz.

**A solução não é escolher por você. É estruturar para que a escolha seja sua,
reversível, e não contamine o resto do sistema.**

```ts
// packages/integrations/whatsapp/provider.ts
export interface WhatsAppProvider {
  conectar(numeroId: string): Promise<Conexao>
  desconectar(numeroId: string): Promise<void>
  enviarTexto(para: string, texto: string, ctx: Ctx): Promise<MsgEnviada>
  enviarMidia(para: string, midia: Midia, ctx: Ctx): Promise<MsgEnviada>
  enviarModelo(para: string, modelo: Modelo, vars: Var[]): Promise<MsgEnviada>
  aoReceber(cb: (msg: MsgRecebida) => Promise<void>): void
  status(numeroId: string): Promise<StatusConexao>
}
```

Todo o CRM, a caixa de entrada e as campanhas falam só com essa interface.

| | **Cloud API** (oficial) | **QR Code** (não-oficial) |
|---|---|---|
| Risco de banimento | nenhum | **alto** |
| Conecta o número atual | migra para a API | sim, direto |
| Mensagem livre | só dentro de 24 h da última mensagem do contato | sempre |
| Fora das 24 h | só modelo aprovado | livre |
| Campanha | modelos aprovados, sob regra | livre — e é o que causa banimento |
| Custo | por conversa (~R$ 0,08–0,30) | zero |
| Estabilidade | alta, com SLA | quebra a cada atualização do WhatsApp |
| Onde roda | webhook, funciona em serverless | socket persistente, só no worker |

**Recomendação, e o motivo:**

- **Cloud API para o número comercial e para todas as campanhas.** É o número
  que sustenta o faturamento; expor ele a banimento por economizar R$ 0,15 por
  conversa não é uma troca racional.
- **Adaptador QR disponível, desligado por padrão**, isolado em
  `apps/worker/src/whatsapp/qr/`, carregado por `import()` dinâmico atrás da flag
  `WHATSAPP_QR_ENABLED`. Se você optar por usá-lo, que seja num número
  secundário, com volume baixo, sabendo do risco. Nada mais no sistema muda.

O campo `wa_numbers.provider` permite os dois convivendo: comercial na Cloud API,
suporte no QR, na mesma caixa de entrada.

### O que a arquitetura garante nos dois casos

**Idempotência.** `wa_messages.external_id` é único. O webhook do WhatsApp
reentrega o mesmo evento com frequência; sem isso, a conversa enche de duplicata.

**Janela de 24 horas.** `wa_conversations.janela_expira_em` é atualizada a cada
mensagem recebida. A interface desabilita o campo de texto quando a janela fecha
e explica o motivo, oferecendo os modelos aprovados — em vez de deixar o envio
falhar depois de digitado.

**Limite de envio.** BullMQ com limitador por número (concorrência 1, intervalo
mínimo entre envios, teto diário configurável). Aquecimento gradual para número
novo. Isso protege inclusive na Cloud API, que tem escala de qualidade por
número.

**Opt-out respeitado sempre.** `wa_optouts` e `contacts.opt_out_em` são
verificados na montagem de toda campanha e de novo no momento do envio — porque
alguém pode sair da lista entre uma coisa e outra.

**Webhook responde 200 na hora.** Valida assinatura, grava no `outbox`, responde.
O processamento é do worker. Webhook lento é webhook que o WhatsApp desativa.

**Reconhecimento do contato.** Ao chegar mensagem, o telefone normalizado em
E.164 é buscado em `contacts`. Encontrou: a conversa já abre com ficha, etapa,
responsável, tarefas e propostas. Não encontrou: botão "Criar lead", que
aproveita nome, telefone e foto do perfil.

### IA — pontos de extensão, sem implementação

O briefing (§8.7) pede que a arquitetura esteja pronta. Concretamente, três
ganchos, todos sem consumidor por enquanto:

1. Evento `mensagem.recebida` no `outbox` — qualquer processador futuro se
   inscreve sem alterar o fluxo de recebimento.
2. Colunas `wa_conversations.resumo_ia`, `intencao`, `temperatura_ia` já
   previstas, nulas.
3. Interface `AssistenteConversa` com `resumir()`, `sugerirResposta()` e
   `classificar()`, sem implementação.

Isso é o que "preparado para IA" significa: pontos de entrada definidos. Não
código morto.

---

## Google

**Google Ads** — mesmo desenho do Meta: OAuth2 com refresh token no cofre,
sincronização diária para `ad_metrics_daily` com `plataforma = GOOGLE`. As
métricas comuns (gasto, impressões, cliques, conversões) vão nas colunas; o que
é específico da plataforma vai em `metricas_extras jsonb`. Assim o painel
comparativo entre plataformas é uma query só.

**Google Calendar** — sincronização bidirecional, que é onde este tipo de
integração costuma dar errado. Três precauções: `events.google_event_id` guarda a
correspondência; a direção do último `atualizado_em` decide o vencedor em caso de
conflito; e o webhook do Google usa canal com renovação automática antes de
expirar (canais expiram em 7 dias e param em silêncio).

**Gmail e Drive** — previstos, fora do MVP. O OAuth já é compartilhado com
Calendar; acrescentar escopo é configuração.

---

## Outras

| Serviço | Uso | Observação |
|---|---|---|
| **Resend** | e-mails transacionais e resumo diário | domínio próprio, SPF/DKIM/DMARC |
| **Sentry** | erros e tracing | filtro de dados sensíveis antes do envio |
| **Cloudflare R2** | arquivos | ver [06](06-seguranca.md#arquivos-e-uploads) |
| **Upstash Redis** | cache, filas, rate limit, pub/sub | TLS |
| **Neon** | Postgres | branch por preview |

---

## Previstas, não construídas

O que a arquitetura já acomoda sem alteração estrutural:

| Integração | O que já existe para ela |
|---|---|
| **TikTok Ads** | `ad_accounts.plataforma` é enum extensível; `ad_metrics_daily` é agnóstica |
| **Portal do cliente** | `approvals.token_publico` já está no schema |
| **Assinatura eletrônica** | `contracts.file_id` + status; falta o adaptador |
| **Emissão de cobrança** (Asaas, Cora) | `fin_entries` já tem `status` e `forma_pagamento`; o adaptador escreve `fin_payments` na baixa automática |
| **App mobile** | Route Handlers já são REST; falta autenticação por token |
| **BI** | réplica de leitura do Neon; nenhuma mudança de schema |

---

## Falha de integração não derruba o sistema

Requisito da §32, e a mecânica é concreta:

1. **Nada síncrono.** Ação de usuário grava no `outbox` e retorna.
2. **Disjuntor.** Após 5 falhas seguidas de um provedor, o adaptador para de
   tentar por 5 minutos — não adianta martelar uma API caída, e a fila entope.
3. **Degradação visível.** WhatsApp desconectado mostra faixa na caixa de entrada
   e as mensagens ficam na fila. O CRM, o financeiro e o operacional não sabem
   que houve problema.
4. **Retry com backoff e teto.** Falha permanente (401, 403) não é repetida:
   vira notificação para quem responde pela conta.
5. **Painel de saúde.** `/api/saude` — evoluído do `src/lib/diagnostico.ts` que
   já existe — mostra o estado de cada integração, do banco, do Redis e das
   filas. É a primeira tela a abrir quando algo parece estranho.

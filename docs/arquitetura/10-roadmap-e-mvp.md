# 10 — Roadmap e MVP

## Decisão 11 — o MVP são 6 módulos, não 17

O briefing pede 17 módulos e sugere uma ordem de 13 itens. Construir os 17 antes
de alguém usar qualquer um é como projetos deste tamanho morrem: seis meses sem
nada em produção, o entusiasmo acaba, e o Trello continua aberto na outra aba.

A proposta: **em ~10 semanas, seis módulos em uso diário real**. Os outros onze
entram depois, sobre uma base já validada por uso — e nenhuma decisão do MVP os
impede.

O critério de corte foi um só: **o módulo substitui uma ferramenta que a
Marktiva usa hoje?** Se substitui, entra cedo. Se é conveniência, espera.

| Módulo | Substitui hoje | Decisão |
|---|---|---|
| CRM Operacional | Trello / ClickUp | **entra** — o mais usado |
| Clientes | planilha + pastas | **entra** — é a espinha dorsal |
| CRM de Vendas | planilha + memória | **entra** |
| Financeiro | planilha | **entra** — maior valor por esforço |
| Agenda | Google Calendar | **entra** |
| Tráfego | o painel atual | **entra** — já existe |
| Senhas | Bloco de notas / mensagem trocada | **entra** — risco de segurança presente |
| WhatsApp | WhatsApp Web | espera — maior custo e maior risco |
| Estratégias, Aprovações | Notion / documento solto | espera |
| Wiki, Pesquisa, Comunicação | Notion / grupo de mensagens | espera |

---

## Fases

### F0 — Fundação (semana 1–2) · sem tela nova

Nada visível, e é a fase que decide se o resto vai bem.

- Monorepo pnpm + Turborepo; `apps/web` migrado do painel atual
- Prisma + schema completo (todas as ~60 tabelas de uma vez — schema completo
  desde o começo custa pouco e evita migration a cada módulo)
- `@mark/db`: `forTenant`, exclusão lógica, auditoria, RLS
- `@mark/auth`: Auth.js, Argon2id + PBKDF2 legado, sessão em banco, `can()`
- `@mark/ui`: tokens, primitivos, layout, ⌘K vazio
- CI: typecheck, lint, testes, orçamento de bundle
- Deploy dos dois processos, Sentry, `/api/saude`
- Seed migrando `DASH_USERS` e `META_TOKENS` para banco e cofre

**Pronto quando:** a equipe faz login com a senha atual, vê o layout, e o painel
de tráfego antigo continua funcionando.

### F1 — Estrutura (semana 3) · primeira tela útil

- Configurações: organização, usuários, convites, permissões
- Painel Geral com os indicadores que já existirem
- Notificações (sino, tempo real, preferências)
- Auditoria (tela de leitura)

### F2 — Comercial e clientes (semana 4–5)

- **Clientes**: cadastro, ficha, contatos, contrato, status, saúde, timeline
- **CRM de Vendas**: pipeline kanban, criação rápida de lead, ficha, histórico
  automático, atividades, propostas, motivos de perda, dashboard comercial
- **Tráfego**: o painel atual portado, agora lendo `ad_metrics_daily`, com o job
  de sincronização e o cadastro de contas por tela
- **Onboarding automático**: lead ganho → cliente (§22)

**Pronto quando:** o comercial abandona a planilha de leads.

### F3 — Operação (semana 6–7) · o módulo mais usado

- **CRM Operacional**: kanban, demandas, tipos, prioridade, subtarefas,
  comentários com menção, controle de tempo, área por colaborador
- **Agenda**: mês/semana/dia/lista, eventos, participantes, lembretes,
  recorrência, visão de gravações
- **Arquivos**: upload direto ao R2, pastas por cliente, vínculos, versões

**Pronto quando:** o Trello é fechado.

### F4 — Dinheiro e acessos (semana 8–9)

- **Financeiro**: receitas, despesas, categorias, contas a pagar e a receber,
  pagamento parcial, recorrências, fluxo de caixa, dashboard
- **Financeiro pessoal**: escopo separado, step-up, visão consolidada
- **Senhas**: cofre com criptografia em envelope, revelação auditada
- **CRM de Gestão**: visão de carteira, contratos, renovações, inadimplência

**Pronto quando:** a planilha financeira é aposentada.

### F5 — WhatsApp e estratégia (semana 10–13)

Fase mais longa e mais arriscada — por isso vem depois de o sistema já ser útil.

- **WhatsApp**: Cloud API, caixa de entrada, conversa, etiquetas, atribuição,
  integração com o CRM, criação de lead a partir da conversa
- **Campanhas**: modelos, seleção por filtro, limite de envio, opt-out
- **Estratégias**: ficha por cliente com salvamento automático e versões
- **Aprovações**: fluxo interno, versões, comentários

### F6 — Conhecimento (semana 14+)

- **Wiki**, **Pesquisa**, **Comunicação interna**
- Adaptador QR do WhatsApp, se a decisão for usá-lo
- Google Calendar bidirecional, Google Ads

### Depois — previsto, não prometido

Portal do cliente · app mobile · IA nas conversas · BI e relatórios avançados ·
emissão de cobrança · assinatura eletrônica · TikTok Ads · multiempresa ativo

---

## Regra de entrega

**Um módulo só está pronto quando o ciclo inteiro está pronto.** Da §38 do
briefing, transformada em checklist de aceite:

```
[ ] criar (com o mínimo de campos obrigatórios)
[ ] listar, filtrar, buscar, ordenar
[ ] abrir ficha
[ ] editar em linha e em formulário
[ ] excluir (lógico) e restaurar da lixeira
[ ] arquivar / duplicar, onde faz sentido
[ ] atribuir responsável
[ ] comentar e anexar
[ ] histórico automático
[ ] notificação dos eventos relevantes
[ ] permissão verificada no servidor, em toda leitura e escrita
[ ] estado vazio, carregando, erro, sem permissão e offline
[ ] responsivo até 768px
[ ] navegável por teclado
[ ] testes: unitário da regra, integração da permissão
```

Meio módulo com quinze telas é pior que um módulo inteiro com três — porque meio
módulo não substitui a ferramenta que estava sendo usada, e a equipe volta para
ela.

---

## Testes

Não perseguir cobertura. Testar o que quebra caro.

| Tipo | Ferramenta | Onde vale |
|---|---|---|
| **Unitário** | Vitest | regra de negócio pura: recorrência financeira, ordenação de kanban, conversão de lead, expansão de `rrule`, aritmética de centavos, `can()` |
| **Integração** | Vitest + Postgres em Testcontainers | tudo que toca o banco: escopo de tenant, escopo de cliente, exclusão lógica, transação de auditoria + outbox |
| **E2E** | Playwright | os 8 fluxos críticos abaixo |
| **Permissão** | Vitest, matriz gerada | papel × recurso × ação — ver [05](05-permissoes.md#testes-de-permissão) |
| **Carga** | k6, antes do WhatsApp | caixa de entrada com 50 mil mensagens; kanban com 500 cards |

### Os oito fluxos E2E

Todos rodam em cada PR. Se um quebrar, não entra.

1. Login, sessão, logout, sessão expirada
2. Criar lead com dois campos → mover no pipeline → ganhar → virar cliente com
   contrato e projeto
3. Criar demanda → atribuir → comentar com menção → concluir → notificação chega
4. Lançar despesa recorrente → gerar o mês seguinte → marcar como paga →
   fluxo de caixa muda
5. `DESIGNER` tenta acessar `/financeiro` → 404; busca por termo financeiro →
   zero resultados
6. Revelar credencial: step-up exigido → revelada → `credential_access_log`
   gravado
7. Upload de 50 MB → aparece na ficha do cliente → download por URL pré-assinada
8. WhatsApp: webhook recebido duas vezes com o mesmo `external_id` → **uma**
   mensagem na conversa

O oitavo é o teste que evita o bug mais chato do módulo de WhatsApp.

---

## Documentação a manter

Junto com o código, atualizada no mesmo PR que muda o comportamento.

| Documento | Conteúdo |
|---|---|
| `README.md` | o que é, como rodar em 5 minutos |
| `docs/instalacao.md` | pré-requisitos, banco local, seed, primeiro login |
| `docs/variaveis.md` | cada variável de ambiente, para que serve, como gerar |
| `docs/deploy.md` | Vercel + worker, migrations em produção, rollback |
| `docs/backup.md` | rotina, e **o procedimento de restauração testado** |
| `docs/permissoes.md` | matriz papel × permissão, gerada do código |
| `docs/integracoes.md` | como conectar Meta, WhatsApp, Google; como rotacionar token |
| `docs/arquitetura/` | estes documentos, revisados a cada decisão que mudar |
| `CHANGELOG.md` | por versão |

O de backup é o que mais importa e o que sempre falta: é consultado no pior dia
do ano, por alguém sob pressão. Ele descreve o procedimento **e** registra a data
do último teste de restauração.

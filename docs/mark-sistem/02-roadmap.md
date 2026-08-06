# MARK SISTEM — Riscos, Ordem de Desenvolvimento e MVP

Documento 3 de 3.

- [`00-arquitetura.md`](00-arquitetura.md) — arquitetura geral
- [`01-modelagem.md`](01-modelagem.md) — banco e permissões

---

## 1. Riscos técnicos

Ordenados por dano × probabilidade. Cada um tem mitigação decidida — nenhum
fica em aberto.

### 🔴 R1 — Banimento do número de WhatsApp

**Dano: alto. Probabilidade: alta se usarmos QR + disparo.**

Conectar por QR Code usa biblioteca não oficial que emula o WhatsApp Web. A Meta
detecta e bane — permanentemente, e o número comercial da agência vai junto.
Disparo em massa por esse caminho é o gatilho mais comum.

**Mitigação:** Cloud API oficial como padrão. Ponte QR existe atrás da mesma
interface, isolada no worker, e o esquema **não permite campanha sem template
aprovado** ([`01-modelagem.md` §7](01-modelagem.md#7-whatsapp)). Limite de envio
por hora, opt-out por contato, número de teste antes de qualquer campanha real.

**Se acontecer mesmo assim:** conectar outro número leva minutos, porque a
conversa pertence ao contato, não ao número. O histórico não se perde.

### 🔴 R2 — Vazamento do financeiro

**Dano: crítico. Probabilidade: média** — sistemas assim vazam pela rota nova
que ninguém lembrou de proteger, não por invasão.

**Mitigação:** cinco camadas descritas em
[`00-arquitetura.md` §9](00-arquitetura.md#financeiro--o-requisito-mais-afiado-do-briefing).
A que mais importa: a checagem mora em `packages/core/financeiro`, então
rota nova que não passe por lá simplesmente não tem como ler o dado. Mais a
matriz de permissão no CI, que reprova build com rota sem teste de autorização.

### 🔴 R3 — Perda de segredo do cofre

**Dano: crítico e irreversível.** KEK perdida = todas as senhas de todos os
clientes irrecuperáveis. KEK vazada = todas expostas.

**Mitigação:** KEK em variável de ambiente com cópia offline em cofre físico
desde o dia 1 (procedimento documentado em `docs/backup.md`), versionada
(`versao_kek`) para permitir rotação sem reescrever segredos. Migrar para AWS
KMS na fase 3, quando o custo operacional se justificar.

### 🟠 R4 — Rate limit da Meta / Google Ads

**Dano: médio. Probabilidade: alta.** A Graph API limita por app e por conta;
o painel atual já tocaria nesse teto com a carteira inteira.

**Mitigação:** sync em fila com backoff, dados servidos do banco, nunca da API
no caminho da tela. Consequência boa: a tela funciona com a Meta fora do ar.

### 🟠 R5 — Complexidade além do necessário

**Dano: alto (projeto que não entrega). Probabilidade: alta** — 17 módulos é um
escopo em que é fácil construir um ano sem nada em produção.

**Mitigação:** Fase 1 vai a produção em ~6 semanas com 5 módulos. Cada fase
seguinte entrega em produção. **Nada fica em branch por mais de duas semanas.**

### 🟠 R6 — Migração do painel atual quebrar o que funciona

**Dano: médio. Probabilidade: média.** O painel de tráfego está em uso hoje.

**Mitigação:** ele continua no ar, intocado, até o módulo novo passar em
comparação lado a lado com os mesmos números. Só então a URL antiga redireciona.

### 🟠 R7 — Vercel não sustenta processo persistente

**Dano: alto se descoberto tarde.** Socket de WhatsApp e worker de fila não
rodam em função serverless.

**Mitigação:** já resolvido no desenho — worker separado no Fly.io desde a fase
1, mesmo que a fase 1 quase não use fila. Descobrir isso na fase 5 seria
replanejar infra com o sistema em produção.

### 🟡 R8 — N+1 no Kanban e nas listas

**Mitigação:** DAL agrega por lote; teste de integração que conta consultas e
falha acima do esperado.

### 🟡 R9 — Migração de dados existentes

Clientes e tokens vivem em `META_TOKENS`; anotações, na tabela `anotacoes`.

**Mitigação:** script de importação idempotente na fase 1 — lê `META_TOKENS`,
cria `clientes`, cifra os tokens em `credenciais`, migra `anotacoes` para
`eventos`. Rodável quantas vezes for preciso.

### 🟡 R10 — Fuso horário

**Dano: médio, e insidioso** — aparece como "a demanda venceu ontem" em vez de
erro.

**Mitigação:** `timestamptz` sempre, UTC no banco, `America/Sao_Paulo` só na
formatação. Teste com data de virada de horário de verão.

### 🟡 R11 — Adoção pela equipe

Risco de produto, não de código, e é o que mais mata sistema interno.

**Mitigação:** ordem das fases segue o uso real. O operacional (fase 3) é o
módulo que a equipe abre todo dia — chega cedo. Importar dados existentes em vez
de pedir recadastro. Um colaborador acompanha cada fase como usuário-piloto.

### 🟡 R12 — Custo de armazenamento de mídia do WhatsApp

Áudios e vídeos de 4 números crescem rápido.

**Mitigação:** R2 tem egress zero; política de ciclo de vida move mídia com mais
de 12 meses para armazenamento frio.

---

## 2. Ordem de desenvolvimento

Seis fases. Cada uma vai a produção e é usada de verdade antes da seguinte.

### Fase 0 — Fundação (1 semana)

Monorepo, `packages/db` com migrações 1 e 2, `packages/core/contexto.ts` com
`pode()`, CI (lint, tipos, testes, orçamento de bundle), Sentry, worker vazio no
ar, banco Neon com branch de preview.

*Entrega: nada visível. É o que evita retrabalho nas cinco fases seguintes.*

### Fase 1 — Autenticação, clientes e tráfego (3 semanas)

Login com Auth.js + sessão em banco, migração de `DASH_USERS`. Papéis e
permissões. Casca da aplicação (sidebar, tema, ⌘K, notificações). CRUD de
clientes e contatos. **Migração do painel de tráfego** para dentro do sistema,
com o sync no worker. Script de importação do `META_TOKENS`.

*Entrega: a equipe faz login no MARK SISTEM e vê o painel de tráfego que já usa.
Substituição real, no primeiro mês.*

### Fase 2 — CRM de Vendas (3 semanas)

Pipeline Kanban com ordenação fracionária. Cadastro rápido de lead (nome +
telefone). Ficha completa. Linha do tempo automática via `eventos`. Atividades.
Propostas. Dashboard comercial. Busca global sobre leads, clientes e contatos.

*Entrega: o comercial sai da planilha.*

### Fase 3 — CRM Operacional e Agenda (4 semanas)

Quadro operacional, demandas, subtarefas, comentários com menção, controle de
tempo, área por colaborador, aprovações, gravações, agenda com as quatro
visualizações, notificações em tempo real por SSE, arquivos com upload direto
para R2.

*Entrega: Trello, ClickUp e as agendas paralelas saem do ar. É a fase de maior
impacto diário.*

### Fase 4 — Financeiro (3 semanas)

Lançamentos, categorias, recorrências, contas a pagar e receber, fluxo de caixa,
dashboard, RLS do escopo pessoal, área pessoal do proprietário, relatórios,
auditoria financeira. Cofre de senhas entra aqui — mesma disciplina de
segurança, mesma revisão.

*Entrega: controle financeiro fora da planilha, com isolamento real.*

**Esta fase leva revisão de segurança dedicada antes de ir a produção.**

### Fase 5 — WhatsApp (4 semanas)

Cloud API primeiro, ponte QR depois. Caixa de entrada, conversa, envio de mídia,
etiquetas, integração com a ficha do contato, criar lead em um clique,
campanhas com template e consentimento.

*Entrega: atendimento e CRM no mesmo lugar.*

### Fase 6 — Módulos de apoio (3 semanas)

Estratégia, pesquisa, Wiki, mural, onboarding automático completo, CRM de
gestão, relatórios avançados.

*Entrega: Notion e os documentos dispersos saem do ar.*

**Total: ~21 semanas** (~5 meses) para os 17 módulos, com produção contínua
desde a semana 4.

---

## 3. Escopo do MVP

O MVP são as fases 1 a 3 — **10 semanas**. É o corte em que o sistema já
substitui ferramentas de verdade.

### Dentro

| Módulo | O que entra |
|---|---|
| Autenticação | Login, sessão revogável, recuperação de senha, papéis |
| Estrutura | Sidebar, ⌘K, notificações, tema, responsivo |
| Clientes | CRUD, ficha, status, saúde, timeline, arquivos |
| Tráfego | Painel atual migrado + sync no worker |
| Vendas | Pipeline, leads, atividades, propostas, dashboard |
| Operacional | Quadro, demandas, subtarefas, comentários, tempo, aprovações |
| Agenda | Quatro visualizações, eventos, gravações, lembretes |
| Painel Geral | Cards clicáveis dos módulos acima |
| Busca | Global sobre leads, clientes, demandas, arquivos |
| Arquivos | Upload direto, pastas, versões, vínculos |

### Fora, e por quê

| Fora do MVP | Motivo |
|---|---|
| Financeiro | Maior risco de segurança; merece fase própria e revisão dedicada |
| WhatsApp | Maior risco técnico; não pode atrasar o resto |
| Cofre de senhas | Vai junto do financeiro, mesma disciplina |
| Wiki, mural, pesquisa, estratégia | Alto valor, zero urgência — os documentos atuais aguentam mais 10 semanas |
| Onboarding automático | Depende de vendas + operacional + financeiro maduros |
| IA | Fase 4 de produto; a arquitetura já reserva o lugar |

### Definição de pronto

Nenhuma funcionalidade é considerada entregue sem, além do caminho feliz
(requisito 38):

- criar, editar, excluir (lógico), arquivar, duplicar
- atribuir, mover, filtrar, buscar
- comentar, anexar, notificar
- evento na linha do tempo
- checagem de permissão em `core` **e** teste que prova a negativa
- os cinco estados de UI: carregando, vazio, erro, sem permissão, sucesso
- comportamento definido para perda de conexão

---

## 4. Marcos de validação

Cada fase só é aceita se passar nestes critérios objetivos.

| Fase | Critério |
|---|---|
| 0 | CI verde; migração sobe e desce; RLS nega acesso cruzado no teste |
| 1 | Equipe inteira logada; números do tráfego batem com o painel antigo |
| 2 | 50 leads reais no pipeline; comercial não abre mais a planilha |
| 3 | Todas as demandas da semana no sistema; Trello sem cards novos por 5 dias |
| 4 | Fechamento do mês feito no sistema; teste de invasão do financeiro reprovado |
| 5 | Uma semana sem queda de conexão; nenhum aviso da Meta |
| 6 | Onboarding de um cliente novo ponta a ponta, sem passo manual |

---

## 5. Decisões que precisam de você

Cinco pontos em que a decisão é de negócio, não de engenharia. As três primeiras
travam a fase 1 e 5; as outras podem esperar.

**1. WhatsApp — Cloud API ou QR?**
Recomendo Cloud API. Custo aproximado: R$ 0,08 por conversa iniciada pela
empresa (conversa iniciada pelo cliente nas primeiras 24h é gratuita). Para uma
agência com ~500 conversas/mês, algo em torno de R$ 40/mês — barato perto do
risco de perder o número. O ponto que exige sua decisão: **migrar um número
existente para a Cloud API tira ele do aplicativo do celular.** Se algum número
precisa continuar no celular, ele fica na ponte QR, com o risco declarado.

**2. Os números atuais migram ou compramos novos?**
Recomendo números novos para os fluxos automatizados (comercial e suporte),
mantendo os atuais no celular. Zero interrupção.

**3. Quem é o proprietário no sistema?**
`organizacoes.proprietario_id` define quem enxerga o financeiro pessoal. É a
única permissão não delegável. Presumo que seja você — confirme.

**4. Migramos histórico financeiro?**
Se existe planilha com histórico, importar dá base de comparação desde o
primeiro mês. Se for muito bagunçada, começar do zero é mais barato que
higienizar.

**5. Aprovação de cliente: interna ou portal externo?**
No MVP, aprovação é interna (alguém da equipe registra o retorno do cliente).
Portal externo é fase 7 — a modelagem já comporta, via papel `cliente_externo`
com escopo.

---

## 6. Resumo executivo

| | |
|---|---|
| **Stack** | Next.js 15 · React 19 · TypeScript · Drizzle · PostgreSQL · Redis · R2 |
| **Infra** | Vercel (web) + Fly.io (worker) + Neon + Upstash + Cloudflare |
| **Custo** | ~US$ 65/mês |
| **MVP** | 10 semanas — autenticação, clientes, tráfego, vendas, operacional, agenda |
| **Completo** | ~21 semanas — 17 módulos |
| **Primeira entrega em produção** | Semana 4 |
| **Riscos críticos** | WhatsApp (banimento), financeiro (vazamento), cofre (perda de chave) |
| **Decisão estrutural** | Contato como âncora de identidade; autorização na camada de dados; outbox para efeitos externos |

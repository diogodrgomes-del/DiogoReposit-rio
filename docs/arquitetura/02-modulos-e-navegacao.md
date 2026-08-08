# 02 — Módulos e navegação

## Mapa dos módulos

Dezessete módulos, agrupados em cinco domínios. O agrupamento não é
organizacional — é a fronteira de código: cada domínio é uma pasta em
`packages/domain/`, com suas regras e seus tipos, e as dependências entre
domínios são explícitas.

```
COMERCIAL           OPERAÇÃO            CLIENTE            DINHEIRO         SISTEMA
├─ 02 CRM Vendas    ├─ 07 Operacional   ├─ 06 Clientes     ├─ 05 Financeiro ├─ 01 Painel Geral
├─ 03 WhatsApp      ├─ 08 Agenda        ├─ 09 Estratégias  │   ├─ empresa   ├─ 14 Comunicação
└─ 04 CRM Gestão    ├─ 13 Aprovações    ├─ 10 Tráfego      │   └─ pessoal   ├─ 16 Wiki
                    └─ (gravações)      ├─ 11 Arquivos     └─ (notificações)├─ 15 Pesquisa
                                        └─ 12 Senhas                       └─ 17 Configurações
```

### Regra de dependência

```
SISTEMA  ←  todos podem depender
CLIENTE  ←  COMERCIAL, OPERAÇÃO, DINHEIRO dependem
DINHEIRO →  não pode ser importado por ninguém, só chamado por interface
```

`DINHEIRO` é o único domínio com dependência de mão única obrigatória: nenhum
outro módulo importa modelos financeiros. Quando o CRM de Gestão precisa saber
se um cliente está inadimplente, ele chama
`financeiro.statusCobranca(clienteId)` e recebe `"em_dia" | "atrasado"` — nunca
um valor. É assim que se cumpre "não visualizar valores em outros módulos"
sem depender de alguém lembrar de esconder o campo. Detalhe em
[05](05-permissoes.md#isolamento-do-financeiro).

---

## Os 17 módulos

| # | Módulo | Entidades principais | Depende de | MVP |
|---|---|---|---|---|
| 01 | **Painel Geral** | — (agrega) | todos | ✅ F1 |
| 02 | **CRM de Vendas** | `leads`, `pipelines`, `activities`, `proposals` | Clientes | ✅ F2 |
| 03 | **WhatsApp** | `wa_numbers`, `wa_conversations`, `wa_messages` | CRM Vendas, Clientes | F5 |
| 04 | **CRM de Gestão** | `contracts`, `plans` (visão) | Clientes, Financeiro (interface) | F4 |
| 05 | **Financeiro** | `fin_entries`, `fin_payments`, `fin_categories` | Clientes | ✅ F4 |
| 06 | **Clientes** | `clients`, `contracts`, `client_contacts` | — | ✅ F2 |
| 07 | **CRM Operacional** | `demands`, `subtasks`, `comments`, `time_entries` | Clientes | ✅ F3 |
| 08 | **Agenda** | `events`, `event_participants`, `recording_details` | Clientes, Operacional | ✅ F3 |
| 09 | **Estratégias** | `client_strategies` + versões | Clientes | F5 |
| 10 | **Gestão de Tráfego** | `ad_accounts`, `ad_metrics_daily`, `traffic_notes` | Clientes | ✅ F2¹ |
| 11 | **Arquivos** | `files`, `folders`, `file_links` | Clientes | ✅ F3 |
| 12 | **Senhas e Acessos** | `credentials`, `credential_access_log` | Clientes | ✅ F4 |
| 13 | **Aprovações** | `approvals`, `approval_assets` | Operacional, Arquivos | F5 |
| 14 | **Comunicação Interna** | `posts`, `comments` | — | F6 |
| 15 | **Pesquisa** | `research_items` | Clientes, Estratégias | F6 |
| 16 | **Wiki** | `wiki_pages`, `wiki_page_versions` | — | F6 |
| 17 | **Configurações** | `organizations`, `memberships`, preferências | — | ✅ F1 |

¹ Entra cedo porque **já existe** — é o painel atual, portado.

---

## Navegação

### Estrutura da tela

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⌘K Buscar…            MARK SISTEM                🔔 3    ◐   [DG ▾] │  ← topo, 48px, fixo
├────────────┬─────────────────────────────────────────────────────────┤
│            │                                                          │
│  Painel    │                                                          │
│            │                                                          │
│  COMERCIAL │                  conteúdo do módulo                      │
│  Vendas    │                                                          │
│  WhatsApp ³│                                                          │
│  Gestão    │                                                          │
│            │                                                          │
│  OPERAÇÃO  │                                                          │
│  Demandas  │                                                          │
│  Agenda    │                                                          │
│  Aprovações│                                                          │
│            │                                                          │
│  CLIENTES  │                                                          │
│  Clientes  │                                                          │
│  Arquivos  │                                                          │
│            │                                                          │
│  Financeiro│  ← só aparece com permissão. Não é item desabilitado:    │
│            │    quem não pode não sabe que existe                     │
│  ─────     │                                                          │
│  Wiki      │                                                          │
│  Config.   │                                                          │
└────────────┴─────────────────────────────────────────────────────────┘
   240px         restante, max-width 1440px centrado
```

A barra lateral colapsa para 56px (só ícones) com `⌘\`, e vira gaveta no mobile.
O estado fica em cookie, então a primeira renderização no servidor já vem certa
— sem o pulo de layout que aparece quando isso vive em `localStorage`.

### Rotas

```
/                              Painel Geral
/login  /esqueci  /convite/[token]

/vendas                        pipeline (kanban) — tela padrão
/vendas/dashboard              indicadores comerciais
/vendas/lead/[id]              ficha do lead
/vendas/propostas
/vendas/propostas/[id]
/vendas/atividades

/whatsapp                      caixa de entrada
/whatsapp/[conversaId]         conversa aberta (layout persistente)
/whatsapp/numeros              conexões
/whatsapp/campanhas

/gestao                        CRM de Gestão

/clientes                      lista
/clientes/[id]                 visão geral do cliente
/clientes/[id]/contrato
/clientes/[id]/estrategia
/clientes/[id]/trafego
/clientes/[id]/trafego/[contaId]
/clientes/[id]/demandas
/clientes/[id]/arquivos
/clientes/[id]/acessos         senhas — exige re-autenticação
/clientes/[id]/pesquisa
/clientes/[id]/timeline

/demandas                      kanban operacional — tela padrão
/demandas/lista                tabela com filtros
/demandas/[id]                 ficha da demanda
/demandas/equipe               visão por colaborador
/demandas/equipe/[userId]      "Área do João"

/agenda                        mês
/agenda/semana  /agenda/dia  /agenda/lista
/agenda/gravacoes              visão específica de gravações
/agenda/evento/[id]

/aprovacoes  /aprovacoes/[id]

/financeiro                    dashboard — bloqueado no middleware e na query
/financeiro/receitas
/financeiro/despesas
/financeiro/a-pagar
/financeiro/a-receber
/financeiro/fluxo
/financeiro/pessoal            exclusivo do proprietário
/financeiro/categorias

/arquivos
/wiki  /wiki/[slug]
/mural
/configuracoes/{perfil,organizacao,usuarios,permissoes,pipelines,planos,
                categorias,etiquetas,modelos,integracoes,notificacoes,auditoria}
```

### Navegação por card do painel

Todo indicador do Painel Geral é um link para a lista já filtrada — o filtro vai
na URL, então o estado é compartilhável e o botão voltar funciona:

| Card | Leva para |
|---|---|
| Demandas atrasadas | `/demandas/lista?prazo=atrasado&responsavel=eu` |
| Leads sem retorno | `/vendas?semRetorno=7d` |
| Contas a vencer | `/financeiro/a-pagar?vence=7d` |
| Reuniões do dia | `/agenda/dia` |
| Clientes inadimplentes | `/gestao?status=inadimplente` |
| Gravações do dia | `/agenda/gravacoes?data=hoje` |

Um card sem permissão não aparece. Não vem cinza, não vem com cadeado.

### Busca global (⌘K / Ctrl+K)

Abre de qualquer tela. Três seções, nessa ordem:

1. **Ações** — "Criar lead", "Nova demanda", "Lançar despesa". Digitando `>`
   filtra só ações.
2. **Resultados** — leads, clientes, demandas, arquivos, propostas, páginas da
   wiki, conversas. Agrupados por tipo, com atalho de tipo (`@cliente`, `#demanda`).
3. **Recentes** — últimos 10 itens abertos por este usuário.

Os resultados já vêm filtrados por permissão **na query**, não depois. Detalhes
em [07](07-desempenho.md#busca-global).

### Atalhos

| Atalho | Ação |
|---|---|
| `⌘K` | busca global |
| `⌘\` | colapsar barra lateral |
| `C` então `L` | criar lead |
| `C` então `D` | criar demanda |
| `C` então `E` | criar evento |
| `G` então `D` | ir para demandas |
| `G` então `V` | ir para vendas |
| `/` | focar filtro da lista atual |
| `Esc` | fechar modal / sair de edição em linha |

Sequências de duas teclas (estilo Linear e GitHub) em vez de `⌘+letra`, que
colide com atalho de navegador.

---

## Padrões de interação

Aplicam-se a todos os módulos. Estão aqui, e não repetidos módulo a módulo,
porque a consistência é o que faz o sistema parecer rápido.

**Criação rápida.** Todo módulo tem um caminho de criação em um campo só. O
formulário completo é opcional e sempre acessível depois. Lead pede nome e
telefone; demanda pede título e cliente. O resto se preenche na ficha, em linha.

**Salvamento automático.** Campos de texto longo (estratégia, wiki, observações,
briefing) salvam com debounce de 800 ms e mostram "salvo" discreto. Nunca há
botão Salvar que possa ser esquecido.

**Edição em linha.** Em tabela e em ficha, clicar no valor edita o valor. `Enter`
confirma, `Esc` cancela. Nada de abrir modal para trocar um responsável.

**UI otimista.** Arrastar card, marcar tarefa, trocar responsável, marcar conta
como paga: a tela muda na hora, o servidor confirma depois. Se falhar, reverte e
mostra o erro com botão "tentar de novo".

**Rascunho preservado.** Formulário aberto salva o conteúdo em `localStorage` por
chave de rota. Fechar a aba sem querer não perde o que foi digitado.

**Lixeira, não exclusão.** Tudo que o usuário apaga vai para `deleted_at` e some
da tela, com "desfazer" no toast por 10 s e lixeira por 30 dias em
Configurações. Purga definitiva só por rotina do worker.

**Estados obrigatórios.** Nenhuma tela vai para produção sem os cinco:
carregando (skeleton com a forma do conteúdo real), vazio (com a ação que
resolve), erro (com o que fazer), sem permissão (sem vazar que o item existe) e
offline (banner e fila local das escritas otimistas).

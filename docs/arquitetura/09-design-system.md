# 09 — Design system

Referências: Linear, Stripe Dashboard, Vercel, Notion. O que essas interfaces têm
em comum não é a paleta — é **densidade alta com pouco ruído visual**. Muita
informação por tela, quase nenhuma borda, hierarquia por espaçamento e peso de
texto em vez de caixas e cores.

## Cores

Azul `#2563EB` como principal, conforme o briefing. Tokens em CSS, nunca cor
literal em componente.

```css
:root {
  /* Marca */
  --azul-50:#EFF6FF; --azul-100:#DBEAFE; --azul-500:#3B82F6;
  --azul-600:#2563EB;  /* principal */
  --azul-700:#1D4ED8; --azul-950:#172554;

  /* Neutros — a espinha dorsal da interface */
  --cinza-50:#F9FAFB;  --cinza-100:#F3F4F6; --cinza-200:#E5E7EB;
  --cinza-300:#D1D5DB; --cinza-400:#9CA3AF; --cinza-500:#6B7280;
  --cinza-600:#4B5563; --cinza-700:#374151; --cinza-900:#111827;

  /* Semânticas */
  --sucesso:#059669;  --alerta:#D97706;  --erro:#DC2626;  --info:#0284C7;

  /* Papéis */
  --fundo:#FFFFFF;           --fundo-sutil:var(--cinza-50);
  --fundo-elevado:#FFFFFF;   --borda:var(--cinza-200);
  --texto:var(--cinza-900);  --texto-secundario:var(--cinza-500);
  --texto-terciario:var(--cinza-400);
  --anel-foco:var(--azul-600);
}
```

**Regras.** O azul é para ação e estado ativo, não para decoração. Verde,
âmbar e vermelho carregam significado — nunca são escolha estética. Nenhuma cor
comunica sozinha: status sempre tem cor **e** rótulo, porque cerca de 8% dos
homens têm alguma deficiência de visão de cores, e um kanban inteiro codificado
só por cor é ilegível para essas pessoas. O painel atual já usa paleta validada
para daltonismo; isso se mantém.

**Tema escuro.** Os papéis já estão separados dos valores, então o tema escuro é
uma redefinição de tokens em `@media (prefers-color-scheme: dark)` mais
`[data-tema="escuro"]`, sem tocar em componente. O painel de hoje já tem os dois
temas; a paridade é mantida.

### Cores de status

| Estado | Fundo | Texto | Onde |
|---|---|---|---|
| Neutro | `cinza-100` | `cinza-700` | rascunho, previsto, planejada |
| Ativo | `azul-50` | `azul-700` | em andamento, enviada, conectado |
| Sucesso | `#ECFDF5` | `#065F46` | aprovado, pago, recebido, ativo |
| Alerta | `#FFFBEB` | `#92400E` | aguardando, em risco, vence hoje |
| Erro | `#FEF2F2` | `#991B1B` | atrasado, perdido, reprovado, inadimplente |

Uma tabela, aplicada aos status de todos os módulos. É o que faz "atrasado"
parecer igual no financeiro e no operacional.

---

## Tipografia

**Inter** (`next/font`, sem requisição externa), tabular nos números.

| Papel | Tamanho / altura | Peso |
|---|---|---|
| Título de página | 20 / 28 | 600 |
| Título de seção | 16 / 24 | 600 |
| Corpo | 14 / 20 | 400 |
| Corpo forte | 14 / 20 | 500 |
| Secundário | 13 / 18 | 400 |
| Legenda / rótulo | 12 / 16 | 500 |
| Métrica grande | 28 / 32 | 600, tabular |
| Mono (valor, ID) | 13 / 18 | JetBrains Mono |

Base 14px, não 16px. É a densidade de Linear e Stripe, e é o certo para um
sistema de trabalho: cabe mais linha útil sem rolagem. Interface pública seria
16px; esta não é.

Número **sempre tabular** (`font-variant-numeric: tabular-nums`). Sem isso,
coluna de valores fica desalinhada e a tabela vira ruído.

---

## Espaçamento e forma

Escala de 4px: `4 8 12 16 20 24 32 40 48 64`. Nada fora dela.

| Elemento | Valor |
|---|---|
| Raio — botão, campo, badge | 6px |
| Raio — card, modal, popover | 8px |
| Raio — avatar | círculo |
| Borda | 1px `--borda` |
| Sombra — card | `0 1px 2px rgb(0 0 0 / .05)` |
| Sombra — popover | `0 4px 12px rgb(0 0 0 / .08)` |
| Sombra — modal | `0 16px 48px rgb(0 0 0 / .12)` |
| Altura — barra de topo | 48px |
| Largura — barra lateral | 240px (56px colapsada) |
| Altura — linha de tabela | 44px |
| Altura — botão e campo | 36px (32px compacto) |

Sombra é para elevação, não para enfeite. Um card numa lista **não tem sombra** —
tem borda. Sombra só quando o elemento flutua de verdade sobre o conteúdo.

---

## Componentes

Base shadcn/ui — código no repositório, não dependência, o que permite adaptar
sem fork. Ícones Lucide, 16px em interface, 20px em navegação, `stroke-width` 2.

### Primitivos

`Button` `Input` `Textarea` `Select` `Combobox` `Checkbox` `Radio` `Switch`
`DatePicker` `Slider` `Badge` `Avatar` `Tooltip` `Popover` `Dropdown` `Dialog`
`Sheet` `Tabs` `Accordion` `Toast` `Skeleton` `Separator` `Progress`

**Botão** — quatro variantes e mais nenhuma: `primary` (azul, uma por tela),
`secondary` (borda cinza), `ghost` (só texto, para ação em tabela), `destructive`
(vermelho, sempre com confirmação). Estados: normal, hover, ativo, foco (anel
azul de 2px — visível, sempre), desabilitado, carregando (spinner no lugar do
ícone, largura preservada para não pular).

**Campo** — rótulo acima, ajuda abaixo em `--texto-secundario`, erro substitui a
ajuda em `--erro`, borda vermelha e `aria-invalid`. O erro aparece no `blur`, não
a cada tecla — validar enquanto a pessoa digita é hostil.

### Compostos, específicos do MARK SISTEM

| Componente | Onde aparece |
|---|---|
| `DataTable` | filtro na URL, ordenação, seleção múltipla, virtualização, colunas configuráveis, densidade |
| `KanbanBoard` | drag-and-drop, ordenação fracionária, otimista, virtualizado por coluna |
| `EntityCard` | card de lead e de demanda — mesma anatomia, campos diferentes |
| `ClientePicker` | combobox com busca, avatar e status |
| `UsuarioPicker` | combobox com avatar e carga atual |
| `StatusBadge` | tabela de status acima, cor + rótulo |
| `PrioridadeTag` | discreta: barra de 3px à esquerda do card, não etiqueta colorida |
| `MoneyInput` | máscara pt-BR, guarda centavos, oculta quando falta permissão |
| `DateRangePicker` | presets do Gerenciador — **reaproveita `src/lib/presets.ts`** |
| `RichEditor` | TipTap, JSON, menções, anexo colado, salvamento automático |
| `FileDropzone` | upload direto ao R2, progresso, miniatura |
| `Timeline` | histórico automático de lead, cliente e demanda |
| `CommentThread` | menções, respostas, resolução, edição |
| `CommandMenu` | ⌘K |
| `EmptyState` | ilustração leve, uma frase, uma ação |
| `PermissionGate` | esconde por `can()` — nunca desabilita, para não revelar o que existe |

### Anatomia do card de kanban

```
┌────────────────────────────────────┐
│▎Refazer feed de dezembro           │  ← barra de prioridade 3px + título 14/500
│ Casa Carvalho                      │  ← cliente, 13px, --texto-secundario
│                                    │
│ 🎨 Design    ⏱ 12 dez         [MB] │  ← tipo · prazo · avatar 24px
└────────────────────────────────────┘
```

Cinco informações, não doze. Card de kanban é para escolher o que abrir, não
para conter tudo. Prioridade é a barra à esquerda: presente na visão periférica,
ausente da leitura.

---

## Movimento

Discreto e rápido. Animação lenta em ferramenta de uso diário vira irritação na
décima vez.

| Interação | Duração | Curva |
|---|---|---|
| Hover, foco | 100 ms | `ease-out` |
| Popover, dropdown | 150 ms | `ease-out` |
| Modal | 200 ms | `cubic-bezier(.16,1,.3,1)` |
| Gaveta lateral | 250 ms | idem |
| Toast | 200 ms entrando, 150 ms saindo | |
| Card arrastado | segue o cursor, sem transição | — |

Framer Motion só em modal, gaveta e reordenação de lista. O resto é transição
CSS. `prefers-reduced-motion` respeitado: tudo vira 0 ms, sem exceção.

---

## Responsividade

`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`

Desktop primeiro, conforme o briefing — mas com adaptação real, não encolhimento.

| Faixa | O que muda |
|---|---|
| **≥ 1280** | layout completo, barra lateral aberta, tabela com todas as colunas |
| **1024–1279** | barra lateral colapsada em ícones, tabela oculta colunas secundárias |
| **768–1023** | barra lateral vira gaveta; kanban rola na horizontal, uma coluna por vez |
| **< 768** | navegação inferior com 5 destinos; tabela vira lista de cards; ficha em tela cheia; ⌘K vira botão de busca |

Três telas precisam funcionar de verdade no celular, porque são as que se usa
fora do escritório: **WhatsApp** (conversa em tela cheia, é o caso de uso
principal do celular), **Agenda** (visão do dia) e **Demandas** (minhas
demandas, marcar como concluída). Financeiro, configurações e wiki podem ser
apenas utilizáveis.

---

## Acessibilidade

Não é conformidade — é o que faz o sistema utilizável com teclado, que é como
alguém que usa a ferramenta oito horas por dia quer usá-la.

- Contraste mínimo 4.5:1 em texto, 3:1 em elemento de interface. Os tokens acima
  passam.
- Foco **sempre visível**: anel azul de 2px com deslocamento. Nunca
  `outline: none` sem substituto.
- Navegação completa por teclado, inclusive kanban (mover card com
  `Espaço` + setas).
- `aria-live="polite"` nos toasts, `role="alert"` em erro de formulário.
- Modal com foco preso e devolvido ao elemento de origem ao fechar.
- Alvo de toque mínimo de 44px no mobile.
- Nada comunicado só por cor.

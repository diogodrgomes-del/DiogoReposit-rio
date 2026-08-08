# 05 — Usuários e permissões

## Modelo

Três camadas, avaliadas nesta ordem:

```
1. PAPEL       define o conjunto base de permissões
2. EXCEÇÃO     permission_grants ALLOW/DENY sobrescreve caso a caso
3. ESCOPO      client_assignments limita a quais clientes se aplica
```

Papel sozinho é rígido demais (o designer que também cuida do financeiro de um
cliente vira um papel novo, e daí a dez papéis). Permissão avulsa sozinha é
ingerenciável (onze pessoas × sessenta permissões). As três camadas juntas
cobrem o caso real de uma agência sem virar um sistema de ACL para administrar.

---

## Papéis

| Papel | Enxerga | Não enxerga |
|---|---|---|
| `PROPRIETARIO` | tudo, inclusive financeiro pessoal | — |
| `ADMIN` | tudo, exceto financeiro pessoal | financeiro pessoal |
| `GESTOR` | todos os clientes, operação, comercial, agenda; financeiro só status | valores financeiros, senhas, config |
| `COMERCIAL` | CRM de vendas inteiro, WhatsApp comercial, clientes (leitura) | financeiro, senhas, operação de outros |
| `FINANCEIRO` | financeiro empresarial inteiro, clientes (leitura) | pessoal, senhas, operação |
| `TRAFEGO` | tráfego e estratégia dos clientes atribuídos, demandas próprias | financeiro, senhas de outros clientes |
| `SOCIAL` / `DESIGNER` / `EDITOR` / `FILMMAKER` | demandas próprias, clientes atribuídos, arquivos, agenda, aprovações | financeiro, senhas, comercial |
| `COLABORADOR` | só o que for atribuído explicitamente | resto |

Papéis são **constantes no código**, não linhas no banco — versionadas, testáveis
e revisáveis em pull request. `permission_grants` cobre a exceção sem inventar
papel novo.

## Permissões

Formato `recurso:acao`, catálogo em `packages/auth/permissions.ts`:

```ts
export const P = {
  leads:        ['ler','criar','editar','excluir','mover','atribuir','exportar'],
  clientes:     ['ler','criar','editar','excluir','ver_contrato','exportar'],
  demandas:     ['ler','ler_todas','criar','editar','excluir','atribuir','aprovar'],
  agenda:       ['ler','ler_todas','criar','editar','excluir'],
  arquivos:     ['ler','enviar','baixar','excluir'],
  credenciais:  ['ler','revelar','criar','editar','excluir'],
  aprovacoes:   ['ler','criar','decidir'],
  whatsapp:     ['ler','ler_todas','enviar','gerenciar_numeros','campanhas'],
  trafego:      ['ler','editar','ver_investimento'],
  estrategia:   ['ler','editar'],
  wiki:         ['ler','editar','publicar'],
  'financeiro.empresa': ['ler','criar','editar','excluir','exportar'],
  'financeiro.pessoal': ['ler','criar','editar','excluir'],
  organizacao:  ['ler','editar','convidar','gerenciar_permissoes','ver_auditoria'],
} as const
```

Alguns merecem explicação:

- **`credenciais:ler` vs `credenciais:revelar`** — ver que existe uma conta do
  Instagram do cliente é uma coisa; ver a senha é outra. São permissões
  diferentes, e `revelar` ainda exige re-autenticação.
- **`demandas:ler` vs `demandas:ler_todas`** — quem tem só `ler` vê as demandas
  em que está envolvido. `ler_todas` é para gestão.
- **`trafego:ver_investimento`** — dá para ver CPL, CTR e resultado sem ver
  quanto o cliente investe. Útil para social media e editor.

## `can()` — um só lugar decide

```ts
can(actor, 'financeiro.empresa:ler')          // permissão de módulo
can(actor, 'demandas:editar', demanda)        // com recurso: aplica escopo
```

Assinatura única, usada por Server Action, Route Handler, Server Component e
worker. A UI usa `can()` para **esconder**; o servidor usa `can()` para **negar**.
Esconder botão no cliente não é segurança — é cortesia. A negação real acontece
sempre no servidor, em toda escrita e em toda leitura.

Regra de código: **nenhuma Server Action começa sem uma chamada a `can()`**. Uma
regra de lint personalizada verifica isso e quebra o build se faltar.

## Escopo por cliente

`client_assignments` liga um `membership` a clientes. Não é filtro de tela — é
predicado de query:

```ts
const escopo = clientesVisiveis(actor)
// PROPRIETARIO/ADMIN/GESTOR → undefined (sem restrição)
// demais                    → { client_id: { in: [...] } }

prisma.demands.findMany({ where: { ...escopo, stage_id } })
```

O predicado entra no `where`, então o banco nunca devolve a linha. Não existe o
caminho "veio do banco e a tela escondeu" — que é como dado vaza por endpoint de
API, por exportação e por busca.

---

## Isolamento do financeiro

O briefing (§13) é específico: quem não tem acesso não pode visualizar,
pesquisar, acessar por URL, exportar, receber notificação, nem ver valores em
outros módulos. Isso é mais que uma flag de permissão. São **cinco barreiras**:

**1. Rota.** O middleware bloqueia `/financeiro/*` antes de renderizar. Sem
permissão, é 404 — não 403. Um 403 confirma que a página existe.

**2. Dados.** O schema `financeiro` é acessado só por `packages/domain/financeiro`,
e toda função ali começa checando `financeiro.empresa:ler`. Não há query
financeira fora dessa pasta.

**3. Fronteira de módulo.** Outros domínios não importam modelos financeiros.
Importam `financeiro/public.ts`, que expõe só isto:

```ts
export function statusCobranca(clienteId): 'em_dia' | 'atrasado' | 'sem_contrato'
export function diasDeAtraso(clienteId): number
export function temPendencia(clienteId): boolean
```

Nenhuma dessas devolve valor monetário. É assim que o CRM de Gestão mostra
"cliente inadimplente" sem que o dado de quanto ele deve chegue perto do módulo.
Uma regra ESLint `no-restricted-imports` quebra o build se alguém importar
`domain/financeiro/lancamento` de fora.

**4. Notificação.** `notifications.permissao_exigida` é checada na **entrega**.
O payload nem sai do worker para quem não pode receber.

**5. Busca.** `search_index` tem coluna `permissao`, e a query da busca global
sempre inclui `AND (permissao IS NULL OR permissao = ANY($permissoes_do_usuario))`.
Buscar "Casa Carvalho" não devolve a fatura da Casa Carvalho para o designer.

### Financeiro pessoal

Restrição mais forte ainda: só o `PROPRIETARIO`.

```ts
// packages/domain/financeiro/pessoal.ts
function assertPessoal(actor) {
  if (actor.papel !== 'PROPRIETARIO')  throw new NotFound()
  if (!actor.stepUpRecente(15 * 60))   throw new StepUpRequired()
}
```

E o predicado é sempre `escopo = 'PESSOAL' AND owner_user_id = actor.id`. Mesmo
o proprietário de outra organização não alcança. `ADMIN` não alcança. Nem o
`PROPRIETARIO` alcança sem ter digitado a senha nos últimos 15 minutos.

A **visão consolidada** (§13.4) é montada em memória, a partir das duas consultas
separadas, dentro da função que já validou as duas permissões. Não existe query
que junte pessoal e empresarial no banco.

**Ressalva honesta:** guardar finanças pessoais no mesmo banco da empresa é
conveniente e é o que foi pedido. O risco residual é que qualquer pessoa com
acesso administrativo ao banco (você, e quem operar a infraestrutura) enxerga
tudo, independente do que o aplicativo faz. Se um dia isso incomodar, a saída é
criptografar `fin_entries` de escopo pessoal com uma chave derivada da senha do
proprietário — ao custo de não dar para relatar nem indexar esses lançamentos.
Não recomendo agora; registro para que a decisão seja consciente.

---

## Fluxo de autorização de uma requisição

```
Requisição
   │
   ├─ middleware        sessão válida?              → não: /login ou 401
   │                    rota exige módulo?          → não permitido: 404
   │
   ├─ layout (app)      monta TenantContext:
   │                    { orgId, userId, papel, permissoes[], clientesVisiveis[] }
   │                    — uma consulta, em cache de requisição
   │
   ├─ Server Action     can(actor, permissao)       → não: throw Forbidden
   │                    Zod.parse(input)            → inválido: erro de campo
   │
   ├─ domain            regra de negócio
   │
   └─ db (forTenant)    organization_id injetado
                        escopo de cliente no where
                        RLS como rede de proteção
                        audit_logs + outbox na mesma transação
```

`TenantContext` é resolvido uma vez por requisição e memoizado com `cache()` do
React. Sem isso, uma tela com 12 componentes de servidor faria 12 consultas de
permissão.

---

## Convite e ciclo de vida

Não há tela de cadastro público. Usuário entra por convite:
`ADMIN` cria o convite com papel e clientes → e-mail com token de 48 h →
a pessoa define a senha → `membership` criada.

**Desligamento:** `membership.ativo = false` **e** revogação de todas as sessões
daquele usuário. Um só dos dois deixa a pessoa dentro do sistema até o cookie
expirar — 12 horas em que ela ainda lê tudo. Uma ação, as duas coisas.

Registros criados pela pessoa permanecem (`criado_por` continua apontando para
ela); a conta some das listas de atribuição.

---

## Testes de permissão

A suíte que mais importa. Para cada papel × cada rota × cada ação, uma asserção
de permitido/negado, gerada a partir de uma tabela — não escrita à mão:

```ts
test.each(matrizDePermissoes)(
  '%s em %s:%s → %s',
  async (papel, recurso, acao, esperado) => {
    expect(can(atorCom(papel), `${recurso}:${acao}`)).toBe(esperado)
  }
)
```

Mais três testes de integração que valem por cem unitários:

1. `DESIGNER` faz `GET /financeiro` → **404** (não 403, não 200).
2. `TRAFEGO` busca `⌘K` por termo que existe só em lançamento financeiro →
   **zero resultados**.
3. `COLABORADOR` sem `client_assignment` chama a Server Action de editar demanda
   de outro cliente por ID direto → **Forbidden**, e nada mudou no banco.

O terceiro é o teste que pega o erro clássico: a tela esconde, a action não checa.

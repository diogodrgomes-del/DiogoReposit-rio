import { ocultarAoNegar } from "./permissoes";

/**
 * Quem está pedindo, e o que pode.
 *
 * Montado uma vez por requisição, a partir da sessão, e repassado a toda função
 * de `@mark/core`. Nenhuma função de negócio lê sessão, cookie ou cabeçalho:
 * elas recebem este objeto. É o que permite a mesma regra rodar na web, no
 * worker e num script de manutenção sem reescrever autorização.
 */
export type Contexto = {
  organizacaoId: string;
  usuarioId: string;
  /** Permissões concedidas pelo papel. Pode conter curingas: `vendas.*`, `*`. */
  permissoes: ReadonlySet<string>;
  /** Clientes visíveis. `null` = todos (nenhum escopo restringe este membro). */
  clientesPermitidos: ReadonlySet<string> | null;
  /** Vem de `organizacoes.proprietario_id`, nunca da tabela de papéis. */
  ehProprietario: boolean;
};

export type Alvo = {
  clienteId?: string | null;
  /** Dono do recurso, para permissões que distinguem "próprio" de "da equipe". */
  responsavelId?: string | null;
};

export class ErroDeAutorizacao extends Error {
  readonly permissao: string;
  /** Verdadeiro quando negar não deve confirmar que o recurso existe (→ 404). */
  readonly ocultar: boolean;

  constructor(permissao: string, ocultar: boolean) {
    super(`Sem permissão: ${permissao}`);
    this.name = "ErroDeAutorizacao";
    this.permissao = permissao;
    this.ocultar = ocultar;
  }
}

/**
 * Confere se o conjunto concedido cobre a permissão, expandindo curingas do
 * mais específico para o mais amplo: `vendas.lead.editar` é atendida por
 * `vendas.lead.*`, por `vendas.*` ou por `*`.
 */
function concede(concedidas: ReadonlySet<string>, permissao: string): boolean {
  if (concedidas.has(permissao)) return true;
  if (concedidas.has("*")) return true;

  const partes = permissao.split(".");
  for (let i = partes.length - 1; i > 0; i--) {
    if (concedidas.has(`${partes.slice(0, i).join(".")}.*`)) return true;
  }
  return false;
}

/**
 * A única pergunta de autorização do sistema.
 *
 * Roda no servidor como barreira e no cliente apenas para esconder botão. O
 * cliente esconder é conveniência; o servidor recusar é a segurança — e por
 * isso `exigir()` é chamada de novo dentro de `@mark/core`, mesmo quando a tela
 * já escondeu o caminho.
 */
export function pode(ctx: Contexto, permissao: string, alvo?: Alvo): boolean {
  // Trava do financeiro pessoal: vem do dono da organização e de mais nada.
  // Fica antes de tudo de propósito — nem `*` atravessa.
  if (permissao.startsWith("financeiro.pessoal.")) {
    return ctx.ehProprietario;
  }

  if (!concede(ctx.permissoes, permissao)) return false;

  // Escopo por cliente: membro restrito só enxerga a própria carteira.
  if (alvo?.clienteId && ctx.clientesPermitidos !== null) {
    if (!ctx.clientesPermitidos.has(alvo.clienteId)) return false;
  }

  return true;
}

/** Igual a `pode()`, mas lança. Use nas fronteiras de escrita e leitura. */
export function exigir(ctx: Contexto, permissao: string, alvo?: Alvo): void {
  if (!pode(ctx, permissao, alvo)) {
    throw new ErroDeAutorizacao(permissao, ocultarAoNegar(permissao));
  }
}

/**
 * Para listagens: devolve os ids de cliente que o contexto enxerga, ou `null`
 * quando não há restrição. Quem consulta usa isto no `WHERE`, em vez de trazer
 * tudo e filtrar em memória — filtrar depois já leu o que não podia.
 */
export function filtroDeClientes(ctx: Contexto): string[] | null {
  return ctx.clientesPermitidos === null ? null : [...ctx.clientesPermitidos];
}

/**
 * Contexto sem nenhuma permissão, para tarefas de sistema que ainda precisam de
 * organização — geração de recorrência, limpeza, indexação. Explícito de
 * propósito: um worker que precise ler dado protegido tem de pedir a permissão
 * por escrito, e não herdar acesso por descuido.
 */
export function contextoDeSistema(organizacaoId: string): Contexto {
  return {
    organizacaoId,
    usuarioId: "00000000-0000-0000-0000-000000000000",
    permissoes: new Set(),
    clientesPermitidos: null,
    ehProprietario: false,
  };
}

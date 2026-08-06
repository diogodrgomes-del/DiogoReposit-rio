import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  SAUDE_CLIENTE,
  STATUS_CLIENTE,
  clientes,
  comContexto,
  novoId,
  type Transacao,
} from "@mark/db";
import { exigir, filtroDeClientes, pode, type Contexto } from "./contexto.js";
import { linhaDoTempo, registrar, diferenca, type EventoLido } from "./eventos.js";
import { normalizarTelefone } from "./telefone.js";

/**
 * Regras de negócio de clientes.
 *
 * Toda leitura e escrita do módulo passa por aqui, e cada função começa por
 * `exigir()`. É o que torna impossível uma rota nova ler cliente sem checar
 * permissão: não existe outro caminho até a tabela.
 */

export type StatusCliente = (typeof STATUS_CLIENTE)[number];
export type SaudeCliente = (typeof SAUDE_CLIENTE)[number];

export type Cliente = {
  id: string;
  nome: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  segmento: string | null;
  telefoneE164: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  instagram: string | null;
  site: string | null;
  responsavelId: string | null;
  status: StatusCliente;
  saude: SaudeCliente;
  observacoes: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

/** Campos que o usuário edita. Todos opcionais menos `nome`. */
export type DadosCliente = Partial<Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">> & {
  nome?: string;
};

export class ErroDeValidacao extends Error {
  readonly campo: string;
  constructor(campo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroDeValidacao";
    this.campo = campo;
  }
}

const CAMPOS_TEXTO = [
  "nomeFantasia",
  "cnpj",
  "segmento",
  "email",
  "cidade",
  "endereco",
  "instagram",
  "facebook",
  "tiktok",
  "site",
  "googleMeuNegocio",
  "observacoes",
] as const;

const CAMPOS_HISTORICO = [
  "nome",
  "status",
  "saude",
  "responsavelId",
  "segmento",
  "cidade",
] as const;

/** Campo vazio vira `null`, não string vazia — senão o banco guarda os dois. */
function vazioParaNulo(v: string | null | undefined): string | null {
  const limpo = v?.trim();
  return limpo ? limpo : null;
}

function soDigitos(v: string | null): string | null {
  const d = v?.replace(/\D/g, "") ?? "";
  return d ? d : null;
}

/**
 * Prepara os dados para escrita.
 *
 * A única obrigatoriedade é `nome` — o briefing é explícito: nunca bloquear a
 * criação de um cliente porque um campo secundário está vazio. O que esta
 * função faz é normalizar, não exigir.
 */
function preparar(dados: DadosCliente): Record<string, unknown> {
  const saida: Record<string, unknown> = {};

  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();
    if (!nome) throw new ErroDeValidacao("nome", "O nome do cliente é obrigatório.");
    if (nome.length > 200) throw new ErroDeValidacao("nome", "Nome longo demais.");
    saida.nome = nome;
  }

  for (const campo of CAMPOS_TEXTO) {
    if (campo in dados) {
      saida[campo] = vazioParaNulo(dados[campo as keyof DadosCliente] as string | null);
    }
  }

  if ("cnpj" in dados) saida.cnpj = soDigitos(vazioParaNulo(dados.cnpj));

  if ("telefoneE164" in dados) {
    const bruto = vazioParaNulo(dados.telefoneE164);
    if (bruto) {
      const normalizado = normalizarTelefone(bruto);
      if (!normalizado) throw new ErroDeValidacao("telefoneE164", "Telefone não reconhecido.");
      saida.telefoneE164 = normalizado;
    } else {
      saida.telefoneE164 = null;
    }
  }

  if ("estado" in dados) {
    const uf = vazioParaNulo(dados.estado)?.toUpperCase() ?? null;
    if (uf && uf.length !== 2) throw new ErroDeValidacao("estado", "UF deve ter duas letras.");
    saida.estado = uf;
  }

  if (dados.status !== undefined) {
    if (!STATUS_CLIENTE.includes(dados.status)) {
      throw new ErroDeValidacao("status", `Status inválido: ${dados.status}`);
    }
    saida.status = dados.status;
  }

  if (dados.saude !== undefined) {
    if (!SAUDE_CLIENTE.includes(dados.saude)) {
      throw new ErroDeValidacao("saude", `Saúde inválida: ${dados.saude}`);
    }
    saida.saude = dados.saude;
  }

  if ("responsavelId" in dados) saida.responsavelId = dados.responsavelId ?? null;

  return saida;
}

const COLUNAS = {
  id: clientes.id,
  nome: clientes.nome,
  nomeFantasia: clientes.nomeFantasia,
  cnpj: clientes.cnpj,
  segmento: clientes.segmento,
  telefoneE164: clientes.telefoneE164,
  email: clientes.email,
  cidade: clientes.cidade,
  estado: clientes.estado,
  instagram: clientes.instagram,
  site: clientes.site,
  responsavelId: clientes.responsavelId,
  status: clientes.status,
  saude: clientes.saude,
  observacoes: clientes.observacoes,
  criadoEm: clientes.criadoEm,
  atualizadoEm: clientes.atualizadoEm,
};

export type Filtros = {
  busca?: string;
  status?: StatusCliente[];
  responsavelId?: string;
  /** Paginação por cursor: o `id` do último item da página anterior. */
  cursor?: string;
  limite?: number;
};

export type Pagina = {
  itens: Cliente[];
  proximoCursor: string | null;
};

/**
 * Lista clientes.
 *
 * Paginação por cursor, e não por OFFSET: `OFFSET 10000` faz o Postgres ler dez
 * mil linhas para descartar. Como o id é uuid v7 — ordenável por tempo —, o
 * cursor é o próprio id, sem coluna extra.
 */
export async function listar(ctx: Contexto, filtros: Filtros = {}): Promise<Pagina> {
  exigir(ctx, "clientes.cliente.ver");

  const limite = Math.min(Math.max(filtros.limite ?? 50, 1), 200);
  const permitidos = filtroDeClientes(ctx);

  // Membro com escopo vazio não enxerga cliente nenhum. Consultar seria
  // devolver tudo por engano — `inArray` com lista vazia é um erro clássico.
  if (permitidos?.length === 0) return { itens: [], proximoCursor: null };

  return comContexto(ctx, async (tx) => {
    const condicoes = [isNull(clientes.excluidoEm)];

    if (permitidos) condicoes.push(inArray(clientes.id, permitidos));
    if (filtros.status?.length) condicoes.push(inArray(clientes.status, filtros.status));
    if (filtros.responsavelId) condicoes.push(eq(clientes.responsavelId, filtros.responsavelId));
    if (filtros.cursor) condicoes.push(lt(clientes.id, filtros.cursor));

    if (filtros.busca?.trim()) {
      const alvo = `%${filtros.busca.trim()}%`;
      const condicaoBusca = or(
        ilike(clientes.nome, alvo),
        ilike(clientes.nomeFantasia, alvo),
        ilike(clientes.cnpj, `%${filtros.busca.replace(/\D/g, "")}%`),
      );
      if (condicaoBusca) condicoes.push(condicaoBusca);
    }

    // Pede um a mais para saber se existe próxima página, sem um COUNT extra.
    const linhas = await tx
      .select(COLUNAS)
      .from(clientes)
      .where(and(...condicoes))
      .orderBy(desc(clientes.id))
      .limit(limite + 1);

    const temMais = linhas.length > limite;
    const itens = (temMais ? linhas.slice(0, limite) : linhas) as Cliente[];

    return {
      itens,
      proximoCursor: temMais ? (itens[itens.length - 1]?.id ?? null) : null,
    };
  });
}

/** Lista enxuta para seletores. Uma consulta menor porque é chamada em toda tela. */
export async function listarNomes(
  ctx: Contexto,
): Promise<{ id: string; nome: string; status: string }[]> {
  exigir(ctx, "clientes.cliente.ver");
  const permitidos = filtroDeClientes(ctx);
  if (permitidos?.length === 0) return [];

  return comContexto(ctx, async (tx) => {
    const condicoes = [isNull(clientes.excluidoEm)];
    if (permitidos) condicoes.push(inArray(clientes.id, permitidos));

    return tx
      .select({ id: clientes.id, nome: clientes.nome, status: clientes.status })
      .from(clientes)
      .where(and(...condicoes))
      .orderBy(asc(clientes.nome));
  });
}

export async function obter(ctx: Contexto, id: string): Promise<Cliente | null> {
  exigir(ctx, "clientes.cliente.ver", { clienteId: id });

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select(COLUNAS)
      .from(clientes)
      .where(and(eq(clientes.id, id), isNull(clientes.excluidoEm)))
      .limit(1);
    return (linhas[0] as Cliente | undefined) ?? null;
  });
}

export async function obterComHistorico(
  ctx: Contexto,
  id: string,
): Promise<{ cliente: Cliente; historico: EventoLido[] } | null> {
  exigir(ctx, "clientes.cliente.ver", { clienteId: id });

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .select(COLUNAS)
      .from(clientes)
      .where(and(eq(clientes.id, id), isNull(clientes.excluidoEm)))
      .limit(1);

    const cliente = linhas[0] as Cliente | undefined;
    if (!cliente) return null;

    return { cliente, historico: await linhaDoTempo(tx, "cliente", id) };
  });
}

export async function criar(ctx: Contexto, dados: DadosCliente): Promise<Cliente> {
  exigir(ctx, "clientes.cliente.criar");
  if (!dados.nome?.trim()) throw new ErroDeValidacao("nome", "O nome do cliente é obrigatório.");

  const valores = preparar(dados);
  const id = novoId();

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .insert(clientes)
      .values({
        ...valores,
        id,
        organizacaoId: ctx.organizacaoId,
        nome: valores.nome as string,
        criadoPor: ctx.usuarioId,
        atualizadoPor: ctx.usuarioId,
      })
      .returning(COLUNAS);

    const cliente = linhas[0] as Cliente;
    await registrar(tx, ctx, {
      tipo: "cliente.criado",
      entidade: "cliente",
      entidadeId: id,
      dados: { nome: cliente.nome },
    });
    return cliente;
  });
}

export async function atualizar(
  ctx: Contexto,
  id: string,
  dados: DadosCliente,
): Promise<Cliente | null> {
  exigir(ctx, "clientes.cliente.editar", { clienteId: id });
  const valores = preparar(dados);
  if (Object.keys(valores).length === 0) return obter(ctx, id);

  return comContexto(ctx, async (tx) => {
    const antes = await tx
      .select(COLUNAS)
      .from(clientes)
      .where(and(eq(clientes.id, id), isNull(clientes.excluidoEm)))
      .limit(1);

    const anterior = antes[0] as Cliente | undefined;
    if (!anterior) return null;

    const linhas = await tx
      .update(clientes)
      .set({ ...valores, atualizadoEm: new Date(), atualizadoPor: ctx.usuarioId })
      .where(eq(clientes.id, id))
      .returning(COLUNAS);

    const mudou = diferenca(
      anterior as unknown as Record<string, unknown>,
      valores,
      CAMPOS_HISTORICO,
    );

    // Evento só quando algo relevante mudou. Salvar sem alterar nada não
    // merece linha na história — é o que enche a timeline de ruído.
    if (Object.keys(mudou).length > 0) {
      await registrar(tx, ctx, {
        tipo: "cliente.editado",
        entidade: "cliente",
        entidadeId: id,
        dados: mudou,
      });
    }

    return linhas[0] as Cliente;
  });
}

/**
 * Exclusão lógica. O registro sai das listas e some da busca, mas continua no
 * banco — erro de clique não destrói o histórico de um cliente.
 */
export async function excluir(ctx: Contexto, id: string): Promise<boolean> {
  exigir(ctx, "clientes.cliente.excluir", { clienteId: id });

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .update(clientes)
      .set({ excluidoEm: new Date(), atualizadoPor: ctx.usuarioId })
      .where(and(eq(clientes.id, id), isNull(clientes.excluidoEm)))
      .returning({ id: clientes.id, nome: clientes.nome });

    const alvo = linhas[0];
    if (!alvo) return false;

    await registrar(tx, ctx, {
      tipo: "cliente.excluido",
      entidade: "cliente",
      entidadeId: id,
      dados: { nome: alvo.nome },
    });
    return true;
  });
}

/** Lixeira: devolve o que foi excluído por engano. */
export async function restaurar(ctx: Contexto, id: string): Promise<boolean> {
  exigir(ctx, "clientes.cliente.excluir", { clienteId: id });

  return comContexto(ctx, async (tx) => {
    const linhas = await tx
      .update(clientes)
      .set({ excluidoEm: null, atualizadoPor: ctx.usuarioId })
      .where(and(eq(clientes.id, id), sql`${clientes.excluidoEm} IS NOT NULL`))
      .returning({ id: clientes.id });

    if (!linhas[0]) return false;
    await registrar(tx, ctx, { tipo: "cliente.restaurado", entidade: "cliente", entidadeId: id });
    return true;
  });
}

export async function listarExcluidos(ctx: Contexto): Promise<Cliente[]> {
  exigir(ctx, "clientes.cliente.excluir");
  return comContexto(ctx, async (tx) =>
    tx
      .select(COLUNAS)
      .from(clientes)
      .where(sql`${clientes.excluidoEm} IS NOT NULL`)
      .orderBy(desc(clientes.excluidoEm))
      .limit(100),
  ) as Promise<Cliente[]>;
}

/**
 * Busca ou cria um cliente pelo nome, sem duplicar.
 *
 * Usada pela importação do `META_TOKENS` e, mais adiante, pelo onboarding
 * automático que transforma lead em cliente. Recebe a transação de fora porque
 * quem chama normalmente está no meio de uma operação maior que precisa ser
 * atômica — criar cliente, contrato, projeto e pastas ou não criar nada.
 */
export async function garantirPorNome(
  tx: Transacao,
  ctx: Contexto,
  nome: string,
): Promise<{ id: string; criado: boolean }> {
  const limpo = nome.trim();
  if (!limpo) throw new ErroDeValidacao("nome", "O nome do cliente é obrigatório.");

  const existente = await tx
    .select({ id: clientes.id })
    .from(clientes)
    .where(
      and(
        eq(clientes.organizacaoId, ctx.organizacaoId),
        sql`lower(${clientes.nome}) = lower(${limpo})`,
        isNull(clientes.excluidoEm),
      ),
    )
    .limit(1);

  if (existente[0]) return { id: existente[0].id, criado: false };

  const id = novoId();
  await tx.insert(clientes).values({
    id,
    organizacaoId: ctx.organizacaoId,
    nome: limpo,
    status: "ativo",
    criadoPor: ctx.usuarioId,
    atualizadoPor: ctx.usuarioId,
  });
  await registrar(tx, ctx, {
    tipo: "cliente.criado",
    entidade: "cliente",
    entidadeId: id,
    dados: { nome: limpo, origem: "importacao" },
  });

  return { id, criado: true };
}

/** Para a tela decidir o que mostrar sem repetir a regra de permissão. */
export function permissoesDe(ctx: Contexto, clienteId?: string) {
  const alvo = clienteId ? { clienteId } : undefined;
  return {
    ver: pode(ctx, "clientes.cliente.ver", alvo),
    criar: pode(ctx, "clientes.cliente.criar"),
    editar: pode(ctx, "clientes.cliente.editar", alvo),
    excluir: pode(ctx, "clientes.cliente.excluir", alvo),
    verFinanceiro: pode(ctx, "financeiro.lancamento.ver"),
    verCredenciais: pode(ctx, "credenciais.credencial.ver", alvo),
    revelarCredenciais: pode(ctx, "credenciais.credencial.revelar", alvo),
  };
}

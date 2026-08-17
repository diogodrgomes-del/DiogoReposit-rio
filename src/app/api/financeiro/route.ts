import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, lerSessao } from "@/lib/auth";
import {
  apagarLancamento,
  bancoConfigurado,
  criarLancamento,
  despesasPorCategoria,
  ehArea,
  ehTipo,
  gerarCobrancas,
  lancamentosDoMes,
  listarRecorrencias,
  marcarCobrado,
  pendentesAte,
  registrarPagamento,
  resumoDe,
  serieMensal,
  valorDe,
  type Area,
} from "@/lib/financeiro";
import { feriadosDoMes } from "@/lib/feriados";
import { hojeISO } from "@/lib/presets";
import { somarMeses } from "@/lib/recorrencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_DESCRICAO = 200;
/** Teto de sanidade: acima disso e quase sempre virgula digitada errado. */
const VALOR_MAXIMO = 100_000_000;
/** Quantos meses de historico a serie do grafico cobre. */
const MESES_SERIE = 11;

async function usuarioAtual(): Promise<string | null> {
  const c = await cookies();
  return lerSessao(c.get(COOKIE)?.value);
}

function semBanco() {
  return NextResponse.json(
    {
      erro:
        "Banco não configurado. Cadastre DATABASE_URL no servidor e faça um " +
        "novo deploy para o financeiro começar a gravar.",
    },
    { status: 503 }
  );
}

const ehMes = (v: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const ehData = (v: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function areaDe(v: string | null): Area | null {
  return ehArea(v) ? v : null;
}

/**
 * Tudo que a tela do mes precisa, numa consulta so.
 *
 * Inclui pendencias de meses anteriores de proposito: fatura vencida em marco
 * continua sendo dinheiro a receber quando se abre agosto.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const area = areaDe(params.get("area"));
  if (!area) {
    return NextResponse.json({ erro: "Área inválida." }, { status: 400 });
  }

  const mesPedido = params.get("mes") ?? "";
  const mes = ehMes(mesPedido) ? mesPedido : hojeISO().slice(0, 7);

  if (!bancoConfigurado()) {
    return NextResponse.json({
      bancoConfigurado: false,
      area,
      mes,
      hoje: hojeISO(),
      lancamentos: [],
      pendentes: [],
      recorrencias: [],
      serie: [],
      despesas: [],
      feriados: feriadosDoMes(mes),
      resumo: resumoDe([]),
      geradas: 0,
    });
  }

  try {
    // Materializa as cobrancas antes de ler: e o que garante que abrir a tela
    // ja mostra o que vence, sem depender de agendador nenhum.
    const geradas = await gerarCobrancas(area);

    const [lancamentos, recorrencias, serie] = await Promise.all([
      lancamentosDoMes(area, mes),
      listarRecorrencias(area),
      serieMensal(area, somarMeses(mes, -MESES_SERIE), mes),
    ]);

    // Pendencias ate o fim do mes seguinte: cobre o que ja venceu e o que
    // esta prestes a vencer, que e o horizonte util de uma agenda de cobranca.
    const limite = `${somarMeses(mes, 1)}-28`;
    const pendentes = await pendentesAte(area, limite);

    return NextResponse.json(
      {
        bancoConfigurado: true,
        area,
        mes,
        hoje: hojeISO(),
        lancamentos,
        pendentes,
        recorrencias,
        serie,
        despesas: despesasPorCategoria(lancamentos),
        feriados: feriadosDoMes(mes),
        resumo: resumoDe(lancamentos),
        geradas,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error("Financeiro: falha ao carregar —", (e as Error).message);
    return NextResponse.json(
      { erro: "Não foi possível carregar o financeiro." },
      { status: 500 }
    );
  }
}

/** Novo lançamento avulso (entrada ou saída), em qualquer das duas áreas. */
export async function POST(req: Request) {
  const autor = await usuarioAtual();
  if (!autor) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  if (!bancoConfigurado()) return semBanco();

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const area = areaDe(typeof corpo.area === "string" ? corpo.area : null);
  if (!area) {
    return NextResponse.json({ erro: "Área inválida." }, { status: 400 });
  }
  if (!ehTipo(corpo.tipo)) {
    return NextResponse.json(
      { erro: "Informe se é entrada ou saída." },
      { status: 400 }
    );
  }

  const descricao = String(corpo.descricao ?? "").trim();
  if (!descricao) {
    return NextResponse.json(
      { erro: "Descreva o lançamento." },
      { status: 400 }
    );
  }
  if (descricao.length > LIMITE_DESCRICAO) {
    return NextResponse.json(
      { erro: `Descrição com no máximo ${LIMITE_DESCRICAO} caracteres.` },
      { status: 400 }
    );
  }

  const valor = valorDe(corpo.valor);
  if (valor === null || valor <= 0 || valor > VALOR_MAXIMO) {
    return NextResponse.json({ erro: "Valor inválido." }, { status: 400 });
  }

  const vencimento = String(corpo.vencimento ?? "");
  if (!ehData(vencimento)) {
    return NextResponse.json(
      { erro: "Data de vencimento inválida." },
      { status: 400 }
    );
  }

  const pagoEmBruto = String(corpo.pagoEm ?? "").trim();
  if (pagoEmBruto && !ehData(pagoEmBruto)) {
    return NextResponse.json(
      { erro: "Data de pagamento inválida." },
      { status: 400 }
    );
  }

  const competenciaBruta = String(corpo.competencia ?? "").trim();
  // Sem competência informada, vale o mês do vencimento — que é o que a
  // pessoa quis dizer em praticamente todo lançamento avulso.
  const competencia = ehMes(competenciaBruta)
    ? competenciaBruta
    : vencimento.slice(0, 7);

  const opcional = (v: unknown, max = LIMITE_DESCRICAO): string | null => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
  };

  try {
    const lancamento = await criarLancamento(
      {
        area,
        tipo: corpo.tipo,
        descricao,
        categoria: opcional(corpo.categoria) ?? "Outros",
        cliente: opcional(corpo.cliente),
        valor,
        competencia,
        vencimento,
        pagoEm: pagoEmBruto || null,
        forma: opcional(corpo.forma, 60),
        observacao: opcional(corpo.observacao, 500),
      },
      autor
    );
    return NextResponse.json({ lancamento }, { status: 201 });
  } catch (e) {
    console.error("Financeiro: falha ao criar lançamento —", (e as Error).message);
    return NextResponse.json({ erro: "Não foi possível salvar." }, { status: 500 });
  }
}

/**
 * Marca pagamento ou registra que a cobrança foi enviada.
 *
 * As duas coisas moram no mesmo endpoint porque são a mesma linha da tabela e
 * a mesma pergunta ("o que aconteceu com essa cobrança?") — só muda a resposta.
 */
export async function PATCH(req: Request) {
  const autor = await usuarioAtual();
  if (!autor) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  if (!bancoConfigurado()) return semBanco();

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const id = Number(corpo.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ erro: "Identificador inválido." }, { status: 400 });
  }

  try {
    if (corpo.acao === "cobrar") {
      const lancamento = await marcarCobrado(id, corpo.cobrado !== false);
      return lancamento
        ? NextResponse.json({ lancamento })
        : NextResponse.json({ erro: "Lançamento não encontrado." }, { status: 404 });
    }

    // Ação padrão: pagar. `pagoEm` vazio desfaz a baixa — erro de clique tem
    // que ter volta, senão a pessoa cria um lançamento negativo para consertar.
    const bruto = String(corpo.pagoEm ?? "").trim();
    if (bruto && !ehData(bruto)) {
      return NextResponse.json(
        { erro: "Data de pagamento inválida." },
        { status: 400 }
      );
    }
    const forma = String(corpo.forma ?? "").trim().slice(0, 60) || null;
    const lancamento = await registrarPagamento(id, bruto || null, forma);
    return lancamento
      ? NextResponse.json({ lancamento })
      : NextResponse.json({ erro: "Lançamento não encontrado." }, { status: 404 });
  } catch (e) {
    console.error("Financeiro: falha ao atualizar —", (e as Error).message);
    return NextResponse.json(
      { erro: "Não foi possível atualizar." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const autor = await usuarioAtual();
  if (!autor) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  if (!bancoConfigurado()) return semBanco();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ erro: "Identificador inválido." }, { status: 400 });
  }

  try {
    const ok = await apagarLancamento(id);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ erro: "Lançamento não encontrado." }, { status: 404 });
  } catch (e) {
    console.error("Financeiro: falha ao apagar —", (e as Error).message);
    return NextResponse.json({ erro: "Não foi possível apagar." }, { status: 500 });
  }
}

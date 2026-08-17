import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, lerSessao } from "@/lib/auth";
import {
  alternarRecorrencia,
  apagarRecorrencia,
  bancoConfigurado,
  criarRecorrencia,
  ehArea,
  ehTipo,
  gerarCobrancas,
  listarRecorrencias,
  valorDe,
  type Area,
} from "@/lib/financeiro";
import { ehFrequencia } from "@/lib/recorrencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_DESCRICAO = 200;
const VALOR_MAXIMO = 100_000_000;

async function autenticado(): Promise<boolean> {
  const c = await cookies();
  return (await lerSessao(c.get(COOKIE)?.value)) !== null;
}

function semBanco() {
  return NextResponse.json(
    {
      erro:
        "Banco não configurado. Cadastre DATABASE_URL no servidor e faça um " +
        "novo deploy para criar contratos recorrentes.",
    },
    { status: 503 }
  );
}

const ehData = (v: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function areaDe(v: unknown): Area | null {
  return ehArea(v) ? v : null;
}

export async function GET(req: Request) {
  if (!(await autenticado())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  const area = areaDe(new URL(req.url).searchParams.get("area"));
  if (!area) {
    return NextResponse.json({ erro: "Área inválida." }, { status: 400 });
  }
  if (!bancoConfigurado()) {
    return NextResponse.json({ recorrencias: [], bancoConfigurado: false });
  }
  try {
    return NextResponse.json({
      recorrencias: await listarRecorrencias(area),
      bancoConfigurado: true,
    });
  } catch (e) {
    console.error("Recorrências: falha ao listar —", (e as Error).message);
    return NextResponse.json(
      { erro: "Não foi possível carregar os contratos." },
      { status: 500 }
    );
  }
}

/**
 * Cria o contrato e ja materializa as cobrancas.
 *
 * Gerar na hora evita a tela em branco logo depois de cadastrar: o contrato
 * aparece com as proximas cobrancas ja na agenda, sem esperar o proximo
 * carregamento.
 */
export async function POST(req: Request) {
  if (!(await autenticado())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  if (!bancoConfigurado()) return semBanco();

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const area = areaDe(corpo.area);
  if (!area) {
    return NextResponse.json({ erro: "Área inválida." }, { status: 400 });
  }
  if (!ehTipo(corpo.tipo)) {
    return NextResponse.json(
      { erro: "Informe se é entrada ou saída." },
      { status: 400 }
    );
  }
  if (!ehFrequencia(corpo.frequencia)) {
    return NextResponse.json({ erro: "Frequência inválida." }, { status: 400 });
  }

  const descricao = String(corpo.descricao ?? "").trim();
  if (!descricao) {
    return NextResponse.json({ erro: "Descreva o contrato." }, { status: 400 });
  }

  const valor = valorDe(corpo.valor);
  if (valor === null || valor <= 0 || valor > VALOR_MAXIMO) {
    return NextResponse.json({ erro: "Valor inválido." }, { status: 400 });
  }

  const dia = Number(corpo.diaVencimento);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    return NextResponse.json(
      { erro: "Dia de vencimento deve estar entre 1 e 31." },
      { status: 400 }
    );
  }

  const inicio = String(corpo.inicio ?? "");
  if (!ehData(inicio)) {
    return NextResponse.json({ erro: "Data de início inválida." }, { status: 400 });
  }

  const fimBruto = String(corpo.fim ?? "").trim();
  if (fimBruto && !ehData(fimBruto)) {
    return NextResponse.json({ erro: "Data de fim inválida." }, { status: 400 });
  }
  if (fimBruto && fimBruto < inicio) {
    return NextResponse.json(
      { erro: "O fim do contrato não pode ser antes do início." },
      { status: 400 }
    );
  }

  const lembrete = Number(corpo.lembreteDias);
  const lembreteDias =
    Number.isInteger(lembrete) && lembrete >= 0 && lembrete <= 60 ? lembrete : 3;

  const opcional = (v: unknown, max = LIMITE_DESCRICAO): string | null => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
  };

  try {
    const recorrencia = await criarRecorrencia({
      area,
      tipo: corpo.tipo,
      descricao: descricao.slice(0, LIMITE_DESCRICAO),
      categoria: opcional(corpo.categoria) ?? "Outros",
      cliente: opcional(corpo.cliente),
      valor,
      frequencia: corpo.frequencia,
      diaVencimento: dia,
      inicio,
      fim: fimBruto || null,
      lembreteDias,
      ajustaDiaUtil: corpo.ajustaDiaUtil !== false,
    });
    const geradas = await gerarCobrancas(area);
    return NextResponse.json({ recorrencia, geradas }, { status: 201 });
  } catch (e) {
    console.error("Recorrências: falha ao criar —", (e as Error).message);
    return NextResponse.json({ erro: "Não foi possível salvar." }, { status: 500 });
  }
}

/** Liga/desliga o contrato. Desligado não gera cobrança nova. */
export async function PATCH(req: Request) {
  if (!(await autenticado())) {
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
    const recorrencia = await alternarRecorrencia(id, corpo.ativo !== false);
    if (!recorrencia) {
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    }
    // Reativar precisa repor as cobranças dos meses que passaram desligado.
    const geradas = recorrencia.ativo ? await gerarCobrancas(recorrencia.area) : 0;
    return NextResponse.json({ recorrencia, geradas });
  } catch (e) {
    console.error("Recorrências: falha ao atualizar —", (e as Error).message);
    return NextResponse.json(
      { erro: "Não foi possível atualizar." },
      { status: 500 }
    );
  }
}

/** Apaga o contrato e as cobranças dele ainda em aberto; o que foi pago fica. */
export async function DELETE(req: Request) {
  if (!(await autenticado())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  if (!bancoConfigurado()) return semBanco();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ erro: "Identificador inválido." }, { status: 400 });
  }

  try {
    const ok = await apagarRecorrencia(id);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  } catch (e) {
    console.error("Recorrências: falha ao apagar —", (e as Error).message);
    return NextResponse.json({ erro: "Não foi possível apagar." }, { status: 500 });
  }
}

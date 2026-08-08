import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAtor, type Ator } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resultado = {
  tipo: "lead" | "cliente" | "demanda" | "evento" | "financeiro";
  id: string;
  titulo: string;
  detalhe: string | null;
  url: string;
};

/**
 * Escopo de cliente como predicado SQL.
 *
 * Entra na consulta, não no filtro depois: o banco nunca devolve a linha.
 * `null` significa "enxerga todos"; array vazio significa "nenhum", e é por
 * isso que o caso vazio vira `false` explícito — `IN ()` não é SQL válido.
 */
function escopoSql(ator: Ator, coluna: string): Prisma.Sql {
  if (ator.clientesVisiveis === null) return Prisma.sql`TRUE`;
  if (ator.clientesVisiveis.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`${Prisma.raw(coluna)} = ANY(${ator.clientesVisiveis}::text[])`;
}

/**
 * Busca global do ⌘K.
 *
 * Duas propriedades que valem mais que a implementação:
 *
 * 1. O filtro de permissão está na CONSULTA, nunca depois. Quem não tem
 *    `financeiro.empresa:ler` não recebe resultado financeiro porque a consulta
 *    não roda — não porque a tela escondeu.
 *
 * 2. `sem_acento()` dos dois lados da comparação: "orcamento" encontra
 *    "Orçamento", "calendario" encontra "Calendário". Sem isso, metade das
 *    buscas em português falha em silêncio, e a pessoa conclui que o sistema
 *    não acha nada. Os índices GIN por trigrama estão na migration
 *    20260808044000_busca_sem_acento.
 */
export async function GET(req: Request) {
  const ator = await getAtor();
  if (!ator) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const termo = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (termo.length < 2) return NextResponse.json({ resultados: [] });

  const org = ator.organizationId;
  const alvo = `%${termo}%`;
  const digitos = termo.replace(/\D/g, "");

  const consultas: Promise<Resultado[]>[] = [];

  if (can(ator, "leads:ler")) {
    consultas.push(
      prisma.$queryRaw<Resultado[]>`
        SELECT 'lead' AS tipo, l.id,
               c.nome AS titulo,
               COALESCE(c.empresa, e.nome) AS detalhe,
               '/vendas/lead/' || l.id AS url
        FROM leads l
        JOIN contacts c ON c.id = l.contact_id
        JOIN pipeline_stages e ON e.id = l.stage_id
        WHERE l.organization_id = ${org}
          AND l.deletado_em IS NULL
          AND (
            sem_acento(c.nome) ILIKE sem_acento(${alvo})
            OR sem_acento(COALESCE(c.empresa, '')) ILIKE sem_acento(${alvo})
            ${digitos ? Prisma.sql`OR c.telefone LIKE ${"%" + digitos + "%"}` : Prisma.empty}
          )
        ORDER BY l.atualizado_em DESC
        LIMIT 5`
    );
  }

  if (can(ator, "clientes:ler")) {
    consultas.push(
      prisma.$queryRaw<Resultado[]>`
        SELECT 'cliente' AS tipo, id,
               COALESCE(nome_fantasia, razao_social) AS titulo,
               lower(status::text) AS detalhe,
               '/clientes/' || id AS url
        FROM clients
        WHERE organization_id = ${org}
          AND deletado_em IS NULL
          AND ${escopoSql(ator, "id")}
          AND (
            sem_acento(razao_social) ILIKE sem_acento(${alvo})
            OR sem_acento(COALESCE(nome_fantasia, '')) ILIKE sem_acento(${alvo})
            OR COALESCE(cnpj, '') LIKE ${alvo}
          )
        ORDER BY razao_social
        LIMIT 5`
    );
  }

  if (can(ator, "demandas:ler")) {
    // Quem não tem `ler_todas` enxerga apenas o que é seu.
    const soMinhas = can(ator, "demandas:ler_todas")
      ? Prisma.empty
      : Prisma.sql`AND d.responsavel_id = ${ator.userId}`;

    consultas.push(
      prisma.$queryRaw<Resultado[]>`
        SELECT 'demanda' AS tipo, d.id, d.titulo,
               COALESCE(cl.nome_fantasia, cl.razao_social, 'Interno') AS detalhe,
               '/demandas/' || d.id AS url
        FROM demands d
        LEFT JOIN clients cl ON cl.id = d.client_id
        WHERE d.organization_id = ${org}
          AND d.deletado_em IS NULL
          AND (d.client_id IS NULL OR ${escopoSql(ator, "d.client_id")})
          ${soMinhas}
          AND sem_acento(d.titulo) ILIKE sem_acento(${alvo})
        ORDER BY d.atualizado_em DESC
        LIMIT 5`
    );
  }

  if (can(ator, "agenda:ler")) {
    consultas.push(
      prisma.$queryRaw<Resultado[]>`
        SELECT 'evento' AS tipo, id, titulo,
               to_char(inicio_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS detalhe,
               '/agenda?ano=' || extract(year from inicio_em)::int
                 || '&mes=' || (extract(month from inicio_em)::int - 1) AS url
        FROM events
        WHERE organization_id = ${org}
          AND deletado_em IS NULL
          AND cancelado_em IS NULL
          AND (client_id IS NULL OR ${escopoSql(ator, "client_id")})
          AND sem_acento(titulo) ILIKE sem_acento(${alvo})
        ORDER BY inicio_em DESC
        LIMIT 4`
    );
  }

  if (can(ator, "financeiro.empresa:ler")) {
    consultas.push(
      prisma.$queryRaw<Resultado[]>`
        SELECT 'financeiro' AS tipo, id, descricao AS titulo,
               to_char(valor_cents / 100.0, 'FM999G999G990D00') AS detalhe,
               CASE WHEN tipo = 'RECEITA'
                    THEN '/financeiro/a-receber'
                    ELSE '/financeiro/a-pagar' END AS url
        FROM fin_entries
        WHERE organization_id = ${org}
          AND deletado_em IS NULL
          AND escopo = 'EMPRESA'
          AND sem_acento(descricao) ILIKE sem_acento(${alvo})
        ORDER BY vencimento_em DESC
        LIMIT 4`
    );
  }

  const resultados = (await Promise.all(consultas)).flat();

  return NextResponse.json(
    { resultados },
    { headers: { "Cache-Control": "no-store" } }
  );
}

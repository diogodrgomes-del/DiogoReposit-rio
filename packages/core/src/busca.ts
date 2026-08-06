import { and, eq, isNull, or, sql } from "drizzle-orm";
import { clientes, comContexto, contatos, leads } from "@mark/db";
import { filtroDeClientes, pode, type Contexto } from "./contexto";
import { normalizarTelefone } from "./telefone";

/**
 * Busca global.
 *
 * Três decisões:
 *
 * 1. **Tolerante a erro de escrita.** `unaccent` resolve acento ("oticas"
 *    encontra "Óticas") e `similarity` do pg_trgm resolve o resto ("gouvea"
 *    encontra "Gouveia"). Os dois índices GIN existem desde a migração 0003.
 *
 * 2. **Telefone é reconhecido como telefone.** Digitar "44998887777" normaliza
 *    para E.164 e casa exato, em vez de virar busca textual que não acha nada
 *    porque o banco guarda "+5544998887777".
 *
 * 3. **Só devolve o que a pessoa pode ver.** Cada tipo é consultado apenas se a
 *    permissão existir, e o escopo por cliente é aplicado no `WHERE`. O que
 *    você não pode abrir não aparece — nem como título.
 */

export type TipoResultado = "cliente" | "lead" | "contato";

export type Resultado = {
  tipo: TipoResultado;
  id: string;
  titulo: string;
  subtitulo: string | null;
  href: string;
};

const ROTULO: Record<TipoResultado, string> = {
  cliente: "Clientes",
  lead: "Leads",
  contato: "Contatos",
};

export function rotuloDoTipo(tipo: TipoResultado): string {
  return ROTULO[tipo];
}

/** Limiar do trigram. Abaixo disso o ruído passa a superar os acertos. */
const SIMILARIDADE = 0.25;

export async function global(
  ctx: Contexto,
  termo: string,
  limitePorTipo = 5,
): Promise<Resultado[]> {
  const alvo = termo.trim();
  if (alvo.length < 2) return [];

  const permitidos = filtroDeClientes(ctx);
  const telefone = normalizarTelefone(alvo);
  const parcial = `%${alvo}%`;

  return comContexto(ctx, async (tx) => {
    const achados: Resultado[] = [];

    if (pode(ctx, "clientes.cliente.ver")) {
      const condicoes = [
        eq(clientes.organizacaoId, ctx.organizacaoId),
        isNull(clientes.excluidoEm),
      ];
      // Membro com escopo vazio não enxerga cliente nenhum; consultar devolveria
      // tudo por engano, que é o erro clássico de `IN ()`.
      if (permitidos && permitidos.length === 0) {
        // não consulta
      } else {
        if (permitidos) {
          condicoes.push(sql`${clientes.id} IN ${permitidos}`);
        }
        const filtro = or(
          sql`unaccent(${clientes.nome}) ILIKE unaccent(${parcial})`,
          sql`unaccent(coalesce(${clientes.nomeFantasia}, '')) ILIKE unaccent(${parcial})`,
          sql`similarity(${clientes.nome}, ${alvo}) > ${SIMILARIDADE}`,
          ...(telefone ? [eq(clientes.telefoneE164, telefone)] : []),
        );
        if (filtro) condicoes.push(filtro);

        const linhas = await tx
          .select({
            id: clientes.id,
            nome: clientes.nome,
            segmento: clientes.segmento,
            cidade: clientes.cidade,
          })
          .from(clientes)
          .where(and(...condicoes))
          .orderBy(sql`similarity(${clientes.nome}, ${alvo}) DESC`)
          .limit(limitePorTipo);

        achados.push(
          ...linhas.map((l) => ({
            tipo: "cliente" as const,
            id: l.id,
            titulo: l.nome,
            subtitulo: [l.segmento, l.cidade].filter(Boolean).join(" · ") || null,
            href: `/clientes/${l.id}`,
          })),
        );
      }
    }

    if (pode(ctx, "vendas.lead.ver")) {
      const filtro = or(
        sql`unaccent(${contatos.nome}) ILIKE unaccent(${parcial})`,
        sql`unaccent(coalesce(${leads.empresa}, '')) ILIKE unaccent(${parcial})`,
        sql`similarity(${contatos.nome}, ${alvo}) > ${SIMILARIDADE}`,
        ...(telefone ? [eq(contatos.telefoneE164, telefone)] : []),
      );

      const linhas = await tx
        .select({
          id: leads.id,
          nome: contatos.nome,
          empresa: leads.empresa,
          telefone: contatos.telefoneE164,
        })
        .from(leads)
        .innerJoin(contatos, eq(contatos.id, leads.contatoId))
        .where(
          and(
            eq(leads.organizacaoId, ctx.organizacaoId),
            isNull(leads.excluidoEm),
            ...(filtro ? [filtro] : []),
          ),
        )
        .orderBy(sql`similarity(${contatos.nome}, ${alvo}) DESC`)
        .limit(limitePorTipo);

      achados.push(
        ...linhas.map((l) => ({
          tipo: "lead" as const,
          id: l.id,
          titulo: l.nome,
          subtitulo: l.empresa ?? l.telefone,
          href: `/vendas/${l.id}`,
        })),
      );
    }

    if (pode(ctx, "clientes.contato.ver")) {
      const filtro = or(
        sql`unaccent(${contatos.nome}) ILIKE unaccent(${parcial})`,
        sql`similarity(${contatos.nome}, ${alvo}) > ${SIMILARIDADE}`,
        ...(telefone ? [eq(contatos.telefoneE164, telefone)] : []),
      );

      const linhas = await tx
        .select({ id: contatos.id, nome: contatos.nome, telefone: contatos.telefoneE164 })
        .from(contatos)
        .where(
          and(
            eq(contatos.organizacaoId, ctx.organizacaoId),
            isNull(contatos.excluidoEm),
            ...(filtro ? [filtro] : []),
          ),
        )
        .orderBy(sql`similarity(${contatos.nome}, ${alvo}) DESC`)
        .limit(limitePorTipo);

      // Contato que já é lead aparece uma vez só, como lead — que é a ficha
      // onde há mais o que fazer.
      const jaListados = new Set(achados.filter((a) => a.tipo === "lead").map((a) => a.titulo));

      achados.push(
        ...linhas
          .filter((l) => !jaListados.has(l.nome))
          .map((l) => ({
            tipo: "contato" as const,
            id: l.id,
            titulo: l.nome,
            subtitulo: l.telefone,
            href: `/vendas?q=${encodeURIComponent(l.nome)}`,
          })),
      );
    }

    return achados;
  });
}

import Link from "next/link";
import { leads as regra, usuarios } from "@mark/core";
import { Quadro } from "@/modulos/vendas/Quadro";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const texto = (v: string | string[] | undefined): string => (typeof v === "string" ? v : "");

export default async function PaginaVendas({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const ctx = await exigirContexto();

  const filtros = {
    responsavelId: texto(params.responsavel) || undefined,
    temperatura: texto(params.temperatura) || undefined,
    busca: texto(params.q) || undefined,
  };

  const [colunas, permissoes, equipe] = await Promise.all([
    regra.quadro(ctx, filtros),
    Promise.resolve(regra.permissoesDe(ctx)),
    usuarios.colegas(ctx),
  ]);

  const resumo = permissoes.verPainel ? await regra.resumo(ctx) : null;
  const filtrando = Boolean(filtros.responsavelId || filtros.temperatura || filtros.busca);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">Comercial</h1>
          <p className="pagina__sub">Arraste os cards entre as etapas</p>
        </div>
        {permissoes.criar && (
          <Link className="btn btn--acento" href="/vendas/novo">
            Novo lead
          </Link>
        )}
      </div>

      {resumo && (
        <div className="indicadores">
          <div className="indicador">
            <p className="indicador__rotulo">Em aberto</p>
            <p className="indicador__valor">{resumo.emAberto}</p>
          </div>
          <div className="indicador">
            <p className="indicador__rotulo">Valor em aberto</p>
            <p className="indicador__valor">{moeda.format(resumo.valorEmAberto)}</p>
          </div>
          <div className="indicador">
            <p className="indicador__rotulo">Fechados</p>
            <p className="indicador__valor">{resumo.ganhos}</p>
          </div>
          <div className="indicador">
            <p className="indicador__rotulo">Perdidos</p>
            <p className="indicador__valor">{resumo.perdidos}</p>
          </div>
          {/* Cartão clicável leva à lista já filtrada — requisito 6. */}
          <Link className="indicador" href="/vendas?semRetorno=1">
            <p className="indicador__rotulo">Sem retorno</p>
            <p
              className="indicador__valor"
              style={{ color: resumo.semRetorno > 0 ? "var(--crit)" : undefined }}
            >
              {resumo.semRetorno}
            </p>
          </Link>
        </div>
      )}

      <form className="filtros" method="get">
        <label className="campo-sis" style={{ minWidth: 220 }}>
          <span>Buscar</span>
          <input name="q" defaultValue={filtros.busca ?? ""} placeholder="Nome, telefone ou empresa" />
        </label>
        <label className="campo-sis" style={{ minWidth: 170 }}>
          <span>Responsável</span>
          <select name="responsavel" defaultValue={filtros.responsavelId ?? ""}>
            <option value="">Todos</option>
            {equipe.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-sis" style={{ minWidth: 150 }}>
          <span>Temperatura</span>
          <select name="temperatura" defaultValue={filtros.temperatura ?? ""}>
            <option value="">Todas</option>
            <option value="quente">Quente</option>
            <option value="morno">Morno</option>
            <option value="frio">Frio</option>
          </select>
        </label>
        <button type="submit" className="btn">
          Filtrar
        </button>
        {filtrando && (
          <Link className="btn btn--discreto" href="/vendas">
            Limpar
          </Link>
        )}
      </form>

      <Quadro colunas={colunas} podeEditar={permissoes.editar} />
    </>
  );
}

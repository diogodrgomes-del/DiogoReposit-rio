import Link from "next/link";
import { notFound } from "next/navigation";
import { pode, usuarios } from "@mark/core";
import { FormularioLead } from "@/modulos/vendas/FormularioLead";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function PaginaNovoLead() {
  const ctx = await exigirContexto();
  if (!pode(ctx, "vendas.lead.criar")) notFound();

  const colegas = await usuarios.colegas(ctx);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">Novo lead</h1>
          <p className="pagina__sub">
            Nome e telefone bastam. Se essa pessoa já falou com a agência, o histórico dela vem
            junto.
          </p>
        </div>
        <Link className="btn btn--discreto" href="/vendas">
          Voltar
        </Link>
      </div>

      <FormularioLead colegas={colegas} />
    </>
  );
}

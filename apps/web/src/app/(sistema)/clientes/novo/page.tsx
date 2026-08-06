import Link from "next/link";
import { notFound } from "next/navigation";
import { pode, usuarios } from "@mark/core";
import { FormularioCliente } from "@/modulos/clientes/FormularioCliente";
import { criarCliente } from "@/modulos/clientes/acoes";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function PaginaNovoCliente() {
  const ctx = await exigirContexto();

  // A ação também confere, dentro do core. Conferir aqui evita mostrar um
  // formulário inteiro que vai ser recusado no envio.
  if (!pode(ctx, "clientes.cliente.criar")) notFound();

  const colegas = await usuarios.colegas(ctx);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">Novo cliente</h1>
          <p className="pagina__sub">
            Só o nome é obrigatório. O resto pode ser preenchido depois, a qualquer momento.
          </p>
        </div>
        <Link className="btn btn--discreto" href="/clientes">
          Voltar
        </Link>
      </div>

      <FormularioCliente acao={criarCliente} colegas={colegas} />
    </>
  );
}

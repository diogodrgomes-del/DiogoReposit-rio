import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirAtor } from "@/lib/auth/sessao";
import { can, podeCliente } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { EditorEstrategia } from "./EditorEstrategia";

export const dynamic = "force-dynamic";

export default async function EstrategiaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ator = await exigirAtor();
  if (!can(ator, "estrategia:ler")) redirect("/");

  const { id } = await params;
  if (!podeCliente(ator, id)) notFound();

  const cliente = await prisma.client.findFirst({
    where: { id, organizationId: ator.organizationId, deletadoEm: null },
    include: { estrategia: true },
  });
  if (!cliente) notFound();

  const e = cliente.estrategia;

  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 sm:px-6">
      <Link
        href={`/clientes/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {cliente.nomeFantasia ?? cliente.razaoSocial}
      </Link>

      <EditorEstrategia
        clientId={id}
        valores={{
          objetivoPrincipal: e?.objetivoPrincipal ?? "",
          posicionamento: e?.posicionamento ?? "",
          publicoAlvo: e?.publicoAlvo ?? "",
          persona: e?.persona ?? "",
          tomDeVoz: e?.tomDeVoz ?? "",
          diferenciais: (e?.diferenciais ?? []).join("\n"),
          concorrentes: (e?.concorrentes ?? []).join("\n"),
          palavrasProibidas: (e?.palavrasProibidas ?? []).join("\n"),
          pilaresConteudo: (e?.pilaresConteudo ?? []).join("\n"),
          dores: (e?.dores ?? []).join("\n"),
          objecoes: (e?.objecoes ?? []).join("\n"),
        }}
        podeEditar={can(ator, "estrategia:editar")}
        atualizadoEm={e?.atualizadoEm?.toISOString() ?? null}
      />
    </div>
  );
}

import { exigirAtor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { Pagina, Secao } from "@/components/layout/Pagina";
import { Card, CardTitulo, Avatar } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ROTULO_PAPEL, PERMISSOES_POR_PAPEL } from "@/lib/auth/permissoes";
import { dataHora, relativo } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const ator = await exigirAtor();

  const [equipe, auditoria, contagens] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: ator.organizationId },
      include: {
        user: {
          select: { id: true, nome: true, email: true, ultimoLoginEm: true, ativo: true },
        },
        _count: { select: { clientes: true } },
      },
      orderBy: { papel: "asc" },
    }),
    can(ator, "organizacao:ver_auditoria")
      ? prisma.auditLog.findMany({
          where: { organizationId: ator.organizationId },
          include: { user: { select: { nome: true } } },
          orderBy: { em: "desc" },
          take: 50,
        })
      : [],
    Promise.all([
      prisma.client.count({
        where: { organizationId: ator.organizationId, deletadoEm: null },
      }),
      prisma.lead.count({
        where: { organizationId: ator.organizationId, deletadoEm: null },
      }),
      prisma.demand.count({
        where: { organizationId: ator.organizationId, deletadoEm: null },
      }),
    ]),
  ]);

  const [nClientes, nLeads, nDemandas] = contagens;
  const minhasPermissoes = PERMISSOES_POR_PAPEL[ator.papel];

  return (
    <Pagina
      titulo="Configurações"
      descricao={`${ator.organizacaoNome} · ${nClientes} clientes, ${nLeads} leads, ${nDemandas} demandas`}
    >
      <Secao titulo="Equipe">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--color-borda)] text-left text-[12px] uppercase tracking-wide text-[var(--color-texto-3)]">
                  <th className="px-4 py-2.5 font-medium">Pessoa</th>
                  <th className="px-4 py-2.5 font-medium">Papel</th>
                  <th className="px-4 py-2.5 font-medium">Escopo</th>
                  <th className="px-4 py-2.5 font-medium">Último acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borda)]">
                {equipe.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar nome={m.user.nome} tamanho={26} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {m.user.nome}
                            {m.user.id === ator.userId && (
                              <span className="ml-1.5 text-[12px] font-normal text-[var(--color-texto-3)]">
                                (você)
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[12px] text-[var(--color-texto-3)]">
                            {m.user.email}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tom={m.papel === "PROPRIETARIO" ? "ativo" : "neutro"}>
                        {ROTULO_PAPEL[m.papel]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-texto-2)]">
                      {m._count.clientes > 0
                        ? `${m._count.clientes} cliente(s)`
                        : "Todos os clientes"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-texto-3)]">
                      {m.user.ultimoLoginEm ? relativo(m.user.ultimoLoginEm) : "nunca"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="mt-2 text-[12.5px] text-[var(--color-texto-3)]">
          Convite por e-mail e edição de permissões entram na fase 1 do roadmap.
          Por enquanto, usuários são criados pelo seed
          (<code className="rounded bg-[var(--color-fundo-hover)] px-1">npm run db:seed</code>).
        </p>
      </Secao>

      <Secao titulo="Suas permissões">
        <Card className="p-4">
          <p className="mb-2.5 text-[13px] text-[var(--color-texto-2)]">
            Papel <strong>{ROTULO_PAPEL[ator.papel]}</strong> —{" "}
            {minhasPermissoes.length} permissões.
          </p>
          <div className="flex flex-wrap gap-1">
            {minhasPermissoes.map((p) => (
              <span
                key={p}
                className="rounded border border-[var(--color-borda)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-texto-2)]"
              >
                {p}
              </span>
            ))}
          </div>
        </Card>
      </Secao>

      {can(ator, "organizacao:ver_auditoria") && (
        <Secao titulo="Auditoria">
          <Card className="overflow-hidden">
            <CardTitulo>Últimas 50 ações</CardTitulo>
            <ul className="max-h-[500px] divide-y divide-[var(--color-borda)] overflow-y-auto">
              {auditoria.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2">
                  <code className="shrink-0 rounded bg-[var(--color-fundo-hover)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-texto-2)]">
                    {a.acao}
                  </code>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {a.resumo ?? `${a.entidadeTipo} ${a.entidadeId.slice(0, 8)}`}
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--color-texto-3)]">
                    {a.user?.nome ?? "Sistema"} · {dataHora(a.em)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-2 text-[12.5px] text-[var(--color-texto-3)]">
            Registros de auditoria não podem ser alterados nem apagados pela
            aplicação.
          </p>
        </Secao>
      )}
    </Pagina>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { clientes as regra, formatarTelefone, linkWhatsApp, usuarios } from "@mark/core";
import type { EventoLido } from "@mark/core";
import { FormularioCliente } from "@/modulos/clientes/FormularioCliente";
import { excluirCliente, salvarCliente } from "@/modulos/clientes/acoes";
import { SeloSaude, SeloStatus, dataHora } from "@/modulos/clientes/comuns";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/**
 * Traduz um evento da linha do tempo para uma frase.
 *
 * O evento guarda o que mudou (`{status: {de, para}}`), não uma frase pronta —
 * assim a redação pode melhorar sem reescrever o histórico já gravado, e o
 * mesmo dado serve para relatório depois.
 */
function descrever(evento: EventoLido): string {
  const dados = evento.dados as Record<string, { de?: unknown; para?: unknown } | unknown>;

  switch (evento.tipo) {
    case "cliente.criado":
      return dados.origem === "importacao"
        ? "Cliente importado do painel de campanhas"
        : "Cliente criado";
    case "cliente.excluido":
      return "Cliente enviado para a lixeira";
    case "cliente.restaurado":
      return "Cliente restaurado da lixeira";
    case "cliente.editado": {
      const campos = Object.entries(dados)
        .filter(([, v]) => v && typeof v === "object" && "para" in (v as object))
        .map(([campo, v]) => {
          const { de, para } = v as { de: unknown; para: unknown };
          const rotulo = ROTULOS[campo] ?? campo;
          return `${rotulo}: ${de ?? "vazio"} → ${para ?? "vazio"}`;
        });
      return campos.length ? campos.join(" · ") : "Cliente editado";
    }
    default:
      return evento.tipo;
  }
}

const ROTULOS: Record<string, string> = {
  nome: "Nome",
  status: "Status",
  saude: "Saúde",
  responsavelId: "Responsável",
  segmento: "Segmento",
  cidade: "Cidade",
};

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>
        {rotulo}
      </div>
      <div style={{ marginTop: 2 }}>{valor || "—"}</div>
    </div>
  );
}

export default async function PaginaCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const busca = await searchParams;
  const ctx = await exigirContexto();

  const dados = await regra.obterComHistorico(ctx, id);
  if (!dados) notFound();

  const { cliente, historico } = dados;
  const permissoes = regra.permissoesDe(ctx, id);
  const colegas = await usuarios.colegas(ctx);
  const responsavel = colegas.find((c) => c.id === cliente.responsavelId);
  const editando = busca.editar === "1";
  const zap = linkWhatsApp(cliente.telefoneE164);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">{cliente.nome}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SeloStatus status={cliente.status} />
            <SeloSaude saude={cliente.saude} />
            {cliente.nomeFantasia && <span className="pagina__sub">{cliente.nomeFantasia}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn btn--discreto" href="/clientes">
            Voltar
          </Link>
          {permissoes.editar && !editando && (
            <Link className="btn btn--acento" href={`/clientes/${id}?editar=1`}>
              Editar
            </Link>
          )}
        </div>
      </div>

      {busca.salvo === "1" && !editando && (
        <p
          className="aviso-erro"
          style={{
            background: "color-mix(in srgb, var(--good) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--good) 30%, transparent)",
            color: "var(--good)",
          }}
        >
          Alterações salvas.
        </p>
      )}

      {editando ? (
        <FormularioCliente acao={salvarCliente} cliente={cliente} colegas={colegas} />
      ) : (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)" }}>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div className="cartao">
              <div className="cartao__cabeca">
                <strong>Dados</strong>
              </div>
              <div className="cartao__corpo grade grade--2">
                <Dado rotulo="CNPJ" valor={cliente.cnpj} />
                <Dado rotulo="Segmento" valor={cliente.segmento} />
                <Dado
                  rotulo="Telefone"
                  valor={
                    zap ? (
                      <a href={zap} target="_blank" rel="noreferrer" style={{ color: "var(--acento)" }}>
                        {formatarTelefone(cliente.telefoneE164)}
                      </a>
                    ) : null
                  }
                />
                <Dado rotulo="E-mail" valor={cliente.email} />
                <Dado
                  rotulo="Cidade"
                  valor={[cliente.cidade, cliente.estado].filter(Boolean).join(" · ")}
                />
                <Dado rotulo="Responsável" valor={responsavel?.nome} />
                <Dado rotulo="Instagram" valor={cliente.instagram} />
                <Dado
                  rotulo="Site"
                  valor={
                    cliente.site ? (
                      <a href={cliente.site} target="_blank" rel="noreferrer" style={{ color: "var(--acento)" }}>
                        {cliente.site}
                      </a>
                    ) : null
                  }
                />
              </div>
            </div>

            {cliente.observacoes && (
              <div className="cartao">
                <div className="cartao__cabeca">
                  <strong>Observações</strong>
                </div>
                <div className="cartao__corpo" style={{ whiteSpace: "pre-wrap" }}>
                  {cliente.observacoes}
                </div>
              </div>
            )}

            {permissoes.excluir && (
              <div className="cartao">
                <div className="cartao__cabeca">
                  <strong>Zona de risco</strong>
                </div>
                <div className="cartao__corpo">
                  <p className="pagina__sub" style={{ marginBottom: 12 }}>
                    Enviar para a lixeira tira o cliente das listas e da busca, mas não apaga nada:
                    dá para restaurar depois.
                  </p>
                  <form action={excluirCliente}>
                    <input type="hidden" name="id" value={cliente.id} />
                    <button type="submit" className="btn btn--risco">
                      Enviar para a lixeira
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <div className="cartao" style={{ alignSelf: "start" }}>
            <div className="cartao__cabeca">
              <strong>Histórico</strong>
            </div>
            <div className="cartao__corpo">
              {historico.length === 0 ? (
                <p className="pagina__sub">Nada registrado ainda.</p>
              ) : (
                <ul className="tempo">
                  {historico.map((e) => (
                    <li key={e.id} className="tempo__item">
                      <span className="tempo__ponto" aria-hidden />
                      <div>
                        <p className="tempo__texto">{descrever(e)}</p>
                        <p className="tempo__quando">{dataHora(e.criadoEm)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

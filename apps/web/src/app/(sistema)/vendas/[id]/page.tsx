import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarTelefone, leads as regra, linkWhatsApp, usuarios } from "@mark/core";
import { converterEmCliente, excluirLead, registrarMotivoPerda } from "@/modulos/vendas/acoes";
import { data } from "@/modulos/clientes/comuns";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Rótulos legíveis para os motivos do requisito 7.8. */
const MOTIVOS: Record<string, string> = {
  preco: "Preço",
  sem_orcamento: "Sem orçamento",
  nao_respondeu: "Não respondeu",
  concorrente: "Fechou com concorrente",
  nao_era_momento: "Não era o momento",
  servico_incompativel: "Serviço não compatível",
  desistiu: "Desistiu",
  sem_interesse: "Sem interesse",
  outro: "Outro",
};

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--ink-3)",
        }}
      >
        {rotulo}
      </div>
      <div style={{ marginTop: 2 }}>{valor || "—"}</div>
    </div>
  );
}

export default async function PaginaLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirContexto();

  const lead = await regra.obter(ctx, id);
  if (!lead) notFound();

  const permissoes = regra.permissoesDe(ctx);
  const colegas = await usuarios.colegas(ctx);
  const responsavel = colegas.find((c) => c.id === lead.responsavelId);
  const zap = linkWhatsApp(lead.telefone);
  const perdido = Boolean(lead.perdidoEm);

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">{lead.nome}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="selo">{lead.etapaNome}</span>
            {lead.fechadoEm && <span className="selo selo--verde">Fechado</span>}
            {perdido && <span className="selo selo--vermelho">Perdido</span>}
            {lead.empresa && <span className="pagina__sub">{lead.empresa}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn btn--discreto" href="/vendas">
            Voltar ao quadro
          </Link>
          {zap && (
            <a className="btn btn--acento" href={zap} target="_blank" rel="noreferrer">
              Abrir no WhatsApp
            </a>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)",
        }}
      >
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="cartao">
            <div className="cartao__cabeca">
              <strong>Dados</strong>
            </div>
            <div className="cartao__corpo grade grade--2">
              <Dado
                rotulo="Telefone"
                valor={
                  zap ? (
                    <a href={zap} target="_blank" rel="noreferrer" style={{ color: "var(--acento)" }}>
                      {formatarTelefone(lead.telefone)}
                    </a>
                  ) : null
                }
              />
              <Dado rotulo="E-mail" valor={lead.email} />
              <Dado rotulo="Empresa" valor={lead.empresa} />
              <Dado rotulo="Cidade" valor={lead.cidade} />
              <Dado rotulo="Origem" valor={lead.origem} />
              <Dado rotulo="Serviço" valor={lead.servico} />
              <Dado
                rotulo="Valor estimado"
                valor={lead.valorEstimado === null ? null : moeda.format(lead.valorEstimado)}
              />
              <Dado rotulo="Temperatura" valor={lead.temperatura} />
              <Dado rotulo="Responsável" valor={responsavel?.nome} />
              <Dado rotulo="Criado em" valor={data(lead.criadoEm)} />
            </div>
          </div>

          {lead.observacoes && (
            <div className="cartao">
              <div className="cartao__cabeca">
                <strong>Observações</strong>
              </div>
              <div className="cartao__corpo" style={{ whiteSpace: "pre-wrap" }}>
                {lead.observacoes}
              </div>
            </div>
          )}

          {permissoes.excluir && (
            <div className="cartao">
              <div className="cartao__cabeca">
                <strong>Zona de risco</strong>
              </div>
              <div className="cartao__corpo">
                <form action={excluirLead}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button type="submit" className="btn btn--risco">
                    Enviar para a lixeira
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {/* Conversão só aparece enquanto o lead está vivo e sem cliente.
              Depois de convertido, a ficha do cliente é que manda. */}
          {!perdido && !lead.clienteId && permissoes.editar && (
            <div className="cartao">
              <div className="cartao__cabeca">
                <strong>Fechou?</strong>
              </div>
              <div className="cartao__corpo">
                <p className="pagina__sub" style={{ marginBottom: 12 }}>
                  Vira cliente sem copiar nada: o contato continua o mesmo, então a conversa de
                  WhatsApp e todo o histórico seguem junto.
                </p>
                <form action={converterEmCliente} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="id" value={lead.id} />
                  <label className="campo-sis">
                    <span>
                      Nome do cliente<span className="opcional"> · opcional</span>
                    </span>
                    <input
                      name="nomeCliente"
                      defaultValue={lead.empresa ?? lead.nome}
                      placeholder="Nome da empresa"
                    />
                  </label>
                  <button type="submit" className="btn btn--acento">
                    Transformar em cliente
                  </button>
                </form>
              </div>
            </div>
          )}

          {lead.clienteId && (
            <div className="cartao">
              <div className="cartao__cabeca">
                <strong>Virou cliente</strong>
              </div>
              <div className="cartao__corpo">
                <Link className="btn" href={`/clientes/${lead.clienteId}`}>
                  Abrir ficha do cliente
                </Link>
              </div>
            </div>
          )}

          {/* Motivo de perda só aparece quando o card já está na coluna de
              perda. Pedir antes seria perguntar sobre algo que não aconteceu. */}
          {perdido && permissoes.editar && (
            <div className="cartao">
              <div className="cartao__cabeca">
                <strong>Motivo da perda</strong>
              </div>
              <div className="cartao__corpo">
                {lead.motivoPerda ? (
                  <p style={{ margin: 0 }}>{MOTIVOS[lead.motivoPerda] ?? lead.motivoPerda}</p>
                ) : (
                  <form action={registrarMotivoPerda} style={{ display: "grid", gap: 10 }}>
                    <input type="hidden" name="id" value={lead.id} />
                    <label className="campo-sis">
                      <span className="opcional">Pode pular, se não souber</span>
                      <select name="motivo" defaultValue="">
                        <option value="">Não informar</option>
                        {Object.entries(MOTIVOS).map(([valor, rotulo]) => (
                          <option key={valor} value={valor}>
                            {rotulo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="btn">
                      Registrar
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          <div className="cartao">
            <div className="cartao__cabeca">
              <strong>Próximo passo</strong>
            </div>
            <div className="cartao__corpo">
              <Dado rotulo="Ação" valor={lead.proximaAcao} />
              <div style={{ marginTop: 12 }}>
                <Dado
                  rotulo="Retorno em"
                  valor={lead.proximoContatoEm ? data(new Date(lead.proximoContatoEm)) : null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  Mail,
  Building2,
  AtSign,
  MapPin,
  Trash2,
  UserPlus,
  XCircle,
  Plus,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Campo, Input, Select, Textarea } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Card, CardTitulo } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Vazio } from "@/components/ui/Estados";
import { useToast } from "@/components/ui/Toast";
import { moeda, dataHora, relativo, telefoneBonito } from "@/lib/formato";
import {
  editarLead,
  converterEmCliente,
  marcarPerdido,
  excluirLead,
  registrarAtividade,
} from "../../acoes";

type Lead = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empresa: string | null;
  instagram: string | null;
  cidade: string | null;
  valorCents: number;
  temperatura: "FRIO" | "MORNO" | "QUENTE" | null;
  servicoInteresse: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string;
  observacoes: string | null;
  etapa: string;
  etapaTipo: string;
  responsavelId: string;
  origemId: string;
  motivoPerda: string | null;
  perdidoEm: string | null;
  ganhoEm: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  criadoEm: string;
};

const TIPOS_ATIVIDADE = [
  ["LIGACAO", "Ligação"],
  ["REUNIAO", "Reunião"],
  ["FOLLOWUP", "Follow-up"],
  ["MENSAGEM", "Mensagem"],
  ["VISITA", "Visita"],
  ["APRESENTACAO", "Apresentação"],
  ["PROPOSTA", "Envio de proposta"],
  ["TAREFA", "Tarefa"],
] as const;

export function FichaLead({
  lead,
  atividades,
  propostas,
  historico,
  equipe,
  origens,
  motivos,
  planos,
  podeEditar,
  podeConverter,
  podeExcluir,
}: {
  lead: Lead;
  atividades: {
    id: string;
    tipo: string;
    titulo: string;
    responsavel: string | null;
    iniciaEm: string | null;
    concluidaEm: string | null;
    criadoEm: string;
  }[];
  propostas: { id: string; titulo: string; valorCents: number; status: string }[];
  historico: {
    id: string;
    acao: string;
    resumo: string;
    usuario: string;
    em: string;
  }[];
  equipe: { id: string; nome: string }[];
  origens: { id: string; nome: string }[];
  motivos: { id: string; nome: string }[];
  planos: { id: string; nome: string; valorBaseCents: number }[];
  podeEditar: boolean;
  podeConverter: boolean;
  podeExcluir: boolean;
}) {
  const [converter, setConverter] = useState(false);
  const [perder, setPerder] = useState(false);
  const [novaAtividade, setNovaAtividade] = useState(false);
  const [salvando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  /** Salvamento automático: sem botão Salvar que possa ser esquecido. */
  function salvarCampo(campo: string, valor: string | number | null) {
    if (!podeEditar) return;
    iniciar(async () => {
      const r = await editarLead({ id: lead.id, [campo]: valor });
      if (!r.ok) toast(r.erro, { tom: "erro" });
      else router.refresh();
    });
  }

  function apagar() {
    iniciar(async () => {
      const r = await excluirLead(lead.id);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Lead enviado para a lixeira.");
      router.push("/vendas");
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight">
              {lead.nome}
            </h1>
            <Badge tom={lead.etapaTipo === "GANHO" ? "sucesso" : lead.etapaTipo === "PERDIDO" ? "erro" : "ativo"}>
              {lead.etapa}
            </Badge>
            {lead.temperatura && (
              <Badge
                tom={
                  lead.temperatura === "QUENTE"
                    ? "erro"
                    : lead.temperatura === "MORNO"
                      ? "alerta"
                      : "neutro"
                }
              >
                {lead.temperatura.toLowerCase()}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[13px] text-[var(--color-texto-2)]">
            {lead.empresa ?? "Sem empresa"} · criado {relativo(lead.criadoEm)}
            {salvando && " · salvando…"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lead.clienteId ? (
            <Link href={`/clientes/${lead.clienteId}`}>
              <Button variante="secondary">
                <Building2 className="h-4 w-4" />
                Ver cliente
              </Button>
            </Link>
          ) : (
            podeConverter &&
            !lead.perdidoEm && (
              <Button variante="primary" onClick={() => setConverter(true)}>
                <UserPlus className="h-4 w-4" />
                Virar cliente
              </Button>
            )
          )}
          {podeEditar && !lead.perdidoEm && !lead.clienteId && (
            <Button onClick={() => setPerder(true)}>
              <XCircle className="h-4 w-4" />
              Marcar perdido
            </Button>
          )}
          {podeExcluir && (
            <Button variante="ghost" onClick={apagar} title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {lead.perdidoEm && (
        <div className="mb-5 rounded-lg border border-[var(--color-erro)] bg-[var(--color-erro-fundo)] px-4 py-3 text-[13px] text-[var(--color-erro-texto)]">
          Lead perdido em {dataHora(lead.perdidoEm)}
          {lead.motivoPerda ? ` — ${lead.motivoPerda}` : ""}.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardTitulo>Dados</CardTitulo>
            <div className="grid gap-3.5 p-4 sm:grid-cols-2">
              <Campo label="Nome">
                <Input
                  defaultValue={lead.nome}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== lead.nome &&
                    salvarCampo("nome", e.target.value)
                  }
                />
              </Campo>
              <Campo label="Telefone">
                <Input
                  defaultValue={telefoneBonito(lead.telefone)}
                  disabled={!podeEditar}
                  onBlur={(e) => salvarCampo("telefone", e.target.value)}
                />
              </Campo>
              <Campo label="E-mail">
                <Input
                  type="email"
                  defaultValue={lead.email ?? ""}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== (lead.email ?? "") &&
                    salvarCampo("email", e.target.value)
                  }
                />
              </Campo>
              <Campo label="Empresa">
                <Input
                  defaultValue={lead.empresa ?? ""}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== (lead.empresa ?? "") &&
                    salvarCampo("empresa", e.target.value)
                  }
                />
              </Campo>
              <Campo label="Instagram">
                <Input
                  defaultValue={lead.instagram ?? ""}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== (lead.instagram ?? "") &&
                    salvarCampo("instagram", e.target.value)
                  }
                />
              </Campo>
              <Campo label="Cidade">
                <Input
                  defaultValue={lead.cidade ?? ""}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== (lead.cidade ?? "") &&
                    salvarCampo("cidade", e.target.value)
                  }
                />
              </Campo>
              <Campo label="Serviço procurado">
                <Input
                  defaultValue={lead.servicoInteresse ?? ""}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== (lead.servicoInteresse ?? "") &&
                    salvarCampo("servicoInteresse", e.target.value)
                  }
                />
              </Campo>
              <Campo label="Valor estimado (R$)">
                <Input
                  type="number"
                  min={0}
                  defaultValue={Math.round(lead.valorCents / 100)}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    salvarCampo("valorEstimado", Number(e.target.value || 0))
                  }
                />
              </Campo>
              <Campo label="Observações" className="sm:col-span-2">
                <Textarea
                  defaultValue={lead.observacoes ?? ""}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== (lead.observacoes ?? "") &&
                    salvarCampo("observacoes", e.target.value)
                  }
                />
              </Campo>
            </div>
          </Card>

          <Card>
            <CardTitulo
              acao={
                podeEditar && (
                  <Button tamanho="sm" onClick={() => setNovaAtividade(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Registrar
                  </Button>
                )
              }
            >
              Atividades
            </CardTitulo>
            {atividades.length === 0 ? (
              <Vazio
                titulo="Nenhuma atividade"
                descricao="Registre ligações, reuniões e follow-ups para não perder o fio."
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-[var(--color-borda)]">
                {atividades.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                    <Badge tom={a.concluidaEm ? "neutro" : "ativo"}>
                      {TIPOS_ATIVIDADE.find((t) => t[0] === a.tipo)?.[1] ?? a.tipo}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px]">{a.titulo}</p>
                      <p className="text-[12px] text-[var(--color-texto-3)]">
                        {a.responsavel ?? "—"} ·{" "}
                        {a.iniciaEm ? dataHora(a.iniciaEm) : relativo(a.criadoEm)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {propostas.length > 0 && (
            <Card>
              <CardTitulo>Propostas</CardTitulo>
              <ul className="divide-y divide-[var(--color-borda)]">
                {propostas.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="flex-1 truncate text-[13.5px]">
                      {p.titulo}
                    </span>
                    <span className="tabular text-[13px] font-medium">
                      {moeda(p.valorCents)}
                    </span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitulo>Gestão</CardTitulo>
            <div className="space-y-3.5 p-4">
              <Campo label="Responsável">
                <Select
                  defaultValue={lead.responsavelId}
                  disabled={!podeEditar}
                  onChange={(e) => salvarCampo("responsavelId", e.target.value)}
                >
                  <option value="">—</option>
                  {equipe.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Origem">
                <Select
                  defaultValue={lead.origemId}
                  disabled={!podeEditar}
                  onChange={(e) => salvarCampo("origemId", e.target.value)}
                >
                  <option value="">—</option>
                  {origens.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Temperatura">
                <Select
                  defaultValue={lead.temperatura ?? ""}
                  disabled={!podeEditar}
                  onChange={(e) =>
                    salvarCampo("temperatura", e.target.value || null)
                  }
                >
                  <option value="">—</option>
                  <option value="FRIO">Frio</option>
                  <option value="MORNO">Morno</option>
                  <option value="QUENTE">Quente</option>
                </Select>
              </Campo>
              <Campo label="Próxima ação">
                <Input
                  defaultValue={lead.proximaAcao ?? ""}
                  disabled={!podeEditar}
                  placeholder="Ligar para confirmar reunião"
                  onBlur={(e) =>
                    e.target.value !== (lead.proximaAcao ?? "") &&
                    salvarCampo("proximaAcao", e.target.value)
                  }
                />
              </Campo>
              <Campo
                label="Data da próxima ação"
                ajuda="É o que alimenta o alerta de lead sem retorno."
              >
                <Input
                  type="date"
                  defaultValue={lead.proximaAcaoEm}
                  disabled={!podeEditar}
                  onChange={(e) => salvarCampo("proximaAcaoEm", e.target.value)}
                />
              </Campo>
            </div>
          </Card>

          <Card>
            <CardTitulo>Contato rápido</CardTitulo>
            <div className="space-y-1.5 p-4 text-[13px]">
              {lead.telefone && (
                <a
                  href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-azul-600 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {telefoneBonito(lead.telefone)}
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 text-azul-600 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {lead.email}
                </a>
              )}
              {lead.instagram && (
                <p className="flex items-center gap-2 text-[var(--color-texto-2)]">
                  <AtSign className="h-3.5 w-3.5" />
                  {lead.instagram}
                </p>
              )}
              {lead.cidade && (
                <p className="flex items-center gap-2 text-[var(--color-texto-2)]">
                  <MapPin className="h-3.5 w-3.5" />
                  {lead.cidade}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardTitulo>
              <span className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Histórico
              </span>
            </CardTitulo>
            {historico.length === 0 ? (
              <p className="p-4 text-[13px] text-[var(--color-texto-3)]">
                Sem registros ainda.
              </p>
            ) : (
              <ul className="max-h-[380px] space-y-0 overflow-y-auto">
                {historico.map((h) => (
                  <li
                    key={h.id}
                    className="border-b border-[var(--color-borda)] px-4 py-2 last:border-0"
                  >
                    <p className="text-[12.5px]">{h.resumo}</p>
                    <p className="text-[11.5px] text-[var(--color-texto-3)]">
                      {h.usuario} · {relativo(h.em)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ModalConverter
        aberto={converter}
        aoFechar={() => setConverter(false)}
        lead={lead}
        planos={planos}
        equipe={equipe}
      />
      <ModalPerder
        aberto={perder}
        aoFechar={() => setPerder(false)}
        leadId={lead.id}
        motivos={motivos}
      />
      <ModalAtividade
        aberto={novaAtividade}
        aoFechar={() => setNovaAtividade(false)}
        leadId={lead.id}
      />
    </>
  );
}

function ModalConverter({
  aberto,
  aoFechar,
  lead,
  planos,
  equipe,
}: {
  aberto: boolean;
  aoFechar: () => void;
  lead: Lead;
  planos: { id: string; nome: string; valorBaseCents: number }[];
  equipe: { id: string; nome: string }[];
}) {
  const [enviando, iniciar] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    setErros({});
    iniciar(async () => {
      const r = await converterEmCliente({
        leadId: lead.id,
        razaoSocial: String(form.get("razaoSocial") ?? ""),
        planoId: String(form.get("plano") ?? ""),
        valorMensal: Number(form.get("valor") ?? 0),
        diaVencimento: Number(form.get("dia") ?? 10),
        responsavelId: String(form.get("responsavel") ?? ""),
      });
      if (!r.ok) {
        setErros(r.campos ?? {});
        return toast(r.erro, { tom: "erro" });
      }
      toast("Cliente criado com contrato, projeto e primeira mensalidade.");
      aoFechar();
      router.push(`/clientes/${r.dados.clientId}`);
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Transformar em cliente"
      descricao="Cria cliente, contrato, projeto, estratégia e a primeira mensalidade — tudo numa transação."
      largura="sm"
    >
      <form action={enviar} className="space-y-3.5">
        <Campo label="Nome da empresa" obrigatorio erro={erros.razaoSocial}>
          <Input
            name="razaoSocial"
            required
            autoFocus
            defaultValue={lead.empresa ?? lead.nome}
          />
        </Campo>

        <Campo label="Plano">
          <Select name="plano" defaultValue="">
            <option value="">Sem plano</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} — {moeda(p.valorBaseCents)}
              </option>
            ))}
          </Select>
        </Campo>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Valor mensal (R$)">
            <Input
              name="valor"
              type="number"
              min={0}
              defaultValue={Math.round(lead.valorCents / 100) || 0}
            />
          </Campo>
          <Campo label="Dia do vencimento">
            <Input name="dia" type="number" min={1} max={28} defaultValue={10} />
          </Campo>
        </div>

        <Campo label="Responsável interno">
          <Select name="responsavel" defaultValue={lead.responsavelId}>
            <option value="">—</option>
            {equipe.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Campo>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" variante="primary" carregando={enviando}>
            Criar cliente
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalPerder({
  aberto,
  aoFechar,
  leadId,
  motivos,
}: {
  aberto: boolean;
  aoFechar: () => void;
  leadId: string;
  motivos: { id: string; nome: string }[];
}) {
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    const motivo = String(form.get("motivo") ?? "");
    iniciar(async () => {
      const r = await marcarPerdido(leadId, motivo || null);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Lead marcado como perdido.");
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Marcar como perdido"
      descricao="O motivo pode ser pulado — obrigar a escolher faz a pessoa escolher qualquer um."
      largura="sm"
    >
      <form action={enviar} className="space-y-3.5">
        <Campo label="Motivo da perda">
          <Select name="motivo" defaultValue="" autoFocus>
            <option value="">Não informar</option>
            {motivos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" variante="destructive" carregando={enviando}>
            Marcar perdido
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalAtividade({
  aberto,
  aoFechar,
  leadId,
}: {
  aberto: boolean;
  aoFechar: () => void;
  leadId: string;
}) {
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    iniciar(async () => {
      const r = await registrarAtividade({
        leadId,
        tipo: String(form.get("tipo") ?? "LIGACAO") as "LIGACAO",
        titulo: String(form.get("titulo") ?? ""),
        iniciaEm: String(form.get("quando") ?? ""),
      });
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Atividade registrada.");
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Registrar atividade"
      largura="sm"
    >
      <form action={enviar} className="space-y-3.5">
        <Campo label="Tipo">
          <Select name="tipo" defaultValue="LIGACAO" autoFocus>
            {TIPOS_ATIVIDADE.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="O que aconteceu" obrigatorio>
          <Input name="titulo" required placeholder="Ligou, pediu proposta" />
        </Campo>
        <Campo
          label="Agendar para"
          ajuda="Em branco, fica registrada como já concluída."
        >
          <Input name="quando" type="datetime-local" />
        </Campo>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" variante="primary" carregando={enviando}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

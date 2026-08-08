"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, CheckSquare, Clock } from "lucide-react";
import { Pagina } from "@/components/layout/Pagina";
import { Button } from "@/components/ui/Button";
import { Campo, Input, Select, Textarea } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Kanban, type ColunaKanban } from "@/components/kanban/Kanban";
import { dataCurta } from "@/lib/formato";
import { cn } from "@/lib/cn";
import { criarDemanda, moverDemanda } from "./acoes";

type DemandaCard = {
  id: string;
  stageId: string;
  posicao: number;
  titulo: string;
  prioridade: "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";
  prazoEm: string | null;
  cliente: string | null;
  responsavel: string | null;
  tipo: string | null;
  subtarefas: number;
};

export function QuadroDemandas({
  etapas,
  demandas,
  clientes,
  tipos,
  equipe,
  filtroCliente,
  filtroResponsavel,
  podeCriar,
  podeMover,
  vejoTudo,
  meuId,
  abrirNova,
}: {
  etapas: ColunaKanban[];
  demandas: DemandaCard[];
  clientes: { id: string; nome: string }[];
  tipos: { id: string; nome: string }[];
  equipe: { id: string; nome: string }[];
  filtroCliente: string;
  filtroResponsavel: string;
  podeCriar: boolean;
  podeMover: boolean;
  vejoTudo: boolean;
  meuId: string;
  abrirNova: boolean;
}) {
  const [nova, setNova] = useState(abrirNova);
  const [etapaAlvo, setEtapaAlvo] = useState<string | null>(null);
  const router = useRouter();

  function filtrar(chave: string, valor: string) {
    const p = new URLSearchParams();
    if (chave === "cliente" ? valor : filtroCliente)
      p.set("cliente", chave === "cliente" ? valor : filtroCliente);
    if (chave === "responsavel" ? valor : filtroResponsavel)
      p.set("responsavel", chave === "responsavel" ? valor : filtroResponsavel);
    // Filtro na URL: o estado é compartilhável e o botão voltar funciona.
    router.push(`/demandas${p.toString() ? `?${p}` : ""}`);
  }

  const atrasadas = demandas.filter(
    (d) => d.prazoEm && new Date(d.prazoEm) < new Date()
  ).length;

  return (
    <Pagina
      largura="cheia"
      titulo="Demandas"
      descricao={
        atrasadas > 0
          ? `${demandas.length} em aberto · ${atrasadas} atrasada(s)`
          : `${demandas.length} em aberto`
      }
      acoes={
        <>
          <Select
            value={filtroCliente}
            onChange={(e) => filtrar("cliente", e.target.value)}
            className="w-44"
            aria-label="Filtrar por cliente"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          {vejoTudo && (
            <Select
              value={filtroResponsavel}
              onChange={(e) => filtrar("responsavel", e.target.value)}
              className="w-40"
              aria-label="Filtrar por responsável"
            >
              <option value="">Toda a equipe</option>
              <option value={meuId}>Só as minhas</option>
              {equipe
                .filter((u) => u.id !== meuId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
            </Select>
          )}

          {podeCriar && (
            <Button
              variante="primary"
              onClick={() => {
                setEtapaAlvo(null);
                setNova(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova demanda
            </Button>
          )}
        </>
      }
    >
      <Kanban
        colunas={etapas}
        cards={demandas}
        aoMover={
          podeMover
            ? moverDemanda
            : async () => ({ ok: false as const, erro: "Sem permissão para mover." })
        }
        renderCard={(d) => <CardDemanda demanda={d} />}
        vazioColuna={() => (
          <p className="px-2 py-6 text-center text-[12px] text-[var(--color-texto-3)]">
            Vazio
          </p>
        )}
        rodapeColuna={
          podeCriar
            ? (coluna) => (
                <button
                  type="button"
                  onClick={() => {
                    setEtapaAlvo(coluna.id);
                    setNova(true);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-[var(--color-texto-3)] hover:bg-[var(--color-fundo-hover)] hover:text-[var(--color-texto)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              )
            : undefined
        }
      />

      <ModalNovaDemanda
        aberto={nova}
        aoFechar={() => {
          setNova(false);
          if (abrirNova) router.replace("/demandas");
        }}
        etapaId={etapaAlvo}
        clientes={clientes}
        tipos={tipos}
        equipe={equipe}
      />
    </Pagina>
  );
}

function CardDemanda({ demanda }: { demanda: DemandaCard }) {
  const atrasada = demanda.prazoEm && new Date(demanda.prazoEm) < new Date();

  return (
    <Link
      href={`/demandas/${demanda.id}`}
      className="block rounded-md border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] p-2.5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start gap-2">
        {/* Prioridade como barra: presente na visão periférica, ausente da leitura. */}
        <span
          className={cn(
            "mt-0.5 h-8 w-[3px] shrink-0 rounded-full",
            demanda.prioridade === "URGENTE"
              ? "bg-[var(--color-erro)]"
              : demanda.prioridade === "ALTA"
                ? "bg-[var(--color-alerta)]"
                : "bg-transparent"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium leading-tight">
            {demanda.titulo}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-texto-2)]">
            {demanda.cliente ?? "Interno"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {demanda.tipo && (
          <span className="rounded border border-[var(--color-borda)] px-1.5 py-0.5 text-[11px] text-[var(--color-texto-2)]">
            {demanda.tipo}
          </span>
        )}
        {demanda.subtarefas > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-texto-3)]">
            <CheckSquare className="h-3 w-3" />
            {demanda.subtarefas}
          </span>
        )}
        <span className="flex-1" />
        {demanda.prazoEm && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px]",
              atrasada
                ? "font-medium text-[var(--color-erro)]"
                : "text-[var(--color-texto-3)]"
            )}
          >
            <Clock className="h-3 w-3" />
            {dataCurta(demanda.prazoEm)}
          </span>
        )}
        {demanda.responsavel && (
          <Avatar nome={demanda.responsavel} tamanho={20} />
        )}
      </div>
    </Link>
  );
}

function ModalNovaDemanda({
  aberto,
  aoFechar,
  etapaId,
  clientes,
  tipos,
  equipe,
}: {
  aberto: boolean;
  aoFechar: () => void;
  etapaId: string | null;
  clientes: { id: string; nome: string }[];
  tipos: { id: string; nome: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const [erros, setErros] = useState<Record<string, string>>({});
  const [interno, setInterno] = useState(false);
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    setErros({});
    iniciar(async () => {
      const r = await criarDemanda({
        titulo: String(form.get("titulo") ?? ""),
        clientId: interno ? "" : String(form.get("cliente") ?? ""),
        interno,
        descricao: String(form.get("descricao") ?? ""),
        tipoId: String(form.get("tipo") ?? ""),
        responsavelId: String(form.get("responsavel") ?? ""),
        prioridade: String(form.get("prioridade") ?? "NORMAL") as "NORMAL",
        prazoEm: String(form.get("prazo") ?? ""),
        stageId: etapaId ?? undefined,
      });

      if (!r.ok) {
        setErros(r.campos ?? {});
        return toast(r.erro, { tom: "erro" });
      }

      toast("Demanda criada.", {
        acao: {
          rotulo: "Abrir",
          aoClicar: () => router.push(`/demandas/${r.dados.id}`),
        },
      });
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova demanda"
      descricao="Título e cliente bastam. Prazo, responsável e checklist entram depois."
      largura="sm"
    >
      <form action={enviar} className="space-y-3.5">
        <Campo label="Título" obrigatorio erro={erros.titulo}>
          <Input
            name="titulo"
            required
            autoFocus
            placeholder="Editar vídeo do lançamento"
          />
        </Campo>

        <Campo label="Cliente" obrigatorio erro={erros.clientId}>
          <Select name="cliente" defaultValue="" disabled={interno}>
            <option value="">Escolha…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[var(--color-texto-2)]">
            <input
              type="checkbox"
              checked={interno}
              onChange={(e) => setInterno(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--color-azul-600)]"
            />
            Demanda interna da agência
          </label>
        </Campo>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Tipo">
            <Select name="tipo" defaultValue="">
              <option value="">—</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Prioridade">
            <Select name="prioridade" defaultValue="NORMAL">
              <option value="BAIXA">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </Select>
          </Campo>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Responsável">
            <Select name="responsavel" defaultValue="">
              <option value="">Ninguém ainda</option>
              {equipe.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Prazo">
            <Input name="prazo" type="date" />
          </Campo>
        </div>

        <Campo label="Briefing">
          <Textarea name="descricao" placeholder="Opcional" />
        </Campo>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" variante="primary" carregando={enviando}>
            Criar demanda
          </Button>
        </div>
      </form>
    </Modal>
  );
}

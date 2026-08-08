"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Flame, Phone, AlertTriangle } from "lucide-react";
import { Pagina } from "@/components/layout/Pagina";
import { Button } from "@/components/ui/Button";
import { Campo, Input, Select } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Kanban, type ColunaKanban } from "@/components/kanban/Kanban";
import { moeda, dataCurta, telefoneBonito } from "@/lib/formato";
import { cn } from "@/lib/cn";
import { criarLead, moverLead } from "./acoes";

type LeadCard = {
  id: string;
  stageId: string;
  posicao: number;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  valorCents: number;
  temperatura: "FRIO" | "MORNO" | "QUENTE" | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  responsavel: string | null;
};

export function PipelineVendas({
  etapas,
  leads,
  origens,
  equipe,
  podeCriar,
  podeMover,
  filtroSemRetorno,
  abrirNovo,
}: {
  etapas: ColunaKanban[];
  leads: LeadCard[];
  origens: { id: string; nome: string }[];
  motivos: { id: string; nome: string }[];
  equipe: { id: string; nome: string }[];
  planos: { id: string; nome: string; valorBaseCents: number }[];
  podeCriar: boolean;
  podeMover: boolean;
  podeConverter: boolean;
  filtroSemRetorno: boolean;
  abrirNovo: boolean;
}) {
  const [novo, setNovo] = useState(abrirNovo);
  const [etapaAlvo, setEtapaAlvo] = useState<string | null>(null);
  const router = useRouter();

  const total = leads.reduce((s, l) => s + l.valorCents, 0);

  return (
    <Pagina
      largura="cheia"
      titulo="Pipeline comercial"
      descricao={`${leads.length} leads · ${moeda(total)} em negociação`}
      acoes={
        <>
          {filtroSemRetorno && (
            <Link
              href="/vendas"
              className="rounded-md border border-[var(--color-borda-forte)] px-2.5 py-1.5 text-[13px] text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)]"
            >
              Limpar filtro
            </Link>
          )}
          <Link
            href="/vendas?semRetorno=1"
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[13px]",
              filtroSemRetorno
                ? "border-azul-600 bg-azul-50 text-azul-700"
                : "border-[var(--color-borda-forte)] text-[var(--color-texto-2)] hover:bg-[var(--color-fundo-hover)]"
            )}
          >
            Sem retorno
          </Link>
          {podeCriar && (
            <Button
              variante="primary"
              onClick={() => {
                setEtapaAlvo(null);
                setNovo(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo lead
            </Button>
          )}
        </>
      }
    >
      <Kanban
        colunas={etapas}
        cards={leads}
        aoMover={
          podeMover
            ? moverLead
            : async () => ({ ok: false as const, erro: "Sem permissão para mover leads." })
        }
        renderCard={(lead) => <CardLead lead={lead} />}
        vazioColuna={() => (
          <p className="px-2 py-6 text-center text-[12px] text-[var(--color-texto-3)]">
            Nenhum lead aqui
          </p>
        )}
        rodapeColuna={
          podeCriar
            ? (coluna) => (
                <button
                  type="button"
                  onClick={() => {
                    setEtapaAlvo(coluna.id);
                    setNovo(true);
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

      <ModalNovoLead
        aberto={novo}
        aoFechar={() => {
          setNovo(false);
          if (abrirNovo) router.replace("/vendas");
        }}
        etapaId={etapaAlvo}
        origens={origens}
        equipe={equipe}
      />
    </Pagina>
  );
}

/**
 * Cinco informações, não doze. Card de kanban é para escolher o que abrir.
 * A prioridade/temperatura é a barra à esquerda: presente na visão periférica,
 * ausente da leitura.
 */
function CardLead({ lead }: { lead: LeadCard }) {
  const atrasado =
    lead.proximaAcaoEm && new Date(lead.proximaAcaoEm) < new Date();

  return (
    <Link
      href={`/vendas/lead/${lead.id}`}
      onClick={(e) => e.stopPropagation()}
      className="block rounded-md border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] p-2.5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 h-8 w-[3px] shrink-0 rounded-full",
            lead.temperatura === "QUENTE"
              ? "bg-[var(--color-erro)]"
              : lead.temperatura === "MORNO"
                ? "bg-[var(--color-alerta)]"
                : "bg-transparent"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium leading-tight">
            {lead.nome}
          </p>
          {lead.empresa && (
            <p className="truncate text-[12px] text-[var(--color-texto-2)]">
              {lead.empresa}
            </p>
          )}
        </div>
        {lead.temperatura === "QUENTE" && (
          <Flame className="h-3.5 w-3.5 shrink-0 text-[var(--color-erro)]" />
        )}
      </div>

      {lead.telefone && (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[var(--color-texto-3)]">
          <Phone className="h-3 w-3" />
          {telefoneBonito(lead.telefone)}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="tabular text-[12.5px] font-medium">
          {lead.valorCents > 0 ? moeda(lead.valorCents) : "—"}
        </span>
        <div className="flex items-center gap-1.5">
          {lead.proximaAcaoEm && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[11px]",
                atrasado
                  ? "font-medium text-[var(--color-erro)]"
                  : "text-[var(--color-texto-3)]"
              )}
            >
              {atrasado && <AlertTriangle className="h-3 w-3" />}
              {dataCurta(lead.proximaAcaoEm)}
            </span>
          )}
          {lead.responsavel && <Avatar nome={lead.responsavel} tamanho={20} />}
        </div>
      </div>
    </Link>
  );
}

function ModalNovoLead({
  aberto,
  aoFechar,
  etapaId,
  origens,
  equipe,
}: {
  aberto: boolean;
  aoFechar: () => void;
  etapaId: string | null;
  origens: { id: string; nome: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    setErros({});
    iniciar(async () => {
      const r = await criarLead({
        nome: String(form.get("nome") ?? ""),
        telefone: String(form.get("telefone") ?? ""),
        empresa: String(form.get("empresa") ?? ""),
        valorEstimado: Number(form.get("valor") ?? 0),
        origemId: String(form.get("origem") ?? ""),
        responsavelId: String(form.get("responsavel") ?? ""),
        stageId: etapaId ?? undefined,
      });

      if (!r.ok) {
        setErros(r.campos ?? {});
        toast(r.erro, { tom: "erro" });
        return;
      }

      toast(
        r.dados.jaExistia
          ? "Esse telefone já tem um lead aberto no pipeline."
          : "Lead criado.",
        {
          tom: r.dados.jaExistia ? "info" : "sucesso",
          acao: {
            rotulo: "Abrir",
            aoClicar: () => router.push(`/vendas/lead/${r.dados.id}`),
          },
        }
      );
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo lead"
      descricao="Só nome e telefone são obrigatórios. O resto entra depois."
      largura="sm"
    >
      <form action={enviar} className="space-y-3.5">
        <Campo label="Nome" obrigatorio erro={erros.nome}>
          <Input name="nome" required autoFocus placeholder="Maria Silva" />
        </Campo>

        <Campo label="Telefone" obrigatorio erro={erros.telefone}>
          <Input
            name="telefone"
            required
            inputMode="tel"
            placeholder="(46) 99999-0000"
          />
        </Campo>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Empresa">
            <Input name="empresa" placeholder="Opcional" />
          </Campo>
          <Campo label="Valor estimado (R$)">
            <Input name="valor" type="number" min={0} step={1} placeholder="0" />
          </Campo>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Origem">
            <Select name="origem" defaultValue="">
              <option value="">—</option>
              {origens.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Responsável">
            <Select name="responsavel" defaultValue="">
              <option value="">Eu mesmo</option>
              {equipe.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" variante="primary" carregando={enviando}>
            Criar lead
          </Button>
        </div>
      </form>
    </Modal>
  );
}

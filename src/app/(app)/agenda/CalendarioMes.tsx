"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Pagina } from "@/components/layout/Pagina";
import { Button } from "@/components/ui/Button";
import { Campo, Input, Select, Textarea } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { hora, dataHora } from "@/lib/formato";
import { cn } from "@/lib/cn";
import { criarEvento, cancelarEvento } from "./acoes";

type Evento = {
  id: string;
  titulo: string;
  tipo: string;
  inicioEm: string;
  fimEm: string;
  local: string | null;
  cliente: string | null;
  statusGravacao: string | null;
  participantes: string[];
};

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const CORES_TIPO: Record<string, string> = {
  REUNIAO: "bg-azul-50 text-azul-700",
  GRAVACAO: "bg-[var(--color-erro-fundo)] text-[var(--color-erro-texto)]",
  ENTREGA: "bg-[var(--color-sucesso-fundo)] text-[var(--color-sucesso-texto)]",
  PRAZO: "bg-[var(--color-alerta-fundo)] text-[var(--color-alerta-texto)]",
};

const TIPOS = [
  ["REUNIAO", "Reunião"],
  ["GRAVACAO", "Gravação"],
  ["VISITA", "Visita"],
  ["ENTREGA", "Entrega"],
  ["PRODUCAO", "Produção"],
  ["CAMPANHA", "Campanha"],
  ["PRAZO", "Prazo"],
  ["EVENTO", "Evento"],
  ["VIAGEM", "Viagem"],
  ["INTERNO", "Interno"],
  ["FOLLOWUP", "Follow-up"],
] as const;

export function CalendarioMes({
  ano,
  mes,
  eventos,
  clientes,
  equipe,
  filtroTipo,
  podeCriar,
  abrirNovo,
}: {
  ano: number;
  mes: number;
  eventos: Evento[];
  clientes: { id: string; nome: string }[];
  equipe: { id: string; nome: string }[];
  filtroTipo: string;
  podeCriar: boolean;
  abrirNovo: boolean;
}) {
  const [novo, setNovo] = useState(abrirNovo);
  const [diaAlvo, setDiaAlvo] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Evento | null>(null);
  const router = useRouter();

  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());

  const dias = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });

  // Agrupa por data local, no fuso do navegador.
  const porDia = new Map<string, Evento[]>();
  for (const e of eventos) {
    const d = new Date(e.inicioEm);
    const chave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const lista = porDia.get(chave);
    if (lista) lista.push(e);
    else porDia.set(chave, [e]);
  }

  function navegar(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    const p = new URLSearchParams({
      ano: String(d.getFullYear()),
      mes: String(d.getMonth()),
    });
    if (filtroTipo) p.set("tipo", filtroTipo);
    router.push(`/agenda?${p}`);
  }

  const hojeChave = (() => {
    const h = new Date();
    return `${h.getFullYear()}-${h.getMonth()}-${h.getDate()}`;
  })();

  return (
    <Pagina
      largura="cheia"
      titulo={primeiro.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })}
      descricao={`${eventos.length} compromisso(s)`}
      acoes={
        <>
          <Select
            value={filtroTipo}
            onChange={(e) => {
              const p = new URLSearchParams({ ano: String(ano), mes: String(mes) });
              if (e.target.value) p.set("tipo", e.target.value);
              router.push(`/agenda?${p}`);
            }}
            className="w-36"
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos os tipos</option>
            {TIPOS.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-0.5">
            <Button tamanho="icon" onClick={() => navegar(-1)} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button onClick={() => router.push("/agenda")}>Hoje</Button>
            <Button tamanho="icon" onClick={() => navegar(1)} aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {podeCriar && (
            <Button
              variante="primary"
              onClick={() => {
                setDiaAlvo(null);
                setNovo(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo evento
            </Button>
          )}
        </>
      }
    >
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--color-borda)] bg-[var(--color-fundo-sutil)]">
          {DIAS.map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-texto-3)]"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((d, i) => {
            const chave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const doDia = porDia.get(chave) ?? [];
            const foraDoMes = d.getMonth() !== mes;
            const ehHoje = chave === hojeChave;

            return (
              <div
                key={i}
                onDoubleClick={() => {
                  if (!podeCriar) return;
                  const iso = new Date(d);
                  iso.setHours(9, 0, 0, 0);
                  setDiaAlvo(
                    new Date(iso.getTime() - iso.getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16)
                  );
                  setNovo(true);
                }}
                className={cn(
                  "min-h-[104px] border-b border-r border-[var(--color-borda)] p-1.5",
                  foraDoMes && "bg-[var(--color-fundo-sutil)]",
                  i % 7 === 6 && "border-r-0"
                )}
              >
                <span
                  className={cn(
                    "tabular inline-grid h-5 w-5 place-items-center rounded-full text-[12px]",
                    ehHoje
                      ? "bg-azul-600 font-semibold text-white"
                      : foraDoMes
                        ? "text-[var(--color-texto-3)]"
                        : "text-[var(--color-texto-2)]"
                  )}
                >
                  {d.getDate()}
                </span>

                <div className="mt-1 space-y-0.5">
                  {doDia.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setAberto(e)}
                      className={cn(
                        "block w-full truncate rounded px-1 py-0.5 text-left text-[11px]",
                        CORES_TIPO[e.tipo] ??
                          "bg-[var(--color-fundo-hover)] text-[var(--color-texto-2)]"
                      )}
                    >
                      <span className="tabular font-medium">{hora(e.inicioEm)}</span>{" "}
                      {e.titulo}
                    </button>
                  ))}
                  {doDia.length > 3 && (
                    <p className="px-1 text-[10.5px] text-[var(--color-texto-3)]">
                      +{doDia.length - 3}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="mt-3 text-[12.5px] text-[var(--color-texto-3)]">
        Dica: clique duas vezes num dia para criar um evento nele.
      </p>

      <ModalNovoEvento
        aberto={novo}
        aoFechar={() => {
          setNovo(false);
          if (abrirNovo) router.replace("/agenda");
        }}
        inicioPadrao={diaAlvo}
        clientes={clientes}
        equipe={equipe}
      />

      <DetalheEvento evento={aberto} aoFechar={() => setAberto(null)} />
    </Pagina>
  );
}

function DetalheEvento({
  evento,
  aoFechar,
}: {
  evento: Evento | null;
  aoFechar: () => void;
}) {
  const [processando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function cancelar() {
    if (!evento) return;
    iniciar(async () => {
      const r = await cancelarEvento(evento.id);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Evento cancelado.");
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Modal
      aberto={evento !== null}
      aoFechar={aoFechar}
      titulo={evento?.titulo ?? ""}
      largura="sm"
      rodape={
        <>
          <Button onClick={aoFechar}>Fechar</Button>
          <Button variante="destructive" onClick={cancelar} carregando={processando}>
            Cancelar evento
          </Button>
        </>
      }
    >
      {evento && (
        <dl className="space-y-2.5 text-[13.5px]">
          <Linha rotulo="Quando" valor={dataHora(evento.inicioEm)} />
          <Linha
            rotulo="Tipo"
            valor={
              <Badge tom="ativo">
                {TIPOS.find((t) => t[0] === evento.tipo)?.[1] ?? evento.tipo}
              </Badge>
            }
          />
          {evento.cliente && <Linha rotulo="Cliente" valor={evento.cliente} />}
          {evento.local && <Linha rotulo="Local" valor={evento.local} />}
          {evento.statusGravacao && (
            <Linha
              rotulo="Gravação"
              valor={<StatusBadge status={evento.statusGravacao} />}
            />
          )}
          {evento.participantes.length > 0 && (
            <Linha rotulo="Equipe" valor={evento.participantes.join(", ")} />
          )}
        </dl>
      )}
    </Modal>
  );
}

function Linha({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-[var(--color-texto-3)]">{rotulo}</dt>
      <dd className="min-w-0 flex-1">{valor}</dd>
    </div>
  );
}

function ModalNovoEvento({
  aberto,
  aoFechar,
  inicioPadrao,
  clientes,
  equipe,
}: {
  aberto: boolean;
  aoFechar: () => void;
  inicioPadrao: string | null;
  clientes: { id: string; nome: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const [tipo, setTipo] = useState("REUNIAO");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    setErros({});
    iniciar(async () => {
      const r = await criarEvento({
        titulo: String(form.get("titulo") ?? ""),
        tipo: tipo as "REUNIAO",
        clientId: String(form.get("cliente") ?? ""),
        inicioEm: String(form.get("inicio") ?? ""),
        duracaoMin: Number(form.get("duracao") ?? 60),
        local: String(form.get("local") ?? ""),
        linkReuniao: String(form.get("link") ?? ""),
        descricao: String(form.get("descricao") ?? ""),
        participantes: form.getAll("participantes").map(String),
      });

      if (!r.ok) {
        setErros(r.campos ?? {});
        return toast(r.erro, { tom: "erro" });
      }
      toast("Evento criado.");
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo evento"
      largura="sm"
    >
      <form action={enviar} className="space-y-3.5">
        <Campo label="Título" obrigatorio erro={erros.titulo}>
          <Input name="titulo" required autoFocus placeholder="Reunião de alinhamento" />
        </Campo>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Cliente">
            <Select name="cliente" defaultValue="">
              <option value="">Interno</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Início" obrigatorio erro={erros.inicioEm}>
            <Input
              name="inicio"
              type="datetime-local"
              required
              defaultValue={inicioPadrao ?? undefined}
            />
          </Campo>
          <Campo label="Duração (min)">
            <Input name="duracao" type="number" min={0} step={15} defaultValue={60} />
          </Campo>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Campo label="Local">
            <Input name="local" placeholder="Escritório, cliente…" />
          </Campo>
          <Campo label="Link da reunião">
            <Input name="link" placeholder="https://meet…" />
          </Campo>
        </div>

        <Campo label="Equipe" ajuda="Segure Ctrl (ou ⌘) para escolher mais de um.">
          <select
            name="participantes"
            multiple
            size={Math.min(4, Math.max(2, equipe.length))}
            className="w-full rounded-md border border-[var(--color-borda-forte)] bg-[var(--color-fundo-elevado)] px-2 py-1.5 text-[13.5px]"
          >
            {equipe.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Observações">
          <Textarea name="descricao" rows={2} />
        </Campo>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" variante="primary" carregando={enviando}>
            Criar evento
          </Button>
        </div>
      </form>
    </Modal>
  );
}

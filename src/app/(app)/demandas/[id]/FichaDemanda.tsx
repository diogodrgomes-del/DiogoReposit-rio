"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Plus, Send, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Campo, Input, Select, Textarea } from "@/components/ui/Campo";
import { Card, CardTitulo, Avatar } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { relativo, data } from "@/lib/formato";
import { cn } from "@/lib/cn";
import {
  editarDemanda,
  excluirDemanda,
  alternarSubtarefa,
  criarSubtarefa,
  comentar,
} from "../acoes";

type Demanda = {
  id: string;
  titulo: string;
  descricao: string | null;
  clienteId: string;
  clienteNome: string | null;
  etapa: string;
  etapaTipo: string;
  tipoId: string;
  prioridade: "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";
  responsavelId: string;
  prazoEm: string;
  concluidaEm: string | null;
  criadoEm: string;
};

export function FichaDemanda({
  demanda,
  subtarefas,
  comentarios,
  historico,
  clientes,
  tipos,
  equipe,
  podeEditar,
  podeExcluir,
}: {
  demanda: Demanda;
  subtarefas: { id: string; titulo: string; concluida: boolean }[];
  comentarios: { id: string; corpo: string; autor: string; criadoEm: string }[];
  historico: { id: string; resumo: string; usuario: string; em: string }[];
  clientes: { id: string; nome: string }[];
  tipos: { id: string; nome: string }[];
  equipe: { id: string; nome: string }[];
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const [salvando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function salvar(campo: string, valor: string | number | null) {
    if (!podeEditar) return;
    iniciar(async () => {
      const r = await editarDemanda({ id: demanda.id, [campo]: valor });
      if (!r.ok) toast(r.erro, { tom: "erro" });
      else router.refresh();
    });
  }

  function apagar() {
    iniciar(async () => {
      const r = await excluirDemanda(demanda.id);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Demanda enviada para a lixeira.");
      router.push("/demandas");
    });
  }

  const feitas = subtarefas.filter((s) => s.concluida).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tom={demanda.etapaTipo === "GANHO" ? "sucesso" : "ativo"}>
              {demanda.etapa}
            </Badge>
            {demanda.prioridade !== "NORMAL" && (
              <Badge
                tom={
                  demanda.prioridade === "URGENTE"
                    ? "erro"
                    : demanda.prioridade === "ALTA"
                      ? "alerta"
                      : "neutro"
                }
              >
                {demanda.prioridade.toLowerCase()}
              </Badge>
            )}
            {demanda.clienteNome && (
              <Link
                href={`/clientes/${demanda.clienteId}`}
                className="text-[13px] text-azul-600 hover:underline"
              >
                {demanda.clienteNome}
              </Link>
            )}
          </div>
          <input
            defaultValue={demanda.titulo}
            disabled={!podeEditar}
            onBlur={(e) =>
              e.target.value !== demanda.titulo &&
              salvar("titulo", e.target.value)
            }
            className="w-full bg-transparent text-[20px] font-semibold tracking-tight outline-none focus:bg-[var(--color-fundo-hover)] focus:px-1 focus:-mx-1 rounded"
          />
          <p className="mt-1 text-[13px] text-[var(--color-texto-2)]">
            Criada {relativo(demanda.criadoEm)}
            {demanda.concluidaEm && ` · concluída ${relativo(demanda.concluidaEm)}`}
            {salvando && " · salvando…"}
          </p>
        </div>

        {podeExcluir && (
          <Button variante="ghost" onClick={apagar} title="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <CardTitulo>Briefing</CardTitulo>
            <div className="p-4">
              <Textarea
                defaultValue={demanda.descricao ?? ""}
                disabled={!podeEditar}
                rows={6}
                placeholder="Descreva o que precisa ser feito…"
                onBlur={(e) =>
                  e.target.value !== (demanda.descricao ?? "") &&
                  salvar("descricao", e.target.value)
                }
              />
            </div>
          </Card>

          <Subtarefas
            demandaId={demanda.id}
            itens={subtarefas}
            feitas={feitas}
            podeEditar={podeEditar}
          />

          <Comentarios demandaId={demanda.id} itens={comentarios} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitulo>Detalhes</CardTitulo>
            <div className="space-y-3.5 p-4">
              <Campo label="Cliente">
                <Select
                  defaultValue={demanda.clienteId}
                  disabled={!podeEditar}
                  onChange={(e) => salvar("clientId", e.target.value)}
                >
                  <option value="">Interno</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Responsável">
                <Select
                  defaultValue={demanda.responsavelId}
                  disabled={!podeEditar}
                  onChange={(e) => salvar("responsavelId", e.target.value)}
                >
                  <option value="">Ninguém</option>
                  {equipe.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Tipo">
                <Select
                  defaultValue={demanda.tipoId}
                  disabled={!podeEditar}
                  onChange={(e) => salvar("tipoId", e.target.value)}
                >
                  <option value="">—</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Prioridade">
                <Select
                  defaultValue={demanda.prioridade}
                  disabled={!podeEditar}
                  onChange={(e) => salvar("prioridade", e.target.value)}
                >
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </Select>
              </Campo>
              <Campo label="Prazo">
                <Input
                  type="date"
                  defaultValue={demanda.prazoEm}
                  disabled={!podeEditar}
                  onChange={(e) => salvar("prazoEm", e.target.value)}
                />
              </Campo>
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
                Sem registros.
              </p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto">
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
    </>
  );
}

function Subtarefas({
  demandaId,
  itens,
  feitas,
  podeEditar,
}: {
  demandaId: string;
  itens: { id: string; titulo: string; concluida: boolean }[];
  feitas: number;
  podeEditar: boolean;
}) {
  const [novo, setNovo] = useState("");
  const [, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const texto = novo.trim();
    if (!texto) return;
    setNovo("");
    iniciar(async () => {
      const r = await criarSubtarefa(demandaId, texto);
      if (!r.ok) toast(r.erro, { tom: "erro" });
      router.refresh();
    });
  }

  function alternar(id: string) {
    iniciar(async () => {
      const r = await alternarSubtarefa(id);
      if (!r.ok) toast(r.erro, { tom: "erro" });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardTitulo
        acao={
          itens.length > 0 ? (
            <span className="tabular text-[12.5px] text-[var(--color-texto-3)]">
              {feitas}/{itens.length}
            </span>
          ) : undefined
        }
      >
        Checklist
      </CardTitulo>

      <ul className="divide-y divide-[var(--color-borda)]">
        {itens.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 px-4 py-2">
            <input
              type="checkbox"
              checked={s.concluida}
              disabled={!podeEditar}
              onChange={() => alternar(s.id)}
              className="h-4 w-4 shrink-0 accent-[var(--color-azul-600)]"
            />
            <span
              className={cn(
                "text-[13.5px]",
                s.concluida && "text-[var(--color-texto-3)] line-through"
              )}
            >
              {s.titulo}
            </span>
          </li>
        ))}
      </ul>

      {podeEditar && (
        <form onSubmit={adicionar} className="flex gap-2 border-t border-[var(--color-borda)] p-3">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Adicionar item…"
            className="h-8"
          />
          <Button type="submit" tamanho="sm" disabled={!novo.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}
    </Card>
  );
}

function Comentarios({
  demandaId,
  itens,
}: {
  demandaId: string;
  itens: { id: string; corpo: string; autor: string; criadoEm: string }[];
}) {
  const [texto, setTexto] = useState("");
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const corpo = texto.trim();
    if (!corpo) return;
    iniciar(async () => {
      const r = await comentar("demanda", demandaId, corpo);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      setTexto("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardTitulo>Comentários</CardTitulo>

      {itens.length > 0 && (
        <ul className="space-y-3 p-4">
          {itens.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar nome={c.autor} tamanho={26} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px]">
                  <span className="font-medium">{c.autor}</span>{" "}
                  <span className="text-[var(--color-texto-3)]">
                    {relativo(c.criadoEm)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-[13.5px]">{c.corpo}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={enviar}
        className="flex gap-2 border-t border-[var(--color-borda)] p-3"
      >
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário…"
        />
        <Button
          type="submit"
          variante="primary"
          carregando={enviando}
          disabled={!texto.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </Card>
  );
}

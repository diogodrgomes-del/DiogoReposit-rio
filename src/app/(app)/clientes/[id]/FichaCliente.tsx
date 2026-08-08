"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Campo, Input, Select, Textarea } from "@/components/ui/Campo";
import { Card, CardTitulo } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { data } from "@/lib/formato";
import { cn } from "@/lib/cn";
import { editarCliente, excluirCliente } from "../acoes";

type Cliente = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  segmento: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  instagram: string | null;
  site: string | null;
  gmnUrl: string | null;
  observacoes: string | null;
  status: string;
  saude: string;
  responsavelId: string;
  entrouEm: string | null;
};

const STATUS = [
  "ATIVO", "ONBOARDING", "PAUSADO", "INADIMPLENTE",
  "EM_RISCO", "CANCELADO", "ENCERRADO",
] as const;

export function FichaCliente({
  cliente,
  equipe,
  podeEditar,
  podeExcluir,
}: {
  cliente: Cliente;
  equipe: { id: string; nome: string }[];
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const [expandido, setExpandido] = useState(false);
  const [salvando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function salvar(campo: string, valor: string) {
    if (!podeEditar) return;
    iniciar(async () => {
      const r = await editarCliente({ id: cliente.id, [campo]: valor });
      if (!r.ok) toast(r.erro, { tom: "erro" });
      else router.refresh();
    });
  }

  function apagar() {
    iniciar(async () => {
      const r = await excluirCliente(cliente.id);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Cliente enviado para a lixeira.");
      router.push("/clientes");
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "h-7 w-1.5 rounded-full",
                cliente.saude === "VERMELHO"
                  ? "bg-[var(--color-erro)]"
                  : cliente.saude === "AMARELO"
                    ? "bg-[var(--color-alerta)]"
                    : "bg-[var(--color-sucesso)]"
              )}
            />
            <h1 className="text-[20px] font-semibold tracking-tight">
              {cliente.nomeFantasia ?? cliente.razaoSocial}
            </h1>
            <StatusBadge status={cliente.status} />
          </div>
          <p className="mt-1 text-[13px] text-[var(--color-texto-2)]">
            {cliente.segmento ?? "Sem segmento"}
            {cliente.entrouEm ? ` · cliente desde ${data(cliente.entrouEm)}` : ""}
            {salvando && " · salvando…"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {podeEditar && (
            <>
              <Select
                defaultValue={cliente.status}
                onChange={(e) => salvar("status", e.target.value)}
                className="w-40"
                aria-label="Status do cliente"
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                  </option>
                ))}
              </Select>
              <Select
                defaultValue={cliente.saude}
                onChange={(e) => salvar("saude", e.target.value)}
                className="w-32"
                aria-label="Saúde do cliente"
              >
                <option value="VERDE">Saudável</option>
                <option value="AMARELO">Atenção</option>
                <option value="VERMELHO">Risco</option>
              </Select>
            </>
          )}
          {podeExcluir && (
            <Button variante="ghost" onClick={apagar} title="Excluir cliente">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardTitulo
          acao={
            <button
              type="button"
              onClick={() => setExpandido((e) => !e)}
              className="flex items-center gap-1 text-[13px] text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
            >
              {expandido ? "Menos campos" : "Todos os campos"}
              {expandido ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          }
        >
          Dados do cliente
        </CardTitulo>

        <div className="grid gap-3.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampoTexto
            label="Razão social"
            valor={cliente.razaoSocial}
            campo="razaoSocial"
            salvar={salvar}
            editavel={podeEditar}
          />
          <CampoTexto
            label="Nome fantasia"
            valor={cliente.nomeFantasia}
            campo="nomeFantasia"
            salvar={salvar}
            editavel={podeEditar}
          />
          <CampoTexto
            label="Segmento"
            valor={cliente.segmento}
            campo="segmento"
            salvar={salvar}
            editavel={podeEditar}
          />
          <CampoTexto
            label="WhatsApp"
            valor={cliente.whatsapp}
            campo="whatsapp"
            salvar={salvar}
            editavel={podeEditar}
          />
          <CampoTexto
            label="E-mail"
            valor={cliente.email}
            campo="email"
            salvar={salvar}
            editavel={podeEditar}
          />
          <Campo label="Responsável">
            <Select
              defaultValue={cliente.responsavelId}
              disabled={!podeEditar}
              onChange={(e) => salvar("responsavelId", e.target.value)}
            >
              <option value="">—</option>
              {equipe.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Campo>

          {expandido && (
            <>
              <CampoTexto
                label="CNPJ"
                valor={cliente.cnpj}
                campo="cnpj"
                salvar={salvar}
                editavel={podeEditar}
              />
              <CampoTexto
                label="Telefone"
                valor={cliente.telefone}
                campo="telefone"
                salvar={salvar}
                editavel={podeEditar}
              />
              <CampoTexto
                label="Cidade"
                valor={cliente.cidade}
                campo="cidade"
                salvar={salvar}
                editavel={podeEditar}
              />
              <CampoTexto
                label="UF"
                valor={cliente.uf}
                campo="uf"
                salvar={salvar}
                editavel={podeEditar}
              />
              <CampoTexto
                label="Endereço"
                valor={cliente.endereco}
                campo="endereco"
                salvar={salvar}
                editavel={podeEditar}
              />
              <CampoTexto
                label="Instagram"
                valor={cliente.instagram}
                campo="instagram"
                salvar={salvar}
                editavel={podeEditar}
              />
              <CampoTexto
                label="Site"
                valor={cliente.site}
                campo="site"
                salvar={salvar}
                editavel={podeEditar}
              />
              <CampoTexto
                label="Google Meu Negócio"
                valor={cliente.gmnUrl}
                campo="gmnUrl"
                salvar={salvar}
                editavel={podeEditar}
              />
              <Campo label="Observações" className="sm:col-span-2 lg:col-span-3">
                <Textarea
                  defaultValue={cliente.observacoes ?? ""}
                  disabled={!podeEditar}
                  onBlur={(e) =>
                    e.target.value !== (cliente.observacoes ?? "") &&
                    salvar("observacoes", e.target.value)
                  }
                />
              </Campo>
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function CampoTexto({
  label,
  valor,
  campo,
  salvar,
  editavel,
}: {
  label: string;
  valor: string | null;
  campo: string;
  salvar: (campo: string, valor: string) => void;
  editavel: boolean;
}) {
  return (
    <Campo label={label}>
      <Input
        defaultValue={valor ?? ""}
        disabled={!editavel}
        // Salva no blur, não a cada tecla: uma requisição por campo editado,
        // não uma por letra digitada.
        onBlur={(e) => e.target.value !== (valor ?? "") && salvar(campo, e.target.value)}
      />
    </Campo>
  );
}

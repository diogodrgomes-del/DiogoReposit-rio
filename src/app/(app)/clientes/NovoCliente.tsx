"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Campo, Input } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { criarCliente } from "./acoes";

export function NovoClienteBotao() {
  const params = useSearchParams();
  const [aberto, setAberto] = useState(params.get("novo") === "1");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    setErros({});
    iniciar(async () => {
      const r = await criarCliente({
        razaoSocial: String(form.get("razaoSocial") ?? ""),
        nomeFantasia: String(form.get("nomeFantasia") ?? ""),
        segmento: String(form.get("segmento") ?? ""),
        telefone: String(form.get("telefone") ?? ""),
        email: String(form.get("email") ?? ""),
        cidade: String(form.get("cidade") ?? ""),
        uf: String(form.get("uf") ?? ""),
      });
      if (!r.ok) {
        setErros(r.campos ?? {});
        return toast(r.erro, { tom: "erro" });
      }
      toast("Cliente criado.");
      setAberto(false);
      router.push(`/clientes/${r.dados.id}`);
    });
  }

  return (
    <>
      <Button variante="primary" onClick={() => setAberto(true)}>
        <Plus className="h-4 w-4" />
        Novo cliente
      </Button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo cliente"
        descricao="Só o nome da empresa é obrigatório."
        largura="sm"
      >
        <form action={enviar} className="space-y-3.5">
          <Campo label="Nome da empresa" obrigatorio erro={erros.razaoSocial}>
            <Input name="razaoSocial" required autoFocus />
          </Campo>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo label="Nome fantasia">
              <Input name="nomeFantasia" />
            </Campo>
            <Campo label="Segmento">
              <Input name="segmento" placeholder="Ótica, Restaurante…" />
            </Campo>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo label="Telefone">
              <Input name="telefone" inputMode="tel" />
            </Campo>
            <Campo label="E-mail">
              <Input name="email" type="email" />
            </Campo>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-[1fr_80px]">
            <Campo label="Cidade">
              <Input name="cidade" />
            </Campo>
            <Campo label="UF">
              <Input name="uf" maxLength={2} />
            </Campo>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variante="primary" carregando={enviando}>
              Criar cliente
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

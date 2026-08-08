"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Campo, Input, Select, Textarea } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { criarLancamento } from "./acoes";

export function NovoLancamentoBotao({
  categorias,
  clientes,
  escopo,
}: {
  categorias: { id: string; nome: string; tipo: string }[];
  clientes: { id: string; nome: string }[];
  escopo: "EMPRESA" | "PESSOAL";
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"RECEITA" | "DESPESA">("DESPESA");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    setErros({});
    iniciar(async () => {
      const r = await criarLancamento({
        escopo,
        tipo,
        descricao: String(form.get("descricao") ?? ""),
        valor: String(form.get("valor") ?? ""),
        vencimentoEm: String(form.get("vencimento") ?? ""),
        clientId: String(form.get("cliente") ?? ""),
        categoryId: String(form.get("categoria") ?? ""),
        fornecedor: String(form.get("fornecedor") ?? ""),
        formaPagamento: String(form.get("forma") ?? ""),
        recorrente: form.get("recorrente") === "on",
        observacoes: String(form.get("observacoes") ?? ""),
      });

      if (!r.ok) {
        setErros(r.campos ?? {});
        return toast(r.erro, { tom: "erro" });
      }
      toast("Lançamento registrado.");
      setAberto(false);
      router.refresh();
    });
  }

  const cats = categorias.filter((c) => c.tipo === tipo);

  return (
    <>
      <Button variante="primary" onClick={() => setAberto(true)}>
        <Plus className="h-4 w-4" />
        Lançar
      </Button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo lançamento"
        descricao={escopo === "PESSOAL" ? "Escopo pessoal — só você vê." : undefined}
        largura="sm"
      >
        <form action={enviar} className="space-y-3.5">
          <div className="flex gap-1 rounded-md bg-[var(--color-fundo-sutil)] p-1">
            {(["DESPESA", "RECEITA"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  tipo === t
                    ? "bg-[var(--color-fundo-elevado)] text-[var(--color-texto)] shadow-sm"
                    : "text-[var(--color-texto-2)]"
                }`}
              >
                {t === "DESPESA" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>

          <Campo label="Descrição" obrigatorio erro={erros.descricao}>
            <Input
              name="descricao"
              required
              autoFocus
              placeholder={tipo === "RECEITA" ? "Mensalidade — Cliente X" : "Assinatura Canva"}
            />
          </Campo>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo label="Valor (R$)" obrigatorio erro={erros.valor}>
              <Input name="valor" required inputMode="decimal" placeholder="1.500,00" />
            </Campo>
            <Campo label="Vencimento" obrigatorio erro={erros.vencimentoEm}>
              <Input
                name="vencimento"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Campo>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo label="Categoria">
              <Select name="categoria" defaultValue="">
                <option value="">—</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            {escopo === "EMPRESA" && tipo === "RECEITA" ? (
              <Campo label="Cliente">
                <Select name="cliente" defaultValue="">
                  <option value="">—</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
            ) : (
              <Campo label="Fornecedor">
                <Input name="fornecedor" placeholder="Opcional" />
              </Campo>
            )}
          </div>

          <Campo label="Forma de pagamento">
            <Input name="forma" placeholder="Pix, boleto, cartão…" />
          </Campo>

          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="recorrente"
              className="h-3.5 w-3.5 accent-[var(--color-azul-600)]"
            />
            Lançamento recorrente
          </label>

          <Campo label="Observações">
            <Textarea name="observacoes" rows={2} />
          </Campo>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variante="primary" carregando={enviando}>
              Lançar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

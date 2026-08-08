"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Campo, Input } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { moeda, data, diasDeAtraso } from "@/lib/formato";
import { cn } from "@/lib/cn";
import { registrarPagamento, excluirLancamento } from "./acoes";

export type LinhaConta = {
  id: string;
  descricao: string;
  contraparte: string | null;
  valorCents: number;
  valorPagoCents: number;
  vencimentoEm: string;
  status: string;
  quitado: boolean;
};

export function ListaContas({
  itens,
  tipo,
  podeEditar,
  podeExcluir,
}: {
  itens: LinhaConta[];
  tipo: "RECEITA" | "DESPESA";
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const [parcial, setParcial] = useState<LinhaConta | null>(null);
  const [processando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function baixar(item: LinhaConta) {
    iniciar(async () => {
      const r = await registrarPagamento(item.id);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast(tipo === "RECEITA" ? "Recebimento registrado." : "Pagamento registrado.");
      router.refresh();
    });
  }

  function apagar(item: LinhaConta) {
    iniciar(async () => {
      const r = await excluirLancamento(item.id);
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Lançamento enviado para a lixeira.");
      router.refresh();
    });
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-[var(--color-borda)] text-left text-[12px] uppercase tracking-wide text-[var(--color-texto-3)]">
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-4 py-2.5 font-medium">
                  {tipo === "RECEITA" ? "Cliente" : "Fornecedor"}
                </th>
                <th className="px-4 py-2.5 font-medium">Vencimento</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 text-right font-medium">Em aberto</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-borda)]">
              {itens.map((e) => {
                const aberto = e.valorCents - e.valorPagoCents;
                const dias = diasDeAtraso(e.vencimentoEm);
                const atrasado = !e.quitado && dias > 0;
                return (
                  <tr key={e.id} className="hover:bg-[var(--color-fundo-hover)]">
                    <td className="px-4 py-2.5 font-medium">{e.descricao}</td>
                    <td className="px-4 py-2.5 text-[var(--color-texto-2)]">
                      {e.contraparte ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5",
                        atrasado
                          ? "font-medium text-[var(--color-erro)]"
                          : "text-[var(--color-texto-2)]"
                      )}
                    >
                      {data(e.vencimentoEm)}
                      {atrasado && (
                        <span className="ml-1 text-[11.5px]">({dias}d)</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right">
                      {moeda(e.valorCents)}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-medium">
                      {aberto > 0 ? moeda(aberto) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={atrasado ? "ATRASADO" : e.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {podeEditar && !e.quitado && (
                          <>
                            <Button
                              tamanho="sm"
                              onClick={() => baixar(e)}
                              disabled={processando}
                              title={
                                tipo === "RECEITA"
                                  ? "Marcar como recebido"
                                  : "Marcar como pago"
                              }
                            >
                              <Check className="h-3.5 w-3.5" />
                              Baixar
                            </Button>
                            <Button
                              tamanho="sm"
                              variante="ghost"
                              onClick={() => setParcial(e)}
                              title="Baixa parcial"
                            >
                              Parcial
                            </Button>
                          </>
                        )}
                        {podeExcluir && (
                          <Button
                            tamanho="sm"
                            variante="ghost"
                            onClick={() => apagar(e)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ModalParcial
        item={parcial}
        aoFechar={() => setParcial(null)}
        tipo={tipo}
      />
    </>
  );
}

function ModalParcial({
  item,
  aoFechar,
  tipo,
}: {
  item: LinhaConta | null;
  aoFechar: () => void;
  tipo: "RECEITA" | "DESPESA";
}) {
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    if (!item) return;
    iniciar(async () => {
      const r = await registrarPagamento(item.id, String(form.get("valor") ?? ""));
      if (!r.ok) return toast(r.erro, { tom: "erro" });
      toast("Baixa parcial registrada.");
      aoFechar();
      router.refresh();
    });
  }

  const restante = item ? item.valorCents - item.valorPagoCents : 0;

  return (
    <Modal
      aberto={item !== null}
      aoFechar={aoFechar}
      titulo={tipo === "RECEITA" ? "Recebimento parcial" : "Pagamento parcial"}
      descricao={item ? `${item.descricao} — em aberto: ${moeda(restante)}` : ""}
      largura="sm"
    >
      <form action={enviar} className="space-y-3.5">
        <Campo label="Valor recebido agora (R$)" obrigatorio>
          <Input
            name="valor"
            required
            autoFocus
            inputMode="decimal"
            placeholder={(restante / 100).toFixed(2).replace(".", ",")}
          />
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

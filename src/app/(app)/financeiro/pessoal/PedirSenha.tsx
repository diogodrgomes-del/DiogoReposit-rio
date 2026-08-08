"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Campo, Input } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { confirmarSenha } from "../acoes";

/**
 * Step-up. Existe porque o cenário real não é invasão remota — é notebook
 * desbloqueado em cima da mesa enquanto alguém vai buscar café.
 */
export function PedirSenha() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function enviar(form: FormData) {
    setErro(null);
    iniciar(async () => {
      const r = await confirmarSenha(String(form.get("senha") ?? ""));
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast("Acesso liberado por 15 minutos.");
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto max-w-md p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-fundo-hover)]">
          <Lock className="h-4 w-4 text-[var(--color-texto-2)]" />
        </span>
        <div>
          <p className="text-[14px] font-medium">Área protegida</p>
          <p className="text-[12.5px] text-[var(--color-texto-2)]">
            A confirmação vale por 15 minutos.
          </p>
        </div>
      </div>

      <form action={enviar} className="space-y-3.5">
        <Campo label="Sua senha" erro={erro ?? undefined}>
          <Input
            name="senha"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
          />
        </Campo>
        <Button
          type="submit"
          variante="primary"
          carregando={enviando}
          className="w-full justify-center"
        >
          Confirmar
        </Button>
      </form>
    </Card>
  );
}

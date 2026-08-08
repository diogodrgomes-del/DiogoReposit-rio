"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { marcarTodasLidas } from "./acoes";

export function MarcarLidas() {
  const [enviando, iniciar] = useTransition();
  const router = useRouter();

  return (
    <Button
      carregando={enviando}
      onClick={() =>
        iniciar(async () => {
          await marcarTodasLidas();
          router.refresh();
        })
      }
    >
      <CheckCheck className="h-4 w-4" />
      Marcar todas como lidas
    </Button>
  );
}

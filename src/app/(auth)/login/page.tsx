"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Campo, Input } from "@/components/ui/Campo";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = params.get("de") ?? "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(corpo?.erro ?? "Não foi possível entrar.");
        setEnviando(false);
        return;
      }
      // replace: o login não deve ficar no histórico do navegador.
      router.replace(destino.startsWith("/") ? destino : "/");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Verifique sua internet.");
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="w-full max-w-[380px] space-y-5 rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo-elevado)] p-7 shadow-sm"
    >
      <div className="space-y-1.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-azul-600 text-[15px] font-bold text-white">
          M
        </span>
        <h1 className="pt-2 text-[19px] font-semibold tracking-tight">
          MARK SISTEM
        </h1>
        <p className="text-[13px] text-[var(--color-texto-2)]">
          Sistema operacional da Agência Marktiva
        </p>
      </div>

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[var(--color-erro)] bg-[var(--color-erro-fundo)] px-3 py-2 text-[13px] text-[var(--color-erro-texto)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="space-y-3.5">
        <Campo label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            placeholder="voce@marktiva.com.br"
          />
        </Campo>

        <Campo label="Senha">
          <Input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Campo>
      </div>

      <Button
        type="submit"
        variante="primary"
        carregando={enviando}
        className="w-full justify-center"
      >
        Entrar
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-fundo-sutil)] p-4">
      <Suspense>
        <Formulario />
      </Suspense>
    </main>
  );
}

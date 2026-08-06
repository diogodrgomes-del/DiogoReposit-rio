"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const de = params.get("de");

  const [usuario, setUsuario] = useState("");
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
        body: JSON.stringify({ usuario, senha }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(corpo?.erro ?? "Não foi possível entrar.");
        setEnviando(false);
        return;
      }
      // Quem entrou pelo banco vai para o painel geral; quem entrou pelo modo
      // legado só tem o painel de campanhas, e mandá-lo ao /painel seria
      // mostrar uma tela que ele não pode abrir.
      // Só caminhos internos: `de` vem da URL e um valor absoluto viraria
      // redirecionamento aberto para fora do sistema.
      const padrao = corpo?.modo === "banco" ? "/painel" : "/";
      const alvo = de && de.startsWith("/") && !de.startsWith("//") ? de : padrao;
      router.replace(alvo);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Verifique sua internet.");
      setEnviando(false);
    }
  }

  return (
    <div className="login-tela">
      <form className="login-caixa" onSubmit={enviar}>
        <h1>Marktiva</h1>
        <p className="sub">MARK SISTEM · Agência Marktiva</p>

        {erro && (
          <p className="erro-msg" role="alert">
            {erro}
          </p>
        )}

        <label className="campo">
          {/*
            Um campo só para os dois modos: quem tem conta no MARK SISTEM entra
            pelo e-mail, quem ainda está no painel entra pelo usuário. O
            servidor decide pelo formato — pedir ao usuário que escolha o modo
            seria expor uma migração que não é problema dele.
          */}
          <span>E-mail ou usuário</span>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoFocus
          />
        </label>

        <label className="campo">
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          className="btn btn-primario"
          style={{ width: "100%", marginTop: 8 }}
          disabled={enviando}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-tela" />}>
      <Formulario />
    </Suspense>
  );
}

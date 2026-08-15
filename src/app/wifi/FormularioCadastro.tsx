"use client";

import { useState } from "react";

/**
 * Formulário de dados pessoais do portal cativo. Coleta nome, e-mail e
 * (opcional) telefone, exige o aceite dos termos e, ao enviar, leva o visitante
 * para onde a API mandar — o endereço que libera a internet ou a tela de
 * "conectado". Os parâmetros do roteador vão junto, para a liberação funcionar.
 */
export default function FormularioCadastro({
  negocio,
  ap,
}: {
  negocio: string;
  ap: Record<string, string>;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/wifi/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, telefone, consentimento, ap }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok || !corpo?.destino) {
        setErro(corpo?.erro ?? "Não foi possível conectar. Tente de novo.");
        setEnviando(false);
        return;
      }
      window.location.href = corpo.destino as string;
    } catch {
      setErro("Falha de conexão. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <form className="portal-form" onSubmit={enviar} noValidate>
      {erro && (
        <p className="erro-msg" role="alert">
          {erro}
        </p>
      )}

      <label className="campo">
        <span>Nome</span>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="name"
          required
        />
      </label>

      <label className="campo">
        <span>E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          required
        />
      </label>

      <label className="campo">
        <span>WhatsApp (opcional)</span>
        <input
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          autoComplete="tel"
          inputMode="tel"
          placeholder="(00) 90000-0000"
        />
      </label>

      <label className="portal-consent">
        <input
          type="checkbox"
          checked={consentimento}
          onChange={(e) => setConsentimento(e.target.checked)}
        />
        <span>
          Autorizo o {negocio} a usar meus dados para liberar o acesso e enviar
          novidades. Posso pedir a remoção a qualquer momento.
        </span>
      </label>

      <button
        type="submit"
        className="portal-btn portal-btn-primario"
        disabled={enviando}
      >
        {enviando ? "Conectando…" : "Conectar ao Wi-Fi"}
      </button>
    </form>
  );
}

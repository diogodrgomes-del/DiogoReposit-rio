"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Identidade e saída.
 *
 * O logout chama a rota, que revoga a sessão no banco antes de apagar o cookie.
 * Só apagar o cookie deixaria o token valendo para quem o tivesse copiado — e
 * poder revogar é justamente o motivo de a sessão viver no banco.
 */
export function MenuUsuario({
  nome,
  papel,
  legado,
}: {
  nome: string;
  papel: string;
  legado?: boolean;
}) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function sair() {
    setSaindo(true);
    setErro(null);
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      // Sem feedback, o usuário fica sem saber se saiu — e pode deixar a
      // máquina achando que saiu.
      setErro("Não foi possível sair. Tente de novo.");
      setSaindo(false);
    }
  }

  return (
    <div className="sistema__usuario">
      {legado && (
        <span className="sistema__aviso" title="Login pelo DASH_USERS: só o painel de campanhas.">
          modo painel
        </span>
      )}
      <span>
        <strong style={{ color: "var(--ink)" }}>{nome}</strong>
        <span style={{ color: "var(--ink-3)" }}> · {papel}</span>
      </span>
      {erro && <span style={{ color: "var(--crit)", fontSize: 12 }}>{erro}</span>}
      <button type="button" className="btn btn--discreto" onClick={sair} disabled={saindo}>
        {saindo ? "Saindo…" : "Sair"}
      </button>
    </div>
  );
}

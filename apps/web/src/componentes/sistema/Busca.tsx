"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Busca global — ⌘K no Mac, Ctrl+K no resto.
 *
 * Três coisas que a fazem parecer instantânea:
 *
 * - **Debounce de 180ms.** Digitar "óticas" dispararia seis consultas; espera a
 *   pausa e dispara uma.
 * - **`AbortController`.** A resposta de "óti" chegando depois da de "óticas"
 *   sobrescreveria o resultado certo pelo errado. Cada busca cancela a anterior.
 * - **Navegação por teclado.** Setas e Enter, sem tirar a mão do teclado. Numa
 *   ferramenta que se usa o dia inteiro, isso decide se a busca é usada.
 */

type Resultado = {
  tipo: "cliente" | "lead" | "contato";
  id: string;
  titulo: string;
  subtitulo: string | null;
  href: string;
};

const ROTULO: Record<Resultado["tipo"], string> = {
  cliente: "Cliente",
  lead: "Lead",
  contato: "Contato",
};

export function Busca() {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const requisicao = useRef<AbortController | null>(null);

  // Atalho global.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((a) => !a);
      }
      if (e.key === "Escape") setAberta(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    if (aberta) campo.current?.focus();
    else {
      setTermo("");
      setResultados([]);
      setErro(null);
      setSelecionado(0);
    }
  }, [aberta]);

  const buscar = useCallback(async (q: string) => {
    requisicao.current?.abort();
    if (q.trim().length < 2) {
      setResultados([]);
      setCarregando(false);
      return;
    }

    const controlador = new AbortController();
    requisicao.current = controlador;
    setCarregando(true);
    setErro(null);

    try {
      const r = await fetch(`/api/busca?q=${encodeURIComponent(q)}`, {
        signal: controlador.signal,
      });
      if (!r.ok) throw new Error(r.status === 401 ? "Sessão expirada." : "Busca indisponível.");
      const dados = (await r.json()) as { resultados: Resultado[] };
      setResultados(dados.resultados);
      setSelecionado(0);
    } catch (e) {
      // Cancelamento não é erro: é a busca anterior saindo do caminho.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErro(e instanceof Error ? e.message : "Busca indisponível.");
      setResultados([]);
    } finally {
      if (!controlador.signal.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void buscar(termo), 180);
    return () => clearTimeout(t);
  }, [termo, buscar]);

  function navegar(r: Resultado) {
    setAberta(false);
    router.push(r.href);
  }

  function aoTeclarNoCampo(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelecionado((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelecionado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = resultados[selecionado];
      if (alvo) navegar(alvo);
    }
  }

  if (!aberta) {
    return (
      <button type="button" className="busca__gatilho" onClick={() => setAberta(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span>Buscar</span>
        <kbd>⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="busca__fundo" onClick={() => setAberta(false)} role="presentation">
      <div
        className="busca__caixa"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
      >
        <input
          ref={campo}
          className="busca__campo"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={aoTeclarNoCampo}
          placeholder="Cliente, lead, telefone…"
          aria-label="Termo de busca"
        />

        <div className="busca__lista">
          {erro && <p className="busca__aviso busca__aviso--erro">{erro}</p>}

          {!erro && carregando && <p className="busca__aviso">Buscando…</p>}

          {!erro && !carregando && termo.trim().length >= 2 && resultados.length === 0 && (
            <p className="busca__aviso">Nada encontrado para “{termo}”.</p>
          )}

          {!erro && termo.trim().length < 2 && (
            <p className="busca__aviso">Digite ao menos duas letras. Acento não faz diferença.</p>
          )}

          {resultados.map((r, i) => (
            <button
              key={`${r.tipo}-${r.id}`}
              type="button"
              className={`busca__item ${i === selecionado ? "busca__item--ativo" : ""}`}
              onMouseEnter={() => setSelecionado(i)}
              onClick={() => navegar(r)}
            >
              <span className="busca__tipo">{ROTULO[r.tipo]}</span>
              <span className="busca__titulo">{r.titulo}</span>
              {r.subtitulo && <span className="busca__sub">{r.subtitulo}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

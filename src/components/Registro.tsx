"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Alteracao } from "@/lib/meta";
import type { Anotacao } from "@/lib/registro";

type Props = { clienteId: string; nomeCliente: string };

type Item =
  | { tipo: "nota"; quando: string; dado: Anotacao }
  | { tipo: "meta"; quando: string; dado: Alteracao };

function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function diaDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default function Registro({ clienteId, nomeCliente }: Props) {
  const [aberto, setAberto] = useState(false);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [alteracoes, setAlteracoes] = useState<Alteracao[]>([]);
  const [temBanco, setTemBanco] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarRotina, setMostrarRotina] = useState(false);

  const buscar = useCallback(async () => {
    if (!clienteId) return;
    setCarregando(true);
    try {
      const r = await fetch(`/api/registro?cliente=${encodeURIComponent(clienteId)}`, {
        cache: "no-store",
      });
      const corpo = await r.json().catch(() => ({}));
      if (r.ok) {
        setAnotacoes(corpo.anotacoes ?? []);
        setAlteracoes(corpo.alteracoes ?? []);
        setTemBanco(corpo.bancoConfigurado !== false);
        setErro(null);
      } else {
        setErro(corpo?.erro ?? "Não foi possível carregar o registro.");
      }
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  // Só busca quando a seção é aberta: são chamadas caras e a maior parte das
  // visitas ao painel não passa por aqui.
  useEffect(() => {
    if (aberto) void buscar();
  }, [aberto, buscar]);

  // Trocar de cliente limpa o que estava na tela, para não misturar registros.
  useEffect(() => {
    setAnotacoes([]);
    setAlteracoes([]);
    setTexto("");
  }, [clienteId]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente: clienteId, texto: limpo }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(corpo?.erro ?? "Não foi possível salvar.");
      } else if (corpo.anotacao) {
        setAnotacoes((a) => [corpo.anotacao, ...a]);
        setTexto("");
      }
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(id: number) {
    const r = await fetch(`/api/registro?id=${id}`, { method: "DELETE" });
    if (r.ok) setAnotacoes((a) => a.filter((x) => x.id !== id));
  }

  const itens = useMemo<Item[]>(() => {
    const dosEventos: Item[] = alteracoes
      .filter((a) => mostrarRotina || a.peso <= 2)
      .map((a) => ({ tipo: "meta", quando: a.quando, dado: a }));
    const dasNotas: Item[] = anotacoes.map((a) => ({
      tipo: "nota",
      quando: a.criadoEm,
      dado: a,
    }));
    return [...dasNotas, ...dosEventos].sort((a, b) =>
      b.quando.localeCompare(a.quando)
    );
  }, [anotacoes, alteracoes, mostrarRotina]);

  const porDia = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of itens) {
      const d = i.quando.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), i]);
    }
    return [...m.entries()];
  }, [itens]);

  return (
    <section className="registro">
      <div className="diag-topo">
        <div>
          <h2>Registro de alterações e testes</h2>
          <p className="desc">
            O que mudou na conta de {nomeCliente}, junto das suas anotações.
          </p>
        </div>
        <button
          className="btn nao-imprime"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
        >
          {aberto ? "Ocultar" : "Abrir"} registro
        </button>
      </div>

      {aberto && (
        <div className="reg-corpo">
          <form className="reg-form nao-imprime" onSubmit={salvar}>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="O que você testou e por quê? Ex.: troquei o criativo do conjunto de Londrina para o vídeo de 15s, para ver se cai o CPM."
              rows={3}
              maxLength={2000}
              disabled={!temBanco}
            />
            <div className="reg-form-baixo">
              <span className="reg-contador">
                {texto.length > 0 && `${texto.length}/2000`}
              </span>
              <button
                type="submit"
                className="btn btn-primario"
                disabled={!texto.trim() || salvando || !temBanco}
              >
                {salvando ? "Salvando…" : "Registrar"}
              </button>
            </div>
          </form>

          {!temBanco && (
            <div className="aviso">
              <h3>Anotações ainda não estão ligadas</h3>
              <p>
                Falta cadastrar <code>DATABASE_URL</code> no servidor. Enquanto
                isso, a linha do tempo automática abaixo funciona normalmente.
              </p>
            </div>
          )}

          {erro && (
            <div className="aviso erro" role="alert">
              <p>{erro}</p>
            </div>
          )}

          <label className="reg-filtro nao-imprime">
            <input
              type="checkbox"
              checked={mostrarRotina}
              onChange={(e) => setMostrarRotina(e.target.checked)}
            />
            Mostrar também alterações de rotina (renomear, permissões)
          </label>

          {carregando && itens.length === 0 && (
            <div className="vazio" style={{ padding: "32px 12px", fontSize: 14 }}>
              carregando registro…
            </div>
          )}

          {!carregando && itens.length === 0 && (
            <div className="vazio" style={{ padding: "32px 12px", fontSize: 14 }}>
              Nenhuma alteração registrada ainda.
            </div>
          )}

          <div className="reg-linha-tempo">
            {porDia.map(([dia, doDia]) => (
              <div className="reg-dia" key={dia}>
                <h3 className="reg-dia-titulo">{diaDe(dia)}</h3>
                {doDia.map((i, idx) =>
                  i.tipo === "nota" ? (
                    <article className="reg-item nota" key={`n-${i.dado.id}`}>
                      <div className="reg-item-cab">
                        <span className="reg-marca">Anotação</span>
                        <span className="reg-hora">{dataHora(i.quando)}</span>
                        <span className="reg-autor">{i.dado.autor}</span>
                        <button
                          className="reg-apagar nao-imprime"
                          onClick={() => apagar(i.dado.id)}
                          title="Apagar esta anotação"
                          aria-label="Apagar anotação"
                        >
                          ×
                        </button>
                      </div>
                      <p className="reg-texto">{i.dado.texto}</p>
                    </article>
                  ) : (
                    <article
                      className={`reg-item meta peso-${i.dado.peso}`}
                      key={`m-${i.quando}-${idx}`}
                    >
                      <div className="reg-item-cab">
                        <span className="reg-marca">Meta</span>
                        <span className="reg-hora">{dataHora(i.quando)}</span>
                        {i.dado.autor && (
                          <span className="reg-autor">{i.dado.autor}</span>
                        )}
                      </div>
                      <p className="reg-texto">
                        {i.dado.descricao}
                        {i.dado.alvo && <em> — {i.dado.alvo}</em>}
                      </p>
                    </article>
                  )
                )}
              </div>
            ))}
          </div>

          <p className="nota-metrica">
            As linhas marcadas como <b>Meta</b> vêm do log de atividades da conta
            e aparecem sozinhas. As marcadas como <b>Anotação</b> são o que você
            escreveu. Cobranças diárias e eventos de entrega ficam de fora: são
            automáticos, acontecem várias vezes por dia e afogariam o que alguém
            de fato mudou.
          </p>
        </div>
      )}
    </section>
  );
}

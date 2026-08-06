"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { concluirAtividade, criarAtividade } from "./acoes";

/**
 * Atividades de um lead: o que já aconteceu e o que vem a seguir.
 *
 * O formulário fica **em cima** da lista, e não escondido atrás de um botão
 * "adicionar". Registrar a ligação que acabou de acontecer é a ação mais
 * frequente desta tela; um clique a mais nela é um clique a mais cinquenta
 * vezes por dia.
 */

export type ItemAtividade = {
  id: string;
  tipo: string;
  titulo: string;
  responsavelNome: string | null;
  agendadaPara: string | null;
  concluidaEm: string | null;
  observacao: string | null;
};

const ROTULO: Record<string, string> = {
  ligacao: "Ligação",
  reuniao: "Reunião",
  follow_up: "Follow-up",
  mensagem: "Mensagem",
  visita: "Visita",
  apresentacao: "Apresentação",
  proposta: "Envio de proposta",
  tarefa: "Tarefa",
};

const quando = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Registrando…" : "Registrar"}
    </button>
  );
}

export function Atividades({
  leadId,
  itens,
  podeEditar,
}: {
  leadId: string;
  itens: ItemAtividade[];
  podeEditar: boolean;
}) {
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <div className="cartao">
      <div className="cartao__cabeca">
        <strong>Atividades</strong>
        <span className="pagina__sub">{itens.length}</span>
      </div>

      {podeEditar && (
        <div className="cartao__corpo" style={{ borderBottom: "1px solid var(--border-2)" }}>
          <form
            ref={formulario}
            action={async (dados) => {
              await criarAtividade(dados);
              // Limpa para o próximo registro: quem acabou de anotar uma
              // ligação costuma anotar o follow-up em seguida.
              formulario.current?.reset();
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <input type="hidden" name="leadId" value={leadId} />

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "150px 1fr" }}>
              <label className="campo-sis">
                <span>Tipo</span>
                <select name="tipo" defaultValue="ligacao">
                  {Object.entries(ROTULO).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="campo-sis">
                <span>O que aconteceu, ou o que fazer</span>
                <input name="titulo" required maxLength={200} placeholder="Ligou, sem resposta" />
              </label>
            </div>

            <label className="campo-sis">
              <span>
                Agendar para<span className="opcional"> · opcional</span>
              </span>
              <input name="agendadaPara" type="datetime-local" />
            </label>

            <p className="pagina__sub" style={{ margin: 0 }}>
              Com data, vira o próximo contato do lead e aparece no painel.
            </p>

            <div>
              <Botao />
            </div>
          </form>
        </div>
      )}

      <div className="cartao__corpo">
        {itens.length === 0 ? (
          <p className="pagina__sub" style={{ margin: 0 }}>
            Nada registrado ainda.
          </p>
        ) : (
          <ul className="tempo">
            {itens.map((a) => {
              const atrasada =
                !a.concluidaEm && a.agendadaPara && new Date(a.agendadaPara) < new Date();

              return (
                <li key={a.id} className="tempo__item">
                  <span
                    className="tempo__ponto"
                    style={{
                      background: a.concluidaEm
                        ? "var(--good)"
                        : atrasada
                          ? "var(--crit)"
                          : "var(--acento)",
                    }}
                    aria-hidden
                  />
                  <div>
                    <p className="tempo__texto">
                      <strong>{ROTULO[a.tipo] ?? a.tipo}</strong> · {a.titulo}
                    </p>
                    <p className="tempo__quando">
                      {a.agendadaPara ? quando.format(new Date(a.agendadaPara)) : "sem data"}
                      {a.responsavelNome ? ` · ${a.responsavelNome}` : ""}
                      {a.concluidaEm ? " · concluída" : atrasada ? " · atrasada" : ""}
                    </p>

                    {a.observacao && (
                      <p className="tempo__quando" style={{ color: "var(--ink-2)" }}>
                        {a.observacao}
                      </p>
                    )}

                    {podeEditar && !a.concluidaEm && (
                      <form action={concluirAtividade} style={{ marginTop: 6 }}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="leadId" value={leadId} />
                        <button
                          type="submit"
                          className="btn btn--discreto"
                          style={{ height: 26, padding: "0 10px", fontSize: 12 }}
                        >
                          Marcar como feita
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

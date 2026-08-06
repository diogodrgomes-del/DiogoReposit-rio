"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { criarLead, type EstadoForm } from "./acoes";

/**
 * Cadastro rápido de lead.
 *
 * Dois campos obrigatórios: nome e telefone. É o requisito 7.3 do briefing, e
 * a razão dele é prática — quem está ao telefone com um interessado não pode
 * parar para descobrir o segmento da empresa antes de salvar.
 *
 * O telefone é o único campo validado de verdade, porque é a chave que liga
 * este lead à conversa de WhatsApp e ao contato que já pode existir. Um
 * telefone errado aqui parte o histórico da pessoa em dois.
 */
function Botao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--acento" disabled={pending}>
      {pending ? "Criando…" : "Criar lead"}
    </button>
  );
}

export function FormularioLead({ colegas }: { colegas: { id: string; nome: string }[] }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarLead, {});

  return (
    <form action={enviar}>
      {estado.erro && !estado.campo && <p className="aviso-erro">{estado.erro}</p>}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao__cabeca">
          <strong>Obrigatório</strong>
          <span className="pagina__sub">Só isto para salvar</span>
        </div>
        <div className="cartao__corpo grade grade--2">
          <label className={`campo-sis ${estado.campo === "nome" ? "campo-sis--erro" : ""}`}>
            <span>Nome</span>
            <input name="nome" required autoFocus maxLength={200} />
            {estado.campo === "nome" && <span className="campo-sis__erro">{estado.erro}</span>}
          </label>

          <label className={`campo-sis ${estado.campo === "telefone" ? "campo-sis--erro" : ""}`}>
            <span>Telefone / WhatsApp</span>
            <input name="telefone" required placeholder="(44) 99888-7777" inputMode="tel" />
            {estado.campo === "telefone" && (
              <span className="campo-sis__erro">{estado.erro}</span>
            )}
          </label>
        </div>
      </div>

      <div className="cartao" style={{ marginBottom: 20 }}>
        <div className="cartao__cabeca">
          <strong>Se você já souber</strong>
          <span className="pagina__sub">Tudo pode ficar para depois</span>
        </div>
        <div className="cartao__corpo grade grade--2">
          <label className="campo-sis">
            <span>
              Empresa<span className="opcional"> · opcional</span>
            </span>
            <input name="empresa" />
          </label>

          <label className="campo-sis">
            <span>
              E-mail<span className="opcional"> · opcional</span>
            </span>
            <input name="email" type="email" />
          </label>

          <label className="campo-sis">
            <span>
              Cidade<span className="opcional"> · opcional</span>
            </span>
            <input name="cidade" />
          </label>

          <label className="campo-sis">
            <span>
              Origem<span className="opcional"> · opcional</span>
            </span>
            <input name="origem" placeholder="Indicação, Instagram, tráfego…" list="origens" />
            <datalist id="origens">
              <option value="Indicação" />
              <option value="Instagram" />
              <option value="Meta Ads" />
              <option value="Google" />
              <option value="Prospecção ativa" />
              <option value="Evento" />
            </datalist>
          </label>

          <label className="campo-sis">
            <span>
              Serviço procurado<span className="opcional"> · opcional</span>
            </span>
            <input name="servico" />
          </label>

          <label className="campo-sis">
            <span>
              Valor estimado<span className="opcional"> · opcional</span>
            </span>
            <input name="valorEstimado" inputMode="decimal" placeholder="2500" />
          </label>

          <label className="campo-sis">
            <span>
              Temperatura<span className="opcional"> · opcional</span>
            </span>
            <select name="temperatura" defaultValue="">
              <option value="">Não sei ainda</option>
              <option value="quente">Quente</option>
              <option value="morno">Morno</option>
              <option value="frio">Frio</option>
            </select>
          </label>

          <label className="campo-sis">
            <span>
              Responsável<span className="opcional"> · opcional</span>
            </span>
            <select name="responsavelId" defaultValue="">
              <option value="">Eu mesmo</option>
              {colegas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Botao />
        <Link className="btn" href="/vendas">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

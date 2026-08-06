"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Cliente } from "@mark/core";
import type { EstadoForm } from "./acoes";
import { ROTULO_SAUDE, ROTULO_STATUS } from "./comuns";

/**
 * Cadastro e edição de cliente.
 *
 * Um único campo obrigatório: o nome. O briefing é explícito — nunca bloquear a
 * criação porque um campo secundário está vazio. Tudo o mais leva "opcional" no
 * rótulo, para ninguém parar de preencher achando que precisa buscar o dado.
 */

type Props = {
  acao: (estado: EstadoForm, formulario: FormData) => Promise<EstadoForm>;
  cliente?: Cliente;
  colegas: { id: string; nome: string }[];
};

function Botao({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--acento" disabled={pending}>
      {pending ? "Salvando…" : rotulo}
    </button>
  );
}

function Campo({
  nome,
  rotulo,
  valor,
  erro,
  campoComErro,
  ...resto
}: {
  nome: string;
  rotulo: string;
  valor?: string | null;
  erro?: string;
  campoComErro?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const temErro = campoComErro === nome;
  return (
    <label className={`campo-sis ${temErro ? "campo-sis--erro" : ""}`}>
      <span>
        {rotulo}
        {!resto.required && <span className="opcional"> · opcional</span>}
      </span>
      <input name={nome} defaultValue={valor ?? ""} {...resto} />
      {temErro && erro && <span className="campo-sis__erro">{erro}</span>}
    </label>
  );
}

export function FormularioCliente({ acao, cliente, colegas }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {});
  const editando = Boolean(cliente);

  return (
    <form action={enviar}>
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      {/* Erro sem campo associado aparece no topo; erro de campo, junto dele. */}
      {estado.erro && !estado.campo && <p className="aviso-erro">{estado.erro}</p>}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao__cabeca">
          <strong>Identificação</strong>
        </div>
        <div className="cartao__corpo grade grade--2">
          <Campo
            nome="nome"
            rotulo="Nome da empresa"
            valor={cliente?.nome}
            required
            maxLength={200}
            autoFocus={!editando}
            erro={estado.erro}
            campoComErro={estado.campo}
          />
          <Campo nome="nomeFantasia" rotulo="Nome fantasia" valor={cliente?.nomeFantasia} />
          <Campo
            nome="cnpj"
            rotulo="CNPJ"
            valor={cliente?.cnpj}
            placeholder="00.000.000/0000-00"
            erro={estado.erro}
            campoComErro={estado.campo}
          />
          <Campo nome="segmento" rotulo="Segmento" valor={cliente?.segmento} />
        </div>
      </div>

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao__cabeca">
          <strong>Contato</strong>
        </div>
        <div className="cartao__corpo grade grade--2">
          <Campo
            nome="telefone"
            rotulo="Telefone / WhatsApp"
            valor={cliente?.telefoneE164}
            placeholder="(44) 99888-7777"
            erro={estado.erro}
            campoComErro={estado.campo}
          />
          <Campo nome="email" rotulo="E-mail" valor={cliente?.email} type="email" />
          <Campo nome="cidade" rotulo="Cidade" valor={cliente?.cidade} />
          <Campo
            nome="estado"
            rotulo="UF"
            valor={cliente?.estado}
            maxLength={2}
            placeholder="PR"
            erro={estado.erro}
            campoComErro={estado.campo}
          />
          <Campo nome="instagram" rotulo="Instagram" valor={cliente?.instagram} placeholder="@perfil" />
          <Campo nome="site" rotulo="Site" valor={cliente?.site} placeholder="https://" />
        </div>
      </div>

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao__cabeca">
          <strong>Situação</strong>
        </div>
        <div className="cartao__corpo grade grade--2">
          <label className="campo-sis">
            <span>Status</span>
            <select name="status" defaultValue={cliente?.status ?? "onboarding"}>
              {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo-sis">
            <span>Saúde</span>
            <select name="saude" defaultValue={cliente?.saude ?? "verde"}>
              {Object.entries(ROTULO_SAUDE).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo-sis">
            <span>
              Responsável<span className="opcional"> · opcional</span>
            </span>
            <select name="responsavelId" defaultValue={cliente?.responsavelId ?? ""}>
              <option value="">Sem responsável</option>
              {colegas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="cartao" style={{ marginBottom: 20 }}>
        <div className="cartao__cabeca">
          <strong>Observações</strong>
        </div>
        <div className="cartao__corpo">
          <label className="campo-sis">
            <span className="opcional">Anotações internas sobre este cliente</span>
            <textarea name="observacoes" defaultValue={cliente?.observacoes ?? ""} rows={4} />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Botao rotulo={editando ? "Salvar alterações" : "Criar cliente"} />
        <Link className="btn" href={cliente ? `/clientes/${cliente.id}` : "/clientes"}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

"use client";

import { useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card, CardTitulo } from "@/components/ui/Card";
import { Campo, Input, Textarea } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { relativo } from "@/lib/formato";
import { salvarEstrategia } from "../../acoes";

type Valores = Record<string, string>;

/**
 * Salvamento automático com debounce de 800 ms.
 *
 * Estratégia é texto longo que se escreve aos poucos, e o botão Salvar é
 * exatamente o que se esquece de clicar antes de fechar a aba.
 */
export function EditorEstrategia({
  clientId,
  valores,
  podeEditar,
  atualizadoEm,
}: {
  clientId: string;
  valores: Valores;
  podeEditar: boolean;
  atualizadoEm: string | null;
}) {
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const pendentes = useRef<Valores>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  function agendar(campo: string, valor: string) {
    if (!podeEditar) return;
    pendentes.current[campo] = valor;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const lote = { ...pendentes.current };
      pendentes.current = {};
      setEstado("salvando");
      const r = await salvarEstrategia({ clientId, ...lote });
      if (!r.ok) {
        setEstado("parado");
        return toast(r.erro, { tom: "erro" });
      }
      setEstado("salvo");
      setTimeout(() => setEstado("parado"), 2000);
    }, 800);
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Estratégia</h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-texto-2)]">
            {podeEditar
              ? "Salva sozinho enquanto você escreve."
              : "Somente leitura."}
            {atualizadoEm && ` Atualizada ${relativo(atualizadoEm)}.`}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-texto-3)]">
          {estado === "salvando" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              salvando…
            </>
          )}
          {estado === "salvo" && (
            <>
              <Check className="h-3.5 w-3.5 text-[var(--color-sucesso)]" />
              salvo
            </>
          )}
        </span>
      </div>

      <div className="space-y-5">
        <Card>
          <CardTitulo>Direção</CardTitulo>
          <div className="space-y-3.5 p-4">
            <Campo label="Objetivo principal">
              <Input
                defaultValue={valores.objetivoPrincipal}
                disabled={!podeEditar}
                placeholder="Aumentar agendamentos vindos do Instagram"
                onChange={(e) => agendar("objetivoPrincipal", e.target.value)}
              />
            </Campo>
            <Campo label="Posicionamento">
              <Textarea
                defaultValue={valores.posicionamento}
                disabled={!podeEditar}
                onChange={(e) => agendar("posicionamento", e.target.value)}
              />
            </Campo>
            <Campo label="Público-alvo">
              <Textarea
                defaultValue={valores.publicoAlvo}
                disabled={!podeEditar}
                onChange={(e) => agendar("publicoAlvo", e.target.value)}
              />
            </Campo>
            <Campo label="Persona">
              <Textarea
                defaultValue={valores.persona}
                disabled={!podeEditar}
                onChange={(e) => agendar("persona", e.target.value)}
              />
            </Campo>
            <Campo label="Tom de voz">
              <Input
                defaultValue={valores.tomDeVoz}
                disabled={!podeEditar}
                placeholder="Próximo, direto, sem gíria"
                onChange={(e) => agendar("tomDeVoz", e.target.value)}
              />
            </Campo>
          </div>
        </Card>

        <Card>
          <CardTitulo>Listas</CardTitulo>
          <div className="grid gap-3.5 p-4 sm:grid-cols-2">
            <ListaCampo
              label="Diferenciais"
              valor={valores.diferenciais}
              campo="diferenciais"
              agendar={agendar}
              editavel={podeEditar}
            />
            <ListaCampo
              label="Concorrentes"
              valor={valores.concorrentes}
              campo="concorrentes"
              agendar={agendar}
              editavel={podeEditar}
            />
            <ListaCampo
              label="Pilares de conteúdo"
              valor={valores.pilaresConteudo}
              campo="pilaresConteudo"
              agendar={agendar}
              editavel={podeEditar}
            />
            <ListaCampo
              label="Palavras proibidas"
              valor={valores.palavrasProibidas}
              campo="palavrasProibidas"
              agendar={agendar}
              editavel={podeEditar}
            />
            <ListaCampo
              label="Dores do público"
              valor={valores.dores}
              campo="dores"
              agendar={agendar}
              editavel={podeEditar}
            />
            <ListaCampo
              label="Objeções"
              valor={valores.objecoes}
              campo="objecoes"
              agendar={agendar}
              editavel={podeEditar}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function ListaCampo({
  label,
  valor,
  campo,
  agendar,
  editavel,
}: {
  label: string;
  valor: string;
  campo: string;
  agendar: (campo: string, valor: string) => void;
  editavel: boolean;
}) {
  return (
    <Campo label={label} ajuda="Um por linha.">
      <Textarea
        defaultValue={valor}
        disabled={!editavel}
        rows={4}
        onChange={(e) => agendar(campo, e.target.value)}
      />
    </Campo>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dataLonga } from "@/lib/format";
import { hojeISO } from "@/lib/presets";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
// Segunda a domingo, como no Gerenciador de Anúncios.
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Props = {
  since: string;
  until: string;
  onChange: (since: string, until: string) => void;
  onFechar: () => void;
};

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Quantas colunas vazias antes do dia 1, com a semana começando na segunda. */
function deslocamento(ano: number, mes: number): number {
  return (new Date(Date.UTC(ano, mes, 1)).getUTCDay() + 6) % 7;
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function Mes({
  ano,
  mes,
  since,
  until,
  provisorio,
  maximo,
  onDia,
  onHover,
}: {
  ano: number;
  mes: number;
  since: string;
  until: string;
  provisorio: string | null;
  maximo: string;
  onDia: (d: string) => void;
  onHover: (d: string | null) => void;
}) {
  const total = diasNoMes(ano, mes);
  const antes = deslocamento(ano, mes);

  // Durante a seleção, o fim é o dia sob o cursor — a faixa acompanha o mouse.
  const fim = provisorio && provisorio > since ? provisorio : until;
  const inicio = provisorio && provisorio < since ? provisorio : since;

  const celulas: React.ReactNode[] = [];
  for (let i = 0; i < antes; i++) {
    celulas.push(<span key={`v${i}`} className="cal-vazio" />);
  }
  for (let d = 1; d <= total; d++) {
    const data = iso(ano, mes, d);
    const futuro = data > maximo;
    const eInicio = data === inicio;
    const eFim = data === fim;
    const dentro = data > inicio && data < fim;
    const hoje = data === hojeISO();

    celulas.push(
      <button
        key={data}
        type="button"
        disabled={futuro}
        onClick={() => onDia(data)}
        onMouseEnter={() => onHover(data)}
        className={[
          "cal-dia",
          eInicio ? "ini" : "",
          eFim ? "fim" : "",
          dentro ? "dentro" : "",
          hoje && !eInicio && !eFim ? "hoje" : "",
        ].join(" ").trim()}
        aria-label={dataLonga(data)}
        aria-pressed={eInicio || eFim}
      >
        {d}
      </button>
    );
  }

  return (
    <div className="cal-mes">
      <div className="cal-titulo">
        {MESES[mes]} <span>{ano}</span>
      </div>
      <div className="cal-grade cal-cab">
        {DIAS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grade" onMouseLeave={() => onHover(null)}>
        {celulas}
      </div>
    </div>
  );
}

export default function Calendario({ since, until, onChange, onFechar }: Props) {
  const maximo = hojeISO();
  const [ano, mes] = useMemo(() => {
    const [a, m] = since.split("-").map(Number);
    return [a, m - 1];
  }, [since]);

  const [base, setBase] = useState({ ano, mes });
  const [inicioSel, setInicioSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc — comportamento esperado de um popover.
  useEffect(() => {
    function clique(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) onFechar();
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [onFechar]);

  const proximo = useMemo(() => {
    const m = base.mes === 11 ? 0 : base.mes + 1;
    const a = base.mes === 11 ? base.ano + 1 : base.ano;
    return { ano: a, mes: m };
  }, [base]);

  function andar(delta: number) {
    setBase(({ ano, mes }) => {
      const total = ano * 12 + mes + delta;
      return { ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
    });
  }

  function escolher(dia: string) {
    if (!inicioSel) {
      // Primeiro clique abre uma nova faixa.
      setInicioSel(dia);
      onChange(dia, dia);
      return;
    }
    // Segundo clique fecha a faixa, aceitando cliques em ordem invertida.
    const a = dia < inicioSel ? dia : inicioSel;
    const b = dia < inicioSel ? inicioSel : dia;
    setInicioSel(null);
    setHover(null);
    onChange(a, b);
    onFechar();
  }

  const provisorio = inicioSel ? hover : null;
  const exibeInicio = inicioSel ?? since;

  return (
    <div className="cal-pop" ref={caixa} role="dialog" aria-label="Selecionar período">
      <div className="cal-topo">
        <button type="button" className="cal-nav" onClick={() => andar(-1)} aria-label="Mês anterior">
          ‹
        </button>
        <div className="cal-rotulo">
          {MESES_LONGOS[base.mes]} {base.ano} — {MESES_LONGOS[proximo.mes]} {proximo.ano}
        </div>
        <button
          type="button"
          className="cal-nav"
          onClick={() => andar(1)}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className="cal-meses">
        <Mes
          ano={base.ano}
          mes={base.mes}
          since={exibeInicio}
          until={until}
          provisorio={provisorio}
          maximo={maximo}
          onDia={escolher}
          onHover={setHover}
        />
        <Mes
          ano={proximo.ano}
          mes={proximo.mes}
          since={exibeInicio}
          until={until}
          provisorio={provisorio}
          maximo={maximo}
          onDia={escolher}
          onHover={setHover}
        />
      </div>

      <div className="cal-rodape">
        <span className="cal-faixa">
          {inicioSel
            ? "selecione a data final"
            : `${dataLonga(since)} — ${dataLonga(until)}`}
        </span>
        <button type="button" className="btn" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  );
}

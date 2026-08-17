import type { Frequencia } from "./recorrencia";

/**
 * Tipos e constantes do financeiro que a tela tambem usa.
 *
 * Vivem longe de `financeiro.ts` porque aquele modulo importa os drivers de
 * Postgres: um `import` de constante a partir de um componente arrastaria o
 * `pg` inteiro para o pacote do navegador. Aqui nao ha nada alem de dados.
 */

export type Area = "marktiva" | "pessoal";
export type Tipo = "entrada" | "saida";

export const AREAS: Area[] = ["marktiva", "pessoal"];

export const ROTULO_AREA: Record<Area, string> = {
  marktiva: "Marktiva",
  pessoal: "Diogo",
};

export const DESCRICAO_AREA: Record<Area, string> = {
  marktiva: "Financeiro da empresa",
  pessoal: "Financeiro pessoal",
};

export function ehArea(v: unknown): v is Area {
  return v === "marktiva" || v === "pessoal";
}

export function ehTipo(v: unknown): v is Tipo {
  return v === "entrada" || v === "saida";
}

/**
 * Categorias sugeridas por area e tipo.
 *
 * Sugestao, nao trava: o campo aceita texto livre, porque despesa nova
 * aparece antes de qualquer lista ser atualizada. Servem para o agrupamento
 * de despesas nao virar vinte variacoes de "software".
 */
export const CATEGORIAS: Record<Area, Record<Tipo, string[]>> = {
  marktiva: {
    entrada: [
      "Mensalidade",
      "Projeto pontual",
      "Tráfego pago",
      "Social media",
      "Site / Landing page",
      "Consultoria",
      "Outros",
    ],
    saida: [
      "Ferramentas / Software",
      "Verba de anúncios",
      "Freelancer",
      "Impostos",
      "Pró-labore",
      "Contador",
      "Marketing próprio",
      "Taxas bancárias",
      "Outros",
    ],
  },
  pessoal: {
    entrada: ["Pró-labore", "Salário", "Freelance", "Rendimentos", "Outros"],
    saida: [
      "Moradia",
      "Alimentação",
      "Transporte",
      "Saúde",
      "Educação",
      "Lazer",
      "Assinaturas",
      "Cartão de crédito",
      "Investimentos",
      "Outros",
    ],
  },
};

export const FORMAS = [
  "Pix",
  "Boleto",
  "Transferência",
  "Cartão",
  "Dinheiro",
  "Débito automático",
];

export type Lancamento = {
  id: number;
  area: Area;
  tipo: Tipo;
  descricao: string;
  categoria: string;
  cliente: string | null;
  valor: number;
  competencia: string; // YYYY-MM — mes a que o valor pertence
  vencimento: string; // YYYY-MM-DD
  pagoEm: string | null; // YYYY-MM-DD
  forma: string | null;
  observacao: string | null;
  cobradoEm: string | null; // quando a cobranca foi enviada ao cliente
  recorrenciaId: number | null;
  criadoEm: string;
};

export type Recorrencia = {
  id: number;
  area: Area;
  tipo: Tipo;
  descricao: string;
  categoria: string;
  cliente: string | null;
  valor: number;
  frequencia: Frequencia;
  diaVencimento: number;
  inicio: string;
  fim: string | null;
  lembreteDias: number;
  ajustaDiaUtil: boolean;
  ativo: boolean;
  criadoEm: string;
};

export type Resumo = {
  entradasPrevistas: number;
  entradasRecebidas: number;
  saidasPrevistas: number;
  saidasPagas: number;
  saldoPrevisto: number;
  saldoRealizado: number;
  aReceber: number;
  aPagar: number;
  vencidoReceber: number;
  vencidoPagar: number;
};

export type SaldoMes = {
  competencia: string;
  entradas: number;
  saidas: number;
  recebido: number;
  pago: number;
};

export type Categoria = {
  categoria: string;
  previsto: number;
  pago: number;
  itens: number;
};

/**
 * Le valor em "1.234,56", "1.000" ou "1234.56".
 *
 * Quem digita num painel em portugues usa virgula; quem cola de uma planilha
 * em ingles usa ponto. Recusar qualquer um dos dois seria implicancia. Fica
 * aqui porque a tela valida antes de enviar e o servidor valida de novo ao
 * receber — a mesma regra nos dois lados.
 *
 * O caso ambiguo e o ponto sozinho: "1.000" e mil em portugues e um em ingles.
 * Desempata pelo tamanho dos grupos — ponto seguido de exatamente tres digitos
 * ate o fim e separador de milhar. Assim "1.000" vira 1000 e "12.50" continua
 * 12,50, que e como cada um dos dois seria escrito de verdade.
 */
export function valorDe(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  const limpo = v.trim().replace(/[R$\s]/g, "");
  if (!limpo) return null;

  let normal: string;
  if (limpo.includes(",")) {
    normal = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normal = limpo.replace(/\./g, "");
  } else {
    normal = limpo;
  }

  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

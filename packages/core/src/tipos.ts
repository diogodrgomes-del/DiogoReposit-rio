/**
 * Vocabulário do domínio e formas de dado — sem uma linha de acesso a banco.
 *
 * Existe para que componentes de navegador possam importar tipos e listas de
 * opções sem arrastar Drizzle e o driver do Postgres para o pacote que vai ao
 * cliente. É a fronteira que `@mark/core/navegador` publica.
 *
 * A verdade dessas listas continua no banco, nas restrições CHECK das
 * migrações. Aqui está a mesma verdade em TypeScript, para a tela.
 */

export const STATUS_CLIENTE = [
  "ativo",
  "onboarding",
  "pausado",
  "inadimplente",
  "em_risco",
  "cancelado",
  "encerrado",
] as const;

export type StatusCliente = (typeof STATUS_CLIENTE)[number];

export const SAUDE_CLIENTE = ["verde", "amarelo", "vermelho"] as const;
export type SaudeCliente = (typeof SAUDE_CLIENTE)[number];

export const ETAPAS_VENDAS_PADRAO = [
  { nome: "Lead novo", tipo: "aberta" },
  { nome: "Primeiro contato", tipo: "aberta" },
  { nome: "Reunião agendada", tipo: "aberta" },
  { nome: "Diagnóstico", tipo: "aberta" },
  { nome: "Proposta enviada", tipo: "aberta" },
  { nome: "Negociação", tipo: "aberta" },
  { nome: "Fechado", tipo: "ganho" },
  { nome: "Perdido", tipo: "perda" },
] as const;

export const MOTIVOS_PERDA = [
  "preco",
  "sem_orcamento",
  "nao_respondeu",
  "concorrente",
  "nao_era_momento",
  "servico_incompativel",
  "desistiu",
  "sem_interesse",
  "outro",
] as const;

export type MotivoPerda = (typeof MOTIVOS_PERDA)[number];

export type Cliente = {
  id: string;
  nome: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  segmento: string | null;
  telefoneE164: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  instagram: string | null;
  site: string | null;
  responsavelId: string | null;
  status: StatusCliente;
  saude: SaudeCliente;
  observacoes: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type Etapa = {
  id: string;
  nome: string;
  ordem: number;
  tipo: "aberta" | "ganho" | "perda";
  cor: string | null;
};

export type CardLead = {
  id: string;
  nome: string;
  telefone: string | null;
  empresa: string | null;
  valorEstimado: number | null;
  temperatura: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  proximaAcao: string | null;
  proximoContatoEm: string | null;
  etapaId: string;
  ordem: number;
};

export type Coluna = Etapa & { cards: CardLead[] };

export type Colega = { id: string; nome: string };

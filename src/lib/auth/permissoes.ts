import type { Papel } from "@prisma/client";

/**
 * Catalogo de permissoes. Formato `recurso:acao`.
 *
 * Papeis sao constantes no codigo, e nao linhas no banco: assim a matriz e
 * versionada, revisavel em pull request e testavel. A excecao caso a caso vive
 * em permission_grants, o que evita inventar papel novo para cada arranjo.
 */
export const PERMISSOES = [
  "leads:ler",
  "leads:criar",
  "leads:editar",
  "leads:excluir",
  "leads:mover",
  "leads:atribuir",

  "propostas:ler",
  "propostas:criar",
  "propostas:editar",

  "clientes:ler",
  "clientes:criar",
  "clientes:editar",
  "clientes:excluir",
  "clientes:ver_contrato",

  "estrategia:ler",
  "estrategia:editar",

  "demandas:ler",
  "demandas:ler_todas",
  "demandas:criar",
  "demandas:editar",
  "demandas:excluir",
  "demandas:atribuir",

  "agenda:ler",
  "agenda:ler_todas",
  "agenda:criar",
  "agenda:editar",
  "agenda:excluir",

  "arquivos:ler",
  "arquivos:enviar",
  "arquivos:excluir",

  "credenciais:ler",
  "credenciais:revelar",
  "credenciais:criar",
  "credenciais:editar",
  "credenciais:excluir",

  "trafego:ler",
  "trafego:editar",
  "trafego:ver_investimento",

  "financeiro.empresa:ler",
  "financeiro.empresa:criar",
  "financeiro.empresa:editar",
  "financeiro.empresa:excluir",

  "financeiro.pessoal:ler",
  "financeiro.pessoal:criar",
  "financeiro.pessoal:editar",
  "financeiro.pessoal:excluir",

  "organizacao:ler",
  "organizacao:editar",
  "organizacao:convidar",
  "organizacao:gerenciar_permissoes",
  "organizacao:ver_auditoria",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

const TUDO = PERMISSOES as readonly Permissao[];

/** Permissoes de quem so mexe no proprio trabalho. */
const BASE_COLABORADOR: Permissao[] = [
  "clientes:ler",
  "estrategia:ler",
  "demandas:ler",
  "demandas:criar",
  "demandas:editar",
  "agenda:ler",
  "agenda:criar",
  "agenda:editar",
  "arquivos:ler",
  "arquivos:enviar",
];

export const PERMISSOES_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  // Unico papel com o financeiro pessoal.
  PROPRIETARIO: TUDO,

  ADMIN: TUDO.filter((p) => !p.startsWith("financeiro.pessoal:")),

  GESTOR: [
    "leads:ler", "leads:criar", "leads:editar", "leads:mover", "leads:atribuir",
    "propostas:ler", "propostas:criar", "propostas:editar",
    "clientes:ler", "clientes:criar", "clientes:editar", "clientes:ver_contrato",
    "estrategia:ler", "estrategia:editar",
    "demandas:ler", "demandas:ler_todas", "demandas:criar", "demandas:editar",
    "demandas:excluir", "demandas:atribuir",
    "agenda:ler", "agenda:ler_todas", "agenda:criar", "agenda:editar", "agenda:excluir",
    "arquivos:ler", "arquivos:enviar", "arquivos:excluir",
    "trafego:ler", "trafego:editar", "trafego:ver_investimento",
    "credenciais:ler",
    "organizacao:ler",
  ],

  COMERCIAL: [
    "leads:ler", "leads:criar", "leads:editar", "leads:excluir", "leads:mover",
    "leads:atribuir",
    "propostas:ler", "propostas:criar", "propostas:editar",
    "clientes:ler", "clientes:criar",
    "demandas:ler", "demandas:criar",
    "agenda:ler", "agenda:ler_todas", "agenda:criar", "agenda:editar",
    "arquivos:ler", "arquivos:enviar",
  ],

  FINANCEIRO: [
    "clientes:ler", "clientes:ver_contrato",
    "financeiro.empresa:ler", "financeiro.empresa:criar",
    "financeiro.empresa:editar", "financeiro.empresa:excluir",
    "agenda:ler",
    "arquivos:ler", "arquivos:enviar",
  ],

  TRAFEGO: [
    ...BASE_COLABORADOR,
    "estrategia:editar",
    "trafego:ler", "trafego:editar", "trafego:ver_investimento",
    "credenciais:ler", "credenciais:revelar",
  ],

  SOCIAL: [...BASE_COLABORADOR, "estrategia:editar", "trafego:ler"],
  DESIGNER: [...BASE_COLABORADOR],
  EDITOR: [...BASE_COLABORADOR],
  FILMMAKER: [...BASE_COLABORADOR],
  COLABORADOR: [
    "clientes:ler",
    "demandas:ler",
    "demandas:editar",
    "agenda:ler",
    "arquivos:ler",
  ],
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  PROPRIETARIO: "Proprietário",
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  COMERCIAL: "Comercial",
  FINANCEIRO: "Financeiro",
  TRAFEGO: "Tráfego",
  SOCIAL: "Social media",
  DESIGNER: "Designer",
  EDITOR: "Editor",
  FILMMAKER: "Filmmaker",
  COLABORADOR: "Colaborador",
};

/** Papeis que enxergam todos os clientes, sem depender de atribuicao. */
export const PAPEIS_SEM_ESCOPO: Papel[] = [
  "PROPRIETARIO",
  "ADMIN",
  "GESTOR",
  "COMERCIAL",
  "FINANCEIRO",
];

/**
 * Catálogo de permissões do MARK SISTEM.
 *
 * Formato: `modulo.recurso.acao`.
 *
 * Este arquivo é a única fonte da verdade. A tela de papéis é gerada a partir
 * dele, o seed concede a partir dele, e o teste de matriz do CI confere que toda
 * rota protegida cita uma permissão que existe aqui. Permissão escrita errada
 * numa chamada vira erro de tipo, não bug de produção.
 */

export const PERMISSOES = [
  // Vendas
  "vendas.lead.ver",
  "vendas.lead.criar",
  "vendas.lead.editar",
  "vendas.lead.excluir",
  "vendas.atividade.ver",
  "vendas.atividade.editar",
  "vendas.proposta.ver",
  "vendas.proposta.editar",
  "vendas.pipeline.configurar",
  "vendas.painel.ver",

  // Clientes
  "clientes.cliente.ver",
  "clientes.cliente.criar",
  "clientes.cliente.editar",
  "clientes.cliente.excluir",
  "clientes.contato.ver",
  "clientes.contato.editar",
  "clientes.contrato.ver",
  "clientes.contrato.editar",
  "clientes.estrategia.ver",
  "clientes.estrategia.editar",
  "clientes.pesquisa.ver",
  "clientes.pesquisa.editar",

  // Operacional
  "operacional.demanda.ver",
  "operacional.demanda.criar",
  "operacional.demanda.editar",
  "operacional.demanda.excluir",
  "operacional.demanda.ver_todas", // sem isto, vê só as próprias
  "operacional.tempo.registrar",
  "operacional.tempo.ver_equipe",
  "operacional.quadro.configurar",
  "operacional.aprovacao.ver",
  "operacional.aprovacao.decidir",
  "operacional.gravacao.ver",
  "operacional.gravacao.editar",

  // Agenda
  "agenda.evento.ver",
  "agenda.evento.editar",
  "agenda.evento.ver_equipe",

  // Tráfego
  "trafego.painel.ver",
  "trafego.conta.editar",
  "trafego.sincronizar",

  // Arquivos
  "arquivos.arquivo.ver",
  "arquivos.arquivo.enviar",
  "arquivos.arquivo.excluir",

  // WhatsApp
  "whatsapp.conversa.ver",
  "whatsapp.conversa.responder",
  "whatsapp.conversa.ver_todas",
  "whatsapp.numero.configurar",
  "whatsapp.campanha.ver",
  "whatsapp.campanha.disparar",

  // Financeiro empresarial
  "financeiro.painel.ver",
  "financeiro.lancamento.ver",
  "financeiro.lancamento.criar",
  "financeiro.lancamento.editar",
  "financeiro.lancamento.excluir",
  "financeiro.fluxo.ver",
  "financeiro.relatorio.exportar",

  // Financeiro pessoal — NÃO concedível por papel. Ver `pode()`.
  "financeiro.pessoal.ver",
  "financeiro.pessoal.editar",

  // Credenciais
  "credenciais.credencial.ver", // saber que existe, sem ler o segredo
  "credenciais.credencial.revelar",
  "credenciais.credencial.editar",

  // Conteúdo interno
  "wiki.pagina.ver",
  "wiki.pagina.editar",
  "mural.aviso.ver",
  "mural.aviso.publicar",

  // Configuração
  "config.usuario.ver",
  "config.usuario.editar",
  "config.papel.editar",
  "config.auditoria.ver",
  "config.organizacao.editar",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

const CONJUNTO_PERMISSOES: ReadonlySet<string> = new Set(PERMISSOES);

export function permissaoExiste(valor: string): valor is Permissao {
  return CONJUNTO_PERMISSOES.has(valor);
}

/**
 * Módulos cuja simples existência não deve ser confirmada a quem não tem
 * acesso. Negar aqui responde 404, não 403 — um 403 já contaria que a área
 * existe e que há algo a esconder.
 */
export const MODULOS_OCULTOS = ["financeiro", "credenciais"] as const;

export function ocultarAoNegar(permissao: string): boolean {
  const modulo = permissao.split(".")[0] ?? "";
  return (MODULOS_OCULTOS as readonly string[]).includes(modulo);
}

/**
 * Permissões que nenhum papel pode conceder, em nenhuma circunstância.
 *
 * `financeiro.pessoal.*` é derivada de `organizacoes.proprietario_id`, e não da
 * tabela de papéis. Sem esta lista, bastaria um administrador distraído marcar
 * uma caixa para abrir o financeiro pessoal do dono para a equipe inteira.
 */
export const NAO_CONCEDIVEIS = ["financeiro.pessoal."] as const;

export function concedivel(permissao: string): boolean {
  return !NAO_CONCEDIVEIS.some((prefixo) => permissao.startsWith(prefixo));
}

/** Papéis criados em toda organização nova. `*` = tudo que for concedível. */
export const PAPEIS_PADRAO: ReadonlyArray<{
  chave: string;
  nome: string;
  descricao: string;
  permissoes: readonly string[];
}> = [
  {
    chave: "proprietario",
    nome: "Proprietário",
    descricao:
      "Acesso total. O financeiro pessoal vem de organizacoes.proprietario_id, não deste papel.",
    permissoes: ["*"],
  },
  {
    chave: "administrador",
    nome: "Administrador",
    descricao: "Acesso total à operação da empresa, sem o financeiro pessoal.",
    permissoes: ["*"],
  },
  {
    chave: "gestor",
    nome: "Gestor",
    descricao: "Operação completa; financeiro apenas em leitura.",
    permissoes: [
      "vendas.*",
      "clientes.*",
      "operacional.*",
      "agenda.*",
      "trafego.*",
      "arquivos.*",
      "whatsapp.*",
      "wiki.*",
      "mural.*",
      "financeiro.painel.ver",
      "financeiro.lancamento.ver",
      "financeiro.fluxo.ver",
      "credenciais.credencial.ver",
      "config.usuario.ver",
    ],
  },
  {
    chave: "comercial",
    nome: "Comercial",
    descricao: "Vendas, WhatsApp e agenda.",
    permissoes: [
      "vendas.*",
      "clientes.cliente.ver",
      "clientes.contato.ver",
      "clientes.contato.editar",
      "agenda.evento.ver",
      "agenda.evento.editar",
      "whatsapp.conversa.ver",
      "whatsapp.conversa.responder",
      "arquivos.arquivo.ver",
      "arquivos.arquivo.enviar",
      "wiki.pagina.ver",
      "mural.aviso.ver",
    ],
  },
  {
    chave: "trafego",
    nome: "Gestor de Tráfego",
    descricao: "Tráfego, estratégia e demandas dos clientes atribuídos.",
    permissoes: [
      "trafego.*",
      "clientes.cliente.ver",
      "clientes.estrategia.ver",
      "clientes.estrategia.editar",
      "clientes.pesquisa.*",
      "operacional.demanda.ver",
      "operacional.demanda.criar",
      "operacional.demanda.editar",
      "operacional.tempo.registrar",
      "agenda.evento.ver",
      "arquivos.arquivo.ver",
      "arquivos.arquivo.enviar",
      "credenciais.credencial.ver",
      "credenciais.credencial.revelar",
      "wiki.pagina.ver",
      "mural.aviso.ver",
    ],
  },
  {
    chave: "criacao",
    nome: "Criação",
    descricao:
      "Social media, design, edição e filmmaker. Demandas próprias, arquivos e aprovações.",
    permissoes: [
      "operacional.demanda.ver",
      "operacional.demanda.criar",
      "operacional.demanda.editar",
      "operacional.tempo.registrar",
      "operacional.aprovacao.ver",
      "operacional.gravacao.ver",
      "operacional.gravacao.editar",
      "clientes.cliente.ver",
      "clientes.estrategia.ver",
      "agenda.evento.ver",
      "agenda.evento.editar",
      "arquivos.arquivo.ver",
      "arquivos.arquivo.enviar",
      "wiki.pagina.ver",
      "mural.aviso.ver",
    ],
  },
  {
    chave: "financeiro",
    nome: "Financeiro",
    descricao: "Financeiro empresarial. Nunca o pessoal.",
    permissoes: [
      "financeiro.painel.ver",
      "financeiro.lancamento.*",
      "financeiro.fluxo.ver",
      "financeiro.relatorio.exportar",
      "clientes.cliente.ver",
      "clientes.contrato.ver",
      "clientes.contrato.editar",
      "arquivos.arquivo.ver",
      "arquivos.arquivo.enviar",
      "wiki.pagina.ver",
      "mural.aviso.ver",
    ],
  },
  {
    chave: "colaborador",
    nome: "Colaborador",
    descricao: "Apenas as próprias demandas.",
    permissoes: [
      "operacional.demanda.ver",
      "operacional.demanda.editar",
      "operacional.tempo.registrar",
      "agenda.evento.ver",
      "arquivos.arquivo.ver",
      "wiki.pagina.ver",
      "mural.aviso.ver",
    ],
  },
];

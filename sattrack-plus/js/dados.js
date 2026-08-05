/* ==================================================================
   Dados — modelo, persistência e regras do controle de sinistros.

   Tudo fica no navegador (localStorage), sob uma única chave. É o que
   garante que nada se perde ao atualizar a página: toda escrita passa
   por salvar().
   ================================================================== */
const Dados = (() => {

  const CHAVE = "sattrack.plus.sinistros.v1";

  /* ---------------------------------------------------------------- */
  /* Listas fixas do domínio                                           */
  /* ---------------------------------------------------------------- */
  const STATUS = [
    { id: "entrou", nome: "Acabou de entrar", cor: "azul", descricao: "Registrados agora, aguardando análise ou direcionamento." },
    { id: "urgente", nome: "Caso urgente", cor: "vermelha", descricao: "Graves ou que precisam de atendimento imediato." },
    { id: "resolvendo", nome: "Resolvendo", cor: "amarela", descricao: "Em acompanhamento pela equipe responsável." },
    { id: "concluido", nome: "Caso concluído", cor: "verde", descricao: "Finalizados, resolvidos ou encerrados." },
  ];

  const PRIORIDADES = [
    { id: "normal", nome: "Normal", cor: "normal" },
    { id: "atencao", nome: "Atenção", cor: "atencao" },
    { id: "urgente", nome: "Urgente", cor: "urgente" },
  ];

  const TIPOS = [
    "Colisão", "Roubo", "Furto", "Perda total", "Alagamento", "Incêndio",
    "Capotamento", "Danos a terceiros", "Assistência emergencial", "Outro",
  ];

  const CLASSIFICACOES = [
    "Em análise", "Dano parcial", "Perda total", "Danos a terceiros",
    "Assistência", "Sem cobertura", "Recuperado", "Indenização",
  ];

  const TIPOS_ACOMPANHAMENTO = [
    "Contato realizado com o associado",
    "Documentação solicitada",
    "Documentação recebida",
    "Veículo encaminhado para oficina",
    "Guincho solicitado",
    "Vistoria solicitada",
    "Vistoria realizada",
    "Orçamento recebido",
    "Análise em andamento",
    "Pagamento autorizado",
    "Reparo iniciado",
    "Reparo concluído",
    "Veículo entregue",
    "Caso encerrado",
    "Observação interna",
  ];

  const PERFIS = [
    { id: "admin", nome: "Administrador" },
    { id: "atendente", nome: "Atendente" },
  ];

  const CONFIG_PADRAO = {
    empresa: "SatTrack Proteção Veicular",
    setor: "Setor Plus",
    horasUrgenteSemAtualizacao: 24,
    horasSemAtualizacao: 48,
    diasParado: 7,
    diasSemContato: 5,
    limiteAnexoMB: 2,
  };

  const nomeStatus = (id) => (STATUS.find((s) => s.id === id) || {}).nome || id || "—";
  const nomePrioridade = (id) => (PRIORIDADES.find((p) => p.id === id) || {}).nome || id || "—";
  const corStatus = (id) => (STATUS.find((s) => s.id === id) || {}).cor || "cinza";
  const nomePerfil = (id) => (PERFIS.find((p) => p.id === id) || {}).nome || id;

  /* ---------------------------------------------------------------- */
  /* Estado em memória                                                 */
  /* ---------------------------------------------------------------- */
  let estado = {
    versao: 1,
    sinistros: [],
    usuarios: [],
    config: Object.assign({}, CONFIG_PADRAO),
    sessao: null,
    proximoNumero: 1,
  };

  const ouvintes = [];
  const aoMudar = (fn) => ouvintes.push(fn);
  const notificar = () => ouvintes.forEach((fn) => fn());

  /** Alguns navegadores bloqueiam o armazenamento (aba anônima, arquivo
      aberto direto do disco com restrição, política do sistema). Nesse caso
      o sistema continua funcionando na memória e avisa uma única vez. */
  let semArmazenamento = false;
  const armazenamentoIndisponivel = () => semArmazenamento;

  function ehCotaCheia(e) {
    return e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      if (ehCotaCheia(e)) {
        // Cota estourada normalmente é anexo grande demais.
        throw new Error(
          "Não foi possível salvar: o armazenamento do navegador está cheio. " +
          "Remova anexos antigos e tente de novo."
        );
      }
      // Armazenamento indisponível: nada de travar o trabalho da equipe.
      console.error("Armazenamento indisponível; trabalhando apenas na memória.", e);
      if (!semArmazenamento) {
        semArmazenamento = true;
        setTimeout(() => {
          if (typeof UI !== "undefined") {
            UI.erro("Este navegador está bloqueando o armazenamento local. O trabalho continua, mas os dados se perdem ao fechar a página. Use um servidor local ou saia da janela anônima.");
          }
        }, 400);
      }
      return false;
    }
  }

  function carregar() {
    let bruto = null;
    try { bruto = localStorage.getItem(CHAVE); } catch (e) { bruto = null; }

    if (bruto) {
      try {
        const lido = JSON.parse(bruto);
        estado = Object.assign(estado, lido);
        estado.config = Object.assign({}, CONFIG_PADRAO, lido.config || {});
        estado.sinistros = (lido.sinistros || []).map(normalizarSinistro);
        if (!estado.usuarios || !estado.usuarios.length) estado.usuarios = usuariosPadrao();
        return;
      } catch (e) {
        console.error("Base local corrompida; recriando com dados de demonstração.", e);
      }
    }

    estado.usuarios = usuariosPadrao();
    estado.sinistros = semente();
    estado.proximoNumero = estado.sinistros.length + 1;
    salvar();
  }

  /** Garante os campos novos em registros gravados por versões anteriores. */
  function normalizarSinistro(s) {
    return Object.assign({
      acompanhamentos: [], historico: [], anexos: [], contatos: [],
      documentosPendentes: false, vitimas: 0, veiculosEnvolvidos: 1,
    }, s);
  }

  /* ---------------------------------------------------------------- */
  /* Usuários e sessão                                                 */
  /* ---------------------------------------------------------------- */
  function usuariosPadrao() {
    return [
      { id: "u_admin", usuario: "admin", senha: "admin123", nome: "Diogo Gomes", perfil: "admin", ativo: true, criadoEm: Util.agoraISO() },
      { id: "u_fernanda", usuario: "fernanda", senha: "1234", nome: "Fernanda Alves", perfil: "atendente", ativo: true, criadoEm: Util.agoraISO() },
      { id: "u_carla", usuario: "carla", senha: "1234", nome: "Carla Menezes", perfil: "atendente", ativo: true, criadoEm: Util.agoraISO() },
      { id: "u_rafael", usuario: "rafael", senha: "1234", nome: "Rafael Souza", perfil: "atendente", ativo: true, criadoEm: Util.agoraISO() },
    ];
  }

  function entrar(usuario, senha) {
    const achado = estado.usuarios.find(
      (u) => Util.normalizar(u.usuario) === Util.normalizar(usuario) && u.senha === senha
    );
    if (!achado) return { ok: false, erro: "Usuário ou senha inválidos." };
    if (!achado.ativo) return { ok: false, erro: "Usuário desativado. Procure um administrador." };
    estado.sessao = { usuarioId: achado.id, desde: Util.agoraISO() };
    salvar();
    return { ok: true, usuario: achado };
  }

  function sair() {
    estado.sessao = null;
    salvar();
  }

  function usuarioAtual() {
    if (!estado.sessao) return null;
    return estado.usuarios.find((u) => u.id === estado.sessao.usuarioId) || null;
  }

  const ehAdmin = () => {
    const u = usuarioAtual();
    return !!u && u.perfil === "admin";
  };

  function listaUsuarios() { return estado.usuarios.slice(); }

  function salvarUsuario(dados) {
    if (!ehAdmin()) throw new Error("Somente administradores podem gerenciar usuários.");
    const login = Util.normalizar(dados.usuario);
    if (!login) throw new Error("Informe o nome de acesso.");
    if (!String(dados.nome || "").trim()) throw new Error("Informe o nome completo.");

    const repetido = estado.usuarios.some((u) => Util.normalizar(u.usuario) === login && u.id !== dados.id);
    if (repetido) throw new Error("Já existe um usuário com esse nome de acesso.");

    if (dados.id) {
      const u = estado.usuarios.find((x) => x.id === dados.id);
      if (!u) throw new Error("Usuário não encontrado.");
      u.nome = dados.nome.trim();
      u.usuario = dados.usuario.trim();
      u.perfil = dados.perfil;
      u.ativo = !!dados.ativo;
      if (dados.senha) u.senha = dados.senha;
    } else {
      if (!dados.senha) throw new Error("Informe uma senha para o novo usuário.");
      estado.usuarios.push({
        id: Util.id("u"), usuario: dados.usuario.trim(), senha: dados.senha,
        nome: dados.nome.trim(), perfil: dados.perfil || "atendente",
        ativo: dados.ativo !== false, criadoEm: Util.agoraISO(),
      });
    }
    salvar();
    notificar();
  }

  function excluirUsuario(id) {
    if (!ehAdmin()) throw new Error("Somente administradores podem excluir usuários.");
    const atual = usuarioAtual();
    if (atual && atual.id === id) throw new Error("Você não pode excluir o próprio usuário.");
    estado.usuarios = estado.usuarios.filter((u) => u.id !== id);
    salvar();
    notificar();
  }

  /* ---------------------------------------------------------------- */
  /* Histórico automático                                              */
  /* ---------------------------------------------------------------- */
  function registrar(sin, acao, detalhe, de, para) {
    const u = usuarioAtual();
    sin.historico = sin.historico || [];
    sin.historico.push({
      id: Util.id("h"),
      criadoEm: Util.agoraISO(),
      usuario: u ? u.nome : "Sistema",
      acao,
      detalhe: detalhe || "",
      de: de || "",
      para: para || "",
    });
    sin.atualizadoEm = Util.agoraISO();
  }

  /* ---------------------------------------------------------------- */
  /* Sinistros — leitura                                               */
  /* ---------------------------------------------------------------- */
  const lista = () => estado.sinistros.slice();
  const obter = (id) => estado.sinistros.find((s) => s.id === id) || null;
  const porStatus = (status) => estado.sinistros.filter((s) => s.status === status);

  function proximoNumeroSinistro() {
    const ano = new Date().getFullYear();
    const usados = estado.sinistros
      .map((s) => parseInt(String(s.numero || "").split("-").pop(), 10))
      .filter((n) => !isNaN(n));
    const seq = (usados.length ? Math.max.apply(null, usados) : 0) + 1;
    return `SIN-${ano}-${String(seq).padStart(4, "0")}`;
  }

  function proximoProtocolo() {
    const ano = new Date().getFullYear();
    return `PLUS-${ano}-${String(estado.sinistros.length + 1).padStart(4, "0")}`;
  }

  /** Última movimentação de verdade: acompanhamento, contato ou abertura. */
  function ultimaAtualizacao(sin) {
    const datas = [sin.criadoEm];
    (sin.acompanhamentos || []).forEach((a) => datas.push(a.criadoEm));
    (sin.contatos || []).forEach((c) => datas.push(c.criadoEm));
    return datas.filter(Boolean).sort().pop();
  }

  function ultimoContatoAssociado(sin) {
    const datas = (sin.contatos || [])
      .filter((c) => c.tipo === "associado")
      .map((c) => c.criadoEm)
      .concat(
        (sin.acompanhamentos || [])
          .filter((a) => Util.normalizar(a.tipo).indexOf("contato realizado") === 0)
          .map((a) => a.criadoEm)
      );
    return datas.filter(Boolean).sort().pop() || null;
  }

  /* ---------------------------------------------------------------- */
  /* Validação                                                         */
  /* ---------------------------------------------------------------- */
  const OBRIGATORIOS = [
    ["associado", "Nome completo do associado"],
    ["whatsapp", "Número do WhatsApp"],
    ["placa", "Placa do veículo"],
    ["numero", "Número do sinistro"],
    ["dataIncidente", "Data do incidente"],
    ["horaIncidente", "Horário do incidente"],
    ["atendente", "Nome da atendente"],
    ["responsavel", "Responsável pelo caso"],
  ];

  function validar(dados) {
    const erros = {};
    OBRIGATORIOS.forEach(([campo, rotulo]) => {
      if (!String(dados[campo] || "").trim()) erros[campo] = `${rotulo} é obrigatório.`;
    });
    if (dados.whatsapp && Util.soNumeros(dados.whatsapp).length < 10) {
      erros.whatsapp = "Informe DDD e número (10 ou 11 dígitos).";
    }
    if (dados.placa && Util.soNumeros(dados.placa).length + dados.placa.replace(/[^A-Za-z]/g, "").length < 7) {
      erros.placa = "Placa incompleta.";
    }
    return erros;
  }

  /* ---------------------------------------------------------------- */
  /* Sinistros — escrita                                               */
  /* ---------------------------------------------------------------- */
  function limpar(dados) {
    return {
      // Registro
      dataAtendimento: dados.dataAtendimento || Util.dataLocal(),
      horaAtendimento: dados.horaAtendimento || Util.horaLocal(),
      atendente: String(dados.atendente || "").trim(),
      responsavel: String(dados.responsavel || "").trim(),
      status: dados.status || "entrou",
      prioridade: dados.prioridade || "normal",
      // Associado
      associado: String(dados.associado || "").trim(),
      whatsapp: Util.mascaraTelefone(dados.whatsapp),
      documento: String(dados.documento || "").trim(),
      contrato: String(dados.contrato || "").trim(),
      // Incidente
      dataIncidente: dados.dataIncidente || "",
      horaIncidente: dados.horaIncidente || "",
      local: String(dados.local || "").trim(),
      tipo: dados.tipo || "Colisão",
      descricao: String(dados.descricao || "").trim(),
      vitimas: Util.inteiro(dados.vitimas, 0),
      veiculosEnvolvidos: Util.inteiro(dados.veiculosEnvolvidos, 0),
      temBO: !!dados.temBO,
      numeroBO: String(dados.numeroBO || "").trim(),
      guincho: !!dados.guincho,
      atendimentoMedico: !!dados.atendimentoMedico,
      // Veículo
      placa: Util.mascaraPlaca(dados.placa),
      marca: String(dados.marca || "").trim(),
      modelo: String(dados.modelo || "").trim(),
      ano: String(dados.ano || "").trim(),
      cor: String(dados.cor || "").trim(),
      // Sinistro
      numero: String(dados.numero || "").trim().toUpperCase(),
      protocolo: String(dados.protocolo || "").trim().toUpperCase(),
      classificacao: dados.classificacao || "Em análise",
      prestador: String(dados.prestador || "").trim(),
      observacoes: String(dados.observacoes || "").trim(),
      // Prazos
      proximaAcao: String(dados.proximaAcao || "").trim(),
      prazoRetorno: dados.prazoRetorno || "",
      documentosPendentes: !!dados.documentosPendentes,
    };
  }

  function criar(dadosBrutos) {
    const dados = limpar(dadosBrutos);
    const erros = validar(dados);
    if (Object.keys(erros).length) return { ok: false, erros };

    if (estado.sinistros.some((s) => Util.normalizar(s.numero) === Util.normalizar(dados.numero))) {
      return { ok: false, erros: { numero: "Já existe um sinistro com esse número." } };
    }

    const sin = Object.assign({
      id: Util.id("sin"),
      criadoEm: Util.agoraISO(),
      atualizadoEm: Util.agoraISO(),
      concluidoEm: dados.status === "concluido" ? Util.agoraISO() : null,
      acompanhamentos: [], historico: [], anexos: [], contatos: [],
    }, dados);

    registrar(sin, "Sinistro cadastrado", `Aberto em ${nomeStatus(sin.status)} com prioridade ${nomePrioridade(sin.prioridade)}.`, "", nomeStatus(sin.status));
    estado.sinistros.unshift(sin);
    salvar();
    notificar();
    return { ok: true, sinistro: sin };
  }

  /** Atualiza e registra no histórico cada campo relevante que mudou. */
  function atualizar(id, dadosBrutos) {
    const sin = obter(id);
    if (!sin) return { ok: false, erros: { geral: "Sinistro não encontrado." } };

    const dados = limpar(dadosBrutos);
    const erros = validar(dados);
    if (Object.keys(erros).length) return { ok: false, erros };

    const repetido = estado.sinistros.some(
      (s) => s.id !== id && Util.normalizar(s.numero) === Util.normalizar(dados.numero)
    );
    if (repetido) return { ok: false, erros: { numero: "Já existe um sinistro com esse número." } };

    const antes = Object.assign({}, sin);
    Object.assign(sin, dados);

    if (antes.status !== sin.status) {
      registrar(sin, "Status alterado", `Sinistro movido de “${nomeStatus(antes.status)}” para “${nomeStatus(sin.status)}”.`, nomeStatus(antes.status), nomeStatus(sin.status));
      sin.concluidoEm = sin.status === "concluido" ? Util.agoraISO() : null;
    }
    if (antes.prioridade !== sin.prioridade) {
      registrar(sin, "Prioridade alterada", `Prioridade alterada de ${nomePrioridade(antes.prioridade)} para ${nomePrioridade(sin.prioridade)}.`, nomePrioridade(antes.prioridade), nomePrioridade(sin.prioridade));
    }
    if (antes.responsavel !== sin.responsavel) {
      registrar(sin, "Responsável alterado", `Responsável alterado de ${Util.ou(antes.responsavel, "sem responsável")} para ${Util.ou(sin.responsavel, "sem responsável")}.`, antes.responsavel, sin.responsavel);
    }
    if (antes.atendente !== sin.atendente) {
      registrar(sin, "Atendente alterada", `Atendimento alterado de ${Util.ou(antes.atendente, "não informada")} para ${Util.ou(sin.atendente, "não informada")}.`, antes.atendente, sin.atendente);
    }
    if (antes.observacoes !== sin.observacoes && sin.observacoes) {
      registrar(sin, "Observação adicionada", "Observações internas atualizadas.");
    }
    if (antes.prazoRetorno !== sin.prazoRetorno) {
      registrar(sin, "Prazo alterado", `Prazo de retorno definido para ${Util.ou(Util.fmtData(sin.prazoRetorno), "sem prazo")}.`, Util.fmtData(antes.prazoRetorno), Util.fmtData(sin.prazoRetorno));
    }
    if (antes.documentosPendentes !== sin.documentosPendentes) {
      registrar(sin, "Documentação", sin.documentosPendentes ? "Marcado como aguardando documentos." : "Documentação regularizada.");
    }

    registrar(sin, "Cadastro editado", "Dados do sinistro atualizados.");
    salvar();
    notificar();
    return { ok: true, sinistro: sin };
  }

  /** Movimentação entre colunas — sempre salva e sempre registra. */
  function mover(id, novoStatus) {
    const sin = obter(id);
    if (!sin || sin.status === novoStatus) return null;

    const de = sin.status;
    sin.status = novoStatus;
    if (novoStatus === "concluido") {
      sin.concluidoEm = Util.agoraISO();
    } else if (de === "concluido") {
      sin.concluidoEm = null;
      registrar(sin, "Caso reaberto", `Sinistro reaberto e movido para “${nomeStatus(novoStatus)}”.`, nomeStatus(de), nomeStatus(novoStatus));
      salvar();
      notificar();
      return sin;
    }
    if (novoStatus === "urgente" && sin.prioridade !== "urgente") {
      const antiga = sin.prioridade;
      sin.prioridade = "urgente";
      registrar(sin, "Prioridade alterada", `Prioridade alterada de ${nomePrioridade(antiga)} para Urgente ao entrar em “Caso urgente”.`, nomePrioridade(antiga), "Urgente");
    }
    registrar(sin, "Movimentação", `Sinistro movido de “${nomeStatus(de)}” para “${nomeStatus(novoStatus)}”.`, nomeStatus(de), nomeStatus(novoStatus));
    salvar();
    notificar();
    return sin;
  }

  function alterarPrioridade(id, prioridade) {
    const sin = obter(id);
    if (!sin || sin.prioridade === prioridade) return null;
    const de = sin.prioridade;
    sin.prioridade = prioridade;
    registrar(sin, "Prioridade alterada", `Prioridade alterada de ${nomePrioridade(de)} para ${nomePrioridade(prioridade)}.`, nomePrioridade(de), nomePrioridade(prioridade));
    salvar();
    notificar();
    return sin;
  }

  function alterarPessoa(id, campo, valor) {
    const sin = obter(id);
    if (!sin) return null;
    const de = sin[campo] || "";
    if (de === valor) return sin;
    sin[campo] = valor;
    registrar(
      sin,
      campo === "responsavel" ? "Responsável alterado" : "Atendente alterada",
      `${campo === "responsavel" ? "Responsável" : "Atendimento"} alterado de ${Util.ou(de, "não informado")} para ${Util.ou(valor, "não informado")}.`,
      de, valor
    );
    salvar();
    notificar();
    return sin;
  }

  /** Só administradores excluem — e casos concluídos ficam preservados. */
  function excluir(id) {
    if (!ehAdmin()) throw new Error("Somente administradores podem excluir registros.");
    const sin = obter(id);
    if (!sin) throw new Error("Sinistro não encontrado.");
    estado.sinistros = estado.sinistros.filter((s) => s.id !== id);
    salvar();
    notificar();
    return sin;
  }

  /* ---------------------------------------------------------------- */
  /* Acompanhamento, contatos e anexos                                 */
  /* ---------------------------------------------------------------- */
  function adicionarAcompanhamento(id, dados) {
    const sin = obter(id);
    if (!sin) throw new Error("Sinistro não encontrado.");
    if (!String(dados.descricao || "").trim()) throw new Error("Descreva a atualização.");

    const u = usuarioAtual();
    const registro = {
      id: Util.id("acomp"),
      criadoEm: Util.agoraISO(),
      data: dados.data || Util.dataLocal(),
      hora: dados.hora || Util.horaLocal(),
      autor: String(dados.autor || (u ? u.nome : "")).trim() || "Equipe Plus",
      tipo: dados.tipo || "Análise em andamento",
      descricao: String(dados.descricao).trim(),
      proximaAcao: String(dados.proximaAcao || "").trim(),
      prazoRetorno: dados.prazoRetorno || "",
    };
    sin.acompanhamentos = sin.acompanhamentos || [];
    sin.acompanhamentos.push(registro);

    // A próxima ação e o prazo do caso acompanham a última atualização.
    if (registro.proximaAcao) sin.proximaAcao = registro.proximaAcao;
    if (registro.prazoRetorno) sin.prazoRetorno = registro.prazoRetorno;

    registrar(sin, "Atualização registrada", `${registro.tipo} — ${registro.descricao}`);
    salvar();
    notificar();
    return registro;
  }

  function removerAcompanhamento(id, acompId) {
    const sin = obter(id);
    if (!sin) return;
    sin.acompanhamentos = (sin.acompanhamentos || []).filter((a) => a.id !== acompId);
    registrar(sin, "Atualização removida", "Uma atualização do acompanhamento foi removida.");
    salvar();
    notificar();
  }

  function adicionarObservacao(id, texto) {
    const sin = obter(id);
    if (!sin) throw new Error("Sinistro não encontrado.");
    const limpo = String(texto || "").trim();
    if (!limpo) throw new Error("Escreva a observação.");
    const u = usuarioAtual();
    const carimbo = `[${Util.fmtDataHora(Util.agoraISO())} — ${u ? u.nome : "Equipe"}]`;
    sin.observacoes = (sin.observacoes ? sin.observacoes + "\n\n" : "") + `${carimbo} ${limpo}`;
    registrar(sin, "Observação adicionada", limpo);
    salvar();
    notificar();
    return sin;
  }

  function adicionarContato(id, dados) {
    const sin = obter(id);
    if (!sin) throw new Error("Sinistro não encontrado.");
    if (!String(dados.resumo || "").trim()) throw new Error("Descreva o contato realizado.");
    const u = usuarioAtual();
    const contato = {
      id: Util.id("ct"),
      criadoEm: Util.agoraISO(),
      tipo: dados.tipo === "prestador" ? "prestador" : "associado",
      canal: dados.canal || "WhatsApp",
      quem: String(dados.quem || "").trim(),
      resumo: String(dados.resumo).trim(),
      autor: u ? u.nome : "Equipe Plus",
    };
    sin.contatos = sin.contatos || [];
    sin.contatos.push(contato);
    registrar(
      sin, "Contato registrado",
      `Contato com ${contato.tipo === "associado" ? "o associado" : "oficina/prestador"}${contato.quem ? ` (${contato.quem})` : ""} por ${contato.canal}: ${contato.resumo}`
    );
    salvar();
    notificar();
    return contato;
  }

  function adicionarAnexo(id, arquivo) {
    const sin = obter(id);
    if (!sin) return Promise.reject(new Error("Sinistro não encontrado."));

    const limite = (estado.config.limiteAnexoMB || 2) * 1024 * 1024;
    if (arquivo.size > limite) {
      return Promise.reject(new Error(
        `“${arquivo.name}” tem ${Util.tamanhoArquivo(arquivo.size)}. O limite por arquivo é ${estado.config.limiteAnexoMB} MB.`
      ));
    }

    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      leitor.onload = () => {
        const u = usuarioAtual();
        const anexo = {
          id: Util.id("anx"),
          nome: arquivo.name,
          tipo: arquivo.type || "application/octet-stream",
          tamanho: arquivo.size,
          conteudo: leitor.result,
          enviadoPor: u ? u.nome : "Equipe Plus",
          criadoEm: Util.agoraISO(),
        };
        sin.anexos = sin.anexos || [];
        sin.anexos.push(anexo);
        registrar(sin, "Documento anexado", `Arquivo “${anexo.nome}” (${Util.tamanhoArquivo(anexo.tamanho)}).`);
        try {
          salvar();
        } catch (e) {
          // Desfaz para não deixar o estado em memória diferente do salvo.
          sin.anexos = sin.anexos.filter((a) => a.id !== anexo.id);
          sin.historico.pop();
          reject(e);
          return;
        }
        notificar();
        resolve(anexo);
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  function removerAnexo(id, anexoId) {
    const sin = obter(id);
    if (!sin) return;
    const anexo = (sin.anexos || []).find((a) => a.id === anexoId);
    sin.anexos = (sin.anexos || []).filter((a) => a.id !== anexoId);
    registrar(sin, "Documento removido", anexo ? `Arquivo “${anexo.nome}” removido.` : "Anexo removido.");
    salvar();
    notificar();
  }

  /* ---------------------------------------------------------------- */
  /* Alertas e prazos                                                  */
  /* ---------------------------------------------------------------- */
  function prazoVencido(sin) {
    if (sin.status === "concluido" || !sin.prazoRetorno) return false;
    const limite = Util.juntarDataHora(sin.prazoRetorno, "23:59");
    return !!limite && limite.getTime() < Date.now();
  }

  function alertas(sin) {
    const c = estado.config;
    const saida = [];
    if (sin.status === "concluido") return saida;

    const horas = Util.horasDesde(ultimaAtualizacao(sin));

    if ((sin.status === "urgente" || sin.prioridade === "urgente") && horas > c.horasUrgenteSemAtualizacao) {
      saida.push({ chave: "urgente-parado", nivel: "grave", texto: `Urgente sem atualização há ${Util.duracao(horas * 3600000)}` });
    }
    if (prazoVencido(sin)) {
      saida.push({ chave: "prazo", nivel: "grave", texto: `Prazo de retorno vencido em ${Util.fmtData(sin.prazoRetorno)}` });
    }
    if (sin.documentosPendentes) {
      saida.push({ chave: "documentos", nivel: "aviso", texto: "Documentos pendentes" });
    }
    if (horas > c.diasParado * 24) {
      saida.push({ chave: "parado", nivel: "aviso", texto: `Parado há ${Util.duracao(horas * 3600000)}` });
    } else if (horas > c.horasSemAtualizacao) {
      saida.push({ chave: "sem-atualizacao", nivel: "aviso", texto: `Sem atualização há ${Util.duracao(horas * 3600000)}` });
    }
    if (!String(sin.responsavel || "").trim()) {
      saida.push({ chave: "sem-responsavel", nivel: "aviso", texto: "Caso sem responsável" });
    }
    const contato = ultimoContatoAssociado(sin);
    if (!contato) {
      saida.push({ chave: "sem-contato", nivel: "aviso", texto: "Sem contato registrado com o associado" });
    } else if (Util.horasDesde(contato) > c.diasSemContato * 24) {
      saida.push({ chave: "sem-contato", nivel: "aviso", texto: `Sem contato com o associado há ${Util.duracao(Util.horasDesde(contato) * 3600000)}` });
    }
    return saida;
  }

  const temAlerta = (sin, chave) => alertas(sin).some((a) => a.chave === chave);
  const semAtualizacao = (sin) =>
    sin.status !== "concluido" && Util.horasDesde(ultimaAtualizacao(sin)) > estado.config.horasSemAtualizacao;

  /* ---------------------------------------------------------------- */
  /* Indicadores                                                       */
  /* ---------------------------------------------------------------- */
  function indicadores() {
    const todos = estado.sinistros;
    const abertos = todos.filter((s) => s.status !== "concluido");
    const concluidos = todos.filter((s) => s.status === "concluido");

    const tempos = concluidos
      .filter((s) => s.concluidoEm && s.criadoEm)
      .map((s) => new Date(s.concluidoEm) - new Date(s.criadoEm))
      .filter((ms) => ms >= 0);
    const media = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

    return {
      total: todos.length,
      abertos: abertos.length,
      entrou: todos.filter((s) => s.status === "entrou").length,
      urgentes: todos.filter((s) => s.status === "urgente" || (s.prioridade === "urgente" && s.status !== "concluido")).length,
      resolvendo: todos.filter((s) => s.status === "resolvendo").length,
      concluidos: concluidos.length,
      concluidosHoje: concluidos.filter((s) => Util.mesmoDia(s.concluidoEm, new Date())).length,
      comVitimas: todos.filter((s) => Number(s.vitimas) > 0 && s.status !== "concluido").length,
      prazoVencido: abertos.filter(prazoVencido).length,
      semAtualizacao: abertos.filter(semAtualizacao).length,
      documentosPendentes: abertos.filter((s) => s.documentosPendentes).length,
      semResponsavel: abertos.filter((s) => !String(s.responsavel || "").trim()).length,
      tempoMedio: media ? Util.duracao(media) : "—",
      tempoMedioMs: media,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Busca e filtros                                                   */
  /* ---------------------------------------------------------------- */
  const CAMPOS_BUSCA = ["associado", "numero", "protocolo", "documento", "whatsapp", "placa", "modelo", "marca", "atendente", "responsavel", "local", "tipo"];

  function combina(sin, termo) {
    if (!termo) return true;
    const alvo = Util.normalizar(CAMPOS_BUSCA.map((c) => sin[c]).join(" ") + " " + Util.soNumeros(sin.whatsapp) + " " + Util.soNumeros(sin.documento));
    return Util.normalizar(termo).split(/\s+/).every((p) => alvo.indexOf(p) >= 0);
  }

  function filtrar(termo, filtros) {
    const f = filtros || {};
    return estado.sinistros.filter((s) => {
      if (!combina(s, termo)) return false;
      if (f.status && s.status !== f.status) return false;
      if (f.prioridade && s.prioridade !== f.prioridade) return false;
      if (f.tipo && s.tipo !== f.tipo) return false;
      if (f.atendente && s.atendente !== f.atendente) return false;
      if (f.responsavel && s.responsavel !== f.responsavel) return false;
      if (f.incidenteDe && (!s.dataIncidente || s.dataIncidente < f.incidenteDe)) return false;
      if (f.incidenteAte && (!s.dataIncidente || s.dataIncidente > f.incidenteAte)) return false;
      if (f.aberturaDe && Util.dataLocal(Util.paraData(s.criadoEm)) < f.aberturaDe) return false;
      if (f.aberturaAte && Util.dataLocal(Util.paraData(s.criadoEm)) > f.aberturaAte) return false;
      if (f.comVitimas && !(Number(s.vitimas) > 0)) return false;
      if (f.urgentes && !(s.prioridade === "urgente" || s.status === "urgente")) return false;
      if (f.documentosPendentes && !s.documentosPendentes) return false;
      if (f.prazoVencido && !prazoVencido(s)) return false;
      if (f.concluidos && s.status !== "concluido") return false;
      if (f.semAtualizacao && !semAtualizacao(s)) return false;
      if (f.semResponsavel && String(s.responsavel || "").trim()) return false;
      return true;
    });
  }

  /** Nomes já usados em atendimento/responsabilidade + usuários cadastrados. */
  function pessoas() {
    const nomes = new Set(estado.usuarios.filter((u) => u.ativo).map((u) => u.nome));
    estado.sinistros.forEach((s) => {
      if (s.atendente) nomes.add(s.atendente);
      if (s.responsavel) nomes.add(s.responsavel);
    });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function historicoGlobal(limite) {
    const linhas = [];
    estado.sinistros.forEach((s) => {
      (s.historico || []).forEach((h) => linhas.push(Object.assign({ sinistroId: s.id, numero: s.numero, associado: s.associado }, h)));
    });
    linhas.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
    return limite ? linhas.slice(0, limite) : linhas;
  }

  /* ---------------------------------------------------------------- */
  /* Configurações e backup                                            */
  /* ---------------------------------------------------------------- */
  const config = () => Object.assign({}, estado.config);

  function salvarConfig(nova) {
    estado.config = Object.assign({}, estado.config, nova);
    salvar();
    notificar();
  }

  function exportarBackup() {
    return JSON.stringify({
      versao: estado.versao, exportadoEm: Util.agoraISO(),
      sinistros: estado.sinistros, usuarios: estado.usuarios, config: estado.config,
    }, null, 2);
  }

  function importarBackup(texto) {
    const lido = JSON.parse(texto);
    if (!lido || !Array.isArray(lido.sinistros)) throw new Error("Arquivo de backup inválido.");
    estado.sinistros = lido.sinistros.map(normalizarSinistro);
    if (Array.isArray(lido.usuarios) && lido.usuarios.length) estado.usuarios = lido.usuarios;
    if (lido.config) estado.config = Object.assign({}, CONFIG_PADRAO, lido.config);
    salvar();
    notificar();
  }

  function restaurarDemonstracao() {
    if (!ehAdmin()) throw new Error("Somente administradores podem recriar a base de demonstração.");
    estado.sinistros = semente();
    salvar();
    notificar();
  }

  /* ---------------------------------------------------------------- */
  /* Dados de demonstração                                             */
  /* ---------------------------------------------------------------- */
  const menos = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
  const menosData = (dias) => Util.dataLocal(new Date(Date.now() - dias * 86400000));
  const maisData = (dias) => Util.dataLocal(new Date(Date.now() + dias * 86400000));

  function hist(quando, usuario, acao, detalhe, de, para) {
    return { id: Util.id("h"), criadoEm: quando, usuario, acao, detalhe, de: de || "", para: para || "" };
  }

  function semente() {
    const ano = new Date().getFullYear();

    const s1 = {
      id: Util.id("sin"), criadoEm: menos(0.6), atualizadoEm: menos(0.6), concluidoEm: null,
      dataAtendimento: Util.dataLocal(), horaAtendimento: Util.horaLocal(new Date(Date.now() - 2160000)),
      atendente: "Fernanda Alves", responsavel: "Rafael Souza", status: "entrou", prioridade: "normal",
      associado: "Marcos Vinícius Pereira", whatsapp: "(11) 98842-3310", documento: "324.887.190-45", contrato: "PLUS-2291",
      dataIncidente: Util.dataLocal(), horaIncidente: Util.horaLocal(new Date(Date.now() - 5400000)),
      local: "Av. Marginal Tietê, altura do nº 4.500 — São Paulo/SP",
      tipo: "Colisão", descricao: "Colisão traseira em congestionamento. Associado relata dano no para-choque e na tampa do porta-malas. Sem feridos.",
      vitimas: 0, veiculosEnvolvidos: 2, temBO: false, numeroBO: "", guincho: false, atendimentoMedico: false,
      placa: "RQP7D42", marca: "Chevrolet", modelo: "Onix 1.0 LT", ano: "2021", cor: "Prata",
      numero: `SIN-${ano}-0001`, protocolo: `PLUS-${ano}-0001`, classificacao: "Em análise",
      prestador: "", observacoes: "Associado enviará fotos pelo WhatsApp ainda hoje.",
      proximaAcao: "Analisar fotos e direcionar para vistoria", prazoRetorno: maisData(1), documentosPendentes: false,
      acompanhamentos: [], contatos: [], anexos: [],
      historico: [hist(menos(0.6), "Fernanda Alves", "Sinistro cadastrado", "Aberto em Acabou de entrar com prioridade Normal.", "", "Acabou de entrar")],
    };

    const s2 = {
      id: Util.id("sin"), criadoEm: menos(5), atualizadoEm: menos(1.2), concluidoEm: null,
      dataAtendimento: Util.dataLocal(), horaAtendimento: Util.horaLocal(new Date(Date.now() - 18000000)),
      atendente: "Carla Menezes", responsavel: "Diogo Gomes", status: "urgente", prioridade: "urgente",
      associado: "Juliana Ramos de Lima", whatsapp: "(21) 99671-8820", documento: "108.552.447-09", contrato: "PLUS-1874",
      dataIncidente: Util.dataLocal(), horaIncidente: Util.horaLocal(new Date(Date.now() - 19800000)),
      local: "Rodovia BR-101, km 312 — Campos dos Goytacazes/RJ",
      tipo: "Capotamento", descricao: "Veículo capotou após desvio de obstáculo na pista. Dois ocupantes levados ao hospital regional. Veículo removido por guincho e permanece no pátio credenciado.",
      vitimas: 2, veiculosEnvolvidos: 1, temBO: true, numeroBO: "BO-2026-448192", guincho: true, atendimentoMedico: true,
      placa: "LTA4F19", marca: "Hyundai", modelo: "HB20S 1.6 Vision", ano: "2019", cor: "Branco",
      numero: `SIN-${ano}-0002`, protocolo: `PLUS-${ano}-0002`, classificacao: "Dano parcial",
      prestador: "Guincho Litoral 24h / Pátio Credenciado Campos",
      observacoes: "Familiares acompanham as vítimas no Hospital Ferreira Machado. Prioridade máxima do Setor Plus.",
      proximaAcao: "Confirmar estado de saúde das vítimas e liberar vistoria no pátio", prazoRetorno: Util.dataLocal(), documentosPendentes: true,
      acompanhamentos: [
        { id: Util.id("acomp"), criadoEm: menos(4.6), data: Util.dataLocal(), hora: Util.horaLocal(new Date(Date.now() - 16560000)), autor: "Carla Menezes", tipo: "Guincho solicitado", descricao: "Guincho acionado no km 312 da BR-101. Previsão de chegada de 40 minutos.", proximaAcao: "Confirmar remoção do veículo", prazoRetorno: Util.dataLocal() },
        { id: Util.id("acomp"), criadoEm: menos(3.1), data: Util.dataLocal(), hora: Util.horaLocal(new Date(Date.now() - 11160000)), autor: "Carla Menezes", tipo: "Contato realizado com o associado", descricao: "Falado com a irmã da associada: as duas vítimas estão estáveis, em observação.", proximaAcao: "Retornar contato à tarde", prazoRetorno: Util.dataLocal() },
        { id: Util.id("acomp"), criadoEm: menos(1.2), data: Util.dataLocal(), hora: Util.horaLocal(new Date(Date.now() - 4320000)), autor: "Diogo Gomes", tipo: "Documentação solicitada", descricao: "Solicitados BO, CNH da condutora e laudo de atendimento médico.", proximaAcao: "Receber documentos e abrir vistoria", prazoRetorno: Util.dataLocal() },
      ],
      contatos: [
        { id: Util.id("ct"), criadoEm: menos(3.1), tipo: "associado", canal: "Telefone", quem: "Irmã da associada", resumo: "Confirmado atendimento hospitalar das duas vítimas.", autor: "Carla Menezes" },
        { id: Util.id("ct"), criadoEm: menos(4.5), tipo: "prestador", canal: "Telefone", quem: "Guincho Litoral 24h", resumo: "Remoção autorizada até o pátio credenciado de Campos.", autor: "Carla Menezes" },
      ],
      anexos: [],
      historico: [
        hist(menos(5), "Carla Menezes", "Sinistro cadastrado", "Aberto em Caso urgente com prioridade Urgente.", "", "Caso urgente"),
        hist(menos(4.6), "Carla Menezes", "Atualização registrada", "Guincho solicitado — Guincho acionado no km 312 da BR-101."),
        hist(menos(3.1), "Carla Menezes", "Contato registrado", "Contato com o associado (Irmã da associada) por Telefone: confirmado atendimento hospitalar."),
        hist(menos(1.2), "Diogo Gomes", "Atualização registrada", "Documentação solicitada — BO, CNH e laudo médico."),
      ],
    };

    const s3 = {
      id: Util.id("sin"), criadoEm: menos(74), atualizadoEm: menos(20), concluidoEm: null,
      dataAtendimento: menosData(3), horaAtendimento: "09:12",
      atendente: "Fernanda Alves", responsavel: "Carla Menezes", status: "resolvendo", prioridade: "atencao",
      associado: "André Luiz Barbosa", whatsapp: "(31) 98120-7744", documento: "770.219.336-11", contrato: "PLUS-2044",
      dataIncidente: menosData(3), horaIncidente: "07:40",
      local: "Rua Padre Eustáquio, 1.120 — Belo Horizonte/MG",
      tipo: "Colisão", descricao: "Colisão lateral em cruzamento com veículo de terceiro. Danos na porta dianteira esquerda e no retrovisor. Terceiro com danos leves no para-choque.",
      vitimas: 0, veiculosEnvolvidos: 2, temBO: true, numeroBO: "BO-2026-331004", guincho: false, atendimentoMedico: false,
      placa: "PXH2E88", marca: "Volkswagen", modelo: "Polo 1.0 TSI", ano: "2022", cor: "Cinza",
      numero: `SIN-${ano}-0003`, protocolo: `PLUS-${ano}-0003`, classificacao: "Dano parcial",
      prestador: "Oficina Credenciada Savassi",
      observacoes: "Terceiro será acionado pelo próprio seguro. Associado optou pela oficina credenciada.",
      proximaAcao: "Acompanhar aprovação do orçamento e início do reparo", prazoRetorno: maisData(2), documentosPendentes: false,
      acompanhamentos: [
        { id: Util.id("acomp"), criadoEm: menos(70), data: menosData(3), hora: "10:05", autor: "Fernanda Alves", tipo: "Documentação recebida", descricao: "Recebidos BO, CNH e fotos dos danos.", proximaAcao: "Abrir vistoria", prazoRetorno: menosData(2) },
        { id: Util.id("acomp"), criadoEm: menos(48), data: menosData(2), hora: "14:30", autor: "Carla Menezes", tipo: "Vistoria realizada", descricao: "Vistoria feita na oficina credenciada Savassi. Danos compatíveis com o relato.", proximaAcao: "Aguardar orçamento", prazoRetorno: menosData(1) },
        { id: Util.id("acomp"), criadoEm: menos(20), data: menosData(1), hora: "11:15", autor: "Carla Menezes", tipo: "Orçamento recebido", descricao: "Orçamento de R$ 4.380,00 recebido, em análise pelo Setor Plus.", proximaAcao: "Autorizar pagamento e liberar reparo", prazoRetorno: maisData(2) },
      ],
      contatos: [
        { id: Util.id("ct"), criadoEm: menos(70), tipo: "associado", canal: "WhatsApp", quem: "André Luiz Barbosa", resumo: "Orientado sobre documentos e prazo de vistoria.", autor: "Fernanda Alves" },
        { id: Util.id("ct"), criadoEm: menos(20), tipo: "prestador", canal: "Telefone", quem: "Oficina Credenciada Savassi", resumo: "Confirmado envio do orçamento e prazo de reparo de 6 dias úteis.", autor: "Carla Menezes" },
      ],
      anexos: [],
      historico: [
        hist(menos(74), "Fernanda Alves", "Sinistro cadastrado", "Aberto em Acabou de entrar com prioridade Normal.", "", "Acabou de entrar"),
        hist(menos(71), "Fernanda Alves", "Movimentação", "Sinistro movido de “Acabou de entrar” para “Resolvendo”.", "Acabou de entrar", "Resolvendo"),
        hist(menos(70), "Fernanda Alves", "Atualização registrada", "Documentação recebida — BO, CNH e fotos dos danos."),
        hist(menos(48), "Carla Menezes", "Atualização registrada", "Vistoria realizada na oficina credenciada."),
        hist(menos(20), "Carla Menezes", "Atualização registrada", "Orçamento recebido — R$ 4.380,00 em análise."),
      ],
    };

    const s4 = {
      id: Util.id("sin"), criadoEm: menos(190), atualizadoEm: menos(150), concluidoEm: null,
      dataAtendimento: menosData(8), horaAtendimento: "16:48",
      atendente: "Carla Menezes", responsavel: "", status: "resolvendo", prioridade: "atencao",
      associado: "Simone Cardoso Nunes", whatsapp: "(85) 98307-2255", documento: "441.902.708-73", contrato: "PLUS-1650",
      dataIncidente: menosData(8), horaIncidente: "05:20",
      local: "Estacionamento do Condomínio Vila Mar — Fortaleza/CE",
      tipo: "Furto", descricao: "Furto do veículo no estacionamento do condomínio durante a madrugada. Imagens do circuito interno solicitadas ao síndico.",
      vitimas: 0, veiculosEnvolvidos: 1, temBO: true, numeroBO: "BO-2026-119847", guincho: false, atendimentoMedico: false,
      placa: "QOF5J07", marca: "Fiat", modelo: "Argo Drive 1.3", ano: "2020", cor: "Vermelho",
      numero: `SIN-${ano}-0004`, protocolo: `PLUS-${ano}-0004`, classificacao: "Em análise",
      prestador: "",
      observacoes: "Aguardando documentação obrigatória: cópia do BO, chaves reserva e comprovante de residência.",
      proximaAcao: "Cobrar documentação pendente e definir responsável pelo caso", prazoRetorno: menosData(2), documentosPendentes: true,
      acompanhamentos: [
        { id: Util.id("acomp"), criadoEm: menos(186), data: menosData(8), hora: "17:30", autor: "Carla Menezes", tipo: "Documentação solicitada", descricao: "Solicitados cópia do BO, chaves reserva e comprovante de residência.", proximaAcao: "Receber documentos", prazoRetorno: menosData(2) },
        { id: Util.id("acomp"), criadoEm: menos(150), data: menosData(6), hora: "10:10", autor: "Carla Menezes", tipo: "Análise em andamento", descricao: "Documentação ainda não recebida. Associada informou dificuldade para retirar o BO.", proximaAcao: "Reforçar cobrança da documentação", prazoRetorno: menosData(2) },
      ],
      contatos: [
        { id: Util.id("ct"), criadoEm: menos(150), tipo: "associado", canal: "WhatsApp", quem: "Simone Cardoso Nunes", resumo: "Reforçada a lista de documentos pendentes.", autor: "Carla Menezes" },
      ],
      anexos: [],
      historico: [
        hist(menos(190), "Carla Menezes", "Sinistro cadastrado", "Aberto em Acabou de entrar com prioridade Atenção.", "", "Acabou de entrar"),
        hist(menos(188), "Carla Menezes", "Movimentação", "Sinistro movido de “Acabou de entrar” para “Resolvendo”.", "Acabou de entrar", "Resolvendo"),
        hist(menos(186), "Carla Menezes", "Atualização registrada", "Documentação solicitada — BO, chaves reserva e comprovante."),
        hist(menos(150), "Carla Menezes", "Atualização registrada", "Análise em andamento — documentação ainda pendente."),
      ],
    };

    const s5 = {
      id: Util.id("sin"), criadoEm: menos(560), atualizadoEm: menos(30), concluidoEm: menos(30),
      dataAtendimento: menosData(23), horaAtendimento: "08:05",
      atendente: "Fernanda Alves", responsavel: "Diogo Gomes", status: "concluido", prioridade: "normal",
      associado: "Roberto Tanaka Ferreira", whatsapp: "(41) 99215-6688", documento: "285.663.410-22", contrato: "PLUS-1489",
      dataIncidente: menosData(24), horaIncidente: "22:15",
      local: "Rua XV de Novembro, 780 — Curitiba/PR",
      tipo: "Perda total", descricao: "Incêndio no compartimento do motor após pane elétrica. Veículo considerado perda total pela vistoria técnica.",
      vitimas: 0, veiculosEnvolvidos: 1, temBO: true, numeroBO: "BO-2026-902117", guincho: true, atendimentoMedico: false,
      placa: "BFT9C51", marca: "Renault", modelo: "Sandero Expression 1.6", ano: "2017", cor: "Preto",
      numero: `SIN-${ano}-0005`, protocolo: `PLUS-${ano}-0005`, classificacao: "Indenização",
      prestador: "Vistoria Técnica Paraná / Setor de Indenizações",
      observacoes: "Indenização paga conforme tabela vigente. Associado assinou o termo de quitação.",
      proximaAcao: "", prazoRetorno: "", documentosPendentes: false,
      acompanhamentos: [
        { id: Util.id("acomp"), criadoEm: menos(540), data: menosData(22), hora: "09:40", autor: "Fernanda Alves", tipo: "Vistoria solicitada", descricao: "Vistoria técnica agendada para avaliação do veículo incendiado.", proximaAcao: "Aguardar laudo", prazoRetorno: menosData(20) },
        { id: Util.id("acomp"), criadoEm: menos(430), data: menosData(18), hora: "15:20", autor: "Diogo Gomes", tipo: "Vistoria realizada", descricao: "Laudo confirma perda total do veículo.", proximaAcao: "Encaminhar para indenização", prazoRetorno: menosData(12) },
        { id: Util.id("acomp"), criadoEm: menos(150), data: menosData(6), hora: "11:00", autor: "Diogo Gomes", tipo: "Pagamento autorizado", descricao: "Indenização autorizada e agendada para pagamento.", proximaAcao: "Confirmar recebimento com o associado", prazoRetorno: menosData(2) },
        { id: Util.id("acomp"), criadoEm: menos(30), data: menosData(1), hora: "14:25", autor: "Fernanda Alves", tipo: "Caso encerrado", descricao: "Associado confirmou o recebimento da indenização. Caso encerrado.", proximaAcao: "", prazoRetorno: "" },
      ],
      contatos: [
        { id: Util.id("ct"), criadoEm: menos(30), tipo: "associado", canal: "WhatsApp", quem: "Roberto Tanaka Ferreira", resumo: "Confirmado o recebimento da indenização e o encerramento do caso.", autor: "Fernanda Alves" },
      ],
      anexos: [],
      historico: [
        hist(menos(560), "Fernanda Alves", "Sinistro cadastrado", "Aberto em Acabou de entrar com prioridade Atenção.", "", "Acabou de entrar"),
        hist(menos(556), "Fernanda Alves", "Movimentação", "Sinistro movido de “Acabou de entrar” para “Caso urgente”.", "Acabou de entrar", "Caso urgente"),
        hist(menos(540), "Fernanda Alves", "Movimentação", "Sinistro movido de “Caso urgente” para “Resolvendo”.", "Caso urgente", "Resolvendo"),
        hist(menos(430), "Diogo Gomes", "Atualização registrada", "Vistoria realizada — laudo confirma perda total."),
        hist(menos(150), "Diogo Gomes", "Atualização registrada", "Pagamento autorizado."),
        hist(menos(30), "Fernanda Alves", "Movimentação", "Sinistro movido de “Resolvendo” para “Caso concluído”.", "Resolvendo", "Caso concluído"),
      ],
    };

    return [s1, s2, s3, s4, s5];
  }

  /* ---------------------------------------------------------------- */
  return {
    STATUS, PRIORIDADES, TIPOS, CLASSIFICACOES, TIPOS_ACOMPANHAMENTO, PERFIS,
    nomeStatus, nomePrioridade, corStatus, nomePerfil,
    carregar, salvar, aoMudar, armazenamentoIndisponivel,
    entrar, sair, usuarioAtual, ehAdmin, listaUsuarios, salvarUsuario, excluirUsuario,
    lista, obter, porStatus, proximoNumeroSinistro, proximoProtocolo,
    ultimaAtualizacao, ultimoContatoAssociado,
    criar, atualizar, mover, alterarPrioridade, alterarPessoa, excluir, validar,
    adicionarAcompanhamento, removerAcompanhamento, adicionarObservacao,
    adicionarContato, adicionarAnexo, removerAnexo,
    alertas, temAlerta, prazoVencido, semAtualizacao, indicadores,
    filtrar, pessoas, historicoGlobal,
    config, salvarConfig, exportarBackup, importarBackup, restaurarDemonstracao,
  };
})();

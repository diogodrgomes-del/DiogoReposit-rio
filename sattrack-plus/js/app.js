/* ==================================================================
   App — menu lateral, rotas, indicadores e busca.
   ================================================================== */
const App = (() => {

  const $ = UI.$;
  const $$ = UI.$$;

  const estado = {
    pagina: "visao-geral",
    busca: "",
    filtros: {},
    filtrosAbertos: false,
    periodo: "30",
    relDe: "",
    relAte: "",
    historicoAcao: null,
    historicoUsuario: null,
  };

  const MENU = [
    { grupo: "Painel" },
    { id: "visao-geral", nome: "Visão geral", icone: "▦", titulo: "Visão geral", sub: "Resumo dos sinistros do Setor Plus." },
    { id: "workflow", nome: "Workflow de sinistros", icone: "☰", titulo: "Workflow de sinistros", sub: "Arraste os cards entre as etapas. Toda movimentação é salva." },
    { id: "cadastrar", nome: "Cadastrar sinistro", icone: "＋", acao: true },

    { grupo: "Etapas" },
    { id: "urgentes", nome: "Casos urgentes", icone: "!", titulo: "Casos urgentes", sub: "Casos graves ou com atendimento imediato.", contador: () => Dados.lista().filter((s) => s.status === "urgente").length, alerta: true },
    { id: "resolvendo", nome: "Em resolução", icone: "◐", titulo: "Em resolução", sub: "Casos acompanhados pela equipe responsável.", contador: () => Dados.lista().filter((s) => s.status === "resolvendo").length },
    { id: "concluidos", nome: "Casos concluídos", icone: "✓", titulo: "Casos concluídos", sub: "Casos finalizados, resolvidos ou encerrados.", contador: () => Dados.lista().filter((s) => s.status === "concluido").length },

    { grupo: "Controle" },
    { id: "prazos", nome: "Prazos e pendências", icone: "⏱", titulo: "Prazos e pendências", sub: "Alertas de prazo, documentos e casos parados.", contador: () => Dados.indicadores().prazoVencido, alerta: true },
    { id: "historico", nome: "Histórico", icone: "≡", titulo: "Histórico", sub: "Registro automático de tudo que acontece nos sinistros." },
    { id: "relatorios", nome: "Relatórios", icone: "▤", titulo: "Relatórios", sub: "Números do setor por período, com exportação." },

    { grupo: "Administração" },
    { id: "usuarios", nome: "Usuários", icone: "◍", titulo: "Usuários", sub: "Perfis de acesso da equipe." },
    { id: "config", nome: "Configurações", icone: "⚙", titulo: "Configurações", sub: "Alertas, identificação e backup dos dados." },
  ];

  /* ---------------------------------------------------------------- */
  /* Menu                                                              */
  /* ---------------------------------------------------------------- */
  function desenharMenu() {
    $("#menu").innerHTML = MENU.map((item) => {
      if (item.grupo) return `<div class="menu-titulo">${Util.esc(item.grupo)}</div>`;
      const n = item.contador ? item.contador() : 0;
      const selo = item.contador && n > 0
        ? `<span class="selo${item.alerta ? " selo-vermelho" : ""}">${n}</span>` : "";
      return `<button class="menu-item${item.id === estado.pagina ? " ativo" : ""}" data-pagina="${item.id}">
        <span class="menu-icone">${item.icone}</span>${Util.esc(item.nome)}${selo}</button>`;
    }).join("");

    $$("[data-pagina]", $("#menu")).forEach((btn) => {
      btn.addEventListener("click", () => ir(btn.dataset.pagina));
    });
  }

  function ir(pagina) {
    if (pagina === "cadastrar") { Formularios.abrirCadastro(); fecharMenuMobile(); return; }
    estado.pagina = pagina;
    // Cada etapa entra com o filtro de status já aplicado.
    if (pagina === "urgentes") estado.filtros = { status: "urgente" };
    else if (pagina === "resolvendo") estado.filtros = { status: "resolvendo" };
    else if (pagina === "concluidos") estado.filtros = { status: "concluido" };
    else if (["visao-geral", "workflow"].indexOf(pagina) >= 0) estado.filtros = {};
    fecharMenuMobile();
    desenhar();
    window.scrollTo({ top: 0 });
  }

  const fecharMenuMobile = () => {
    $("#lateral").classList.remove("aberta");
    $("#lateral-fundo").hidden = true;
  };

  /* ---------------------------------------------------------------- */
  /* Indicadores                                                       */
  /* ---------------------------------------------------------------- */
  function desenharIndicadores() {
    const i = Dados.indicadores();
    const itens = [
      { rotulo: "Sinistros abertos", valor: i.abertos, sub: `${i.total} no total`, cor: "" },
      { rotulo: "Acabaram de entrar", valor: i.entrou, sub: "aguardando análise", cor: "" },
      { rotulo: "Casos urgentes", valor: i.urgentes, sub: "atenção imediata", cor: "vermelho" },
      { rotulo: "Em resolução", valor: i.resolvendo, sub: "em acompanhamento", cor: "amarelo" },
      { rotulo: "Concluídos hoje", valor: i.concluidosHoje, sub: `${i.concluidos} no total`, cor: "verde" },
      { rotulo: "Casos com vítimas", valor: i.comVitimas, sub: "em aberto", cor: "vermelho" },
      { rotulo: "Prazo vencido", valor: i.prazoVencido, sub: "retorno atrasado", cor: "vermelho" },
      { rotulo: "Sem atualização", valor: i.semAtualizacao, sub: "há muito tempo", cor: "amarelo" },
      { rotulo: "Tempo médio", valor: i.tempoMedio, sub: "até a conclusão", cor: "" },
    ];

    $("#indicadores").innerHTML = itens.map((x) => `<div class="indicador ${x.cor}">
      <span>${Util.esc(x.rotulo)}</span>
      <strong>${Util.esc(x.valor)}</strong>
      <small>${Util.esc(x.sub)}</small>
    </div>`).join("");
  }

  /* ---------------------------------------------------------------- */
  /* Conteúdo                                                          */
  /* ---------------------------------------------------------------- */
  function itemMenu(id) { return MENU.find((m) => m.id === id) || {}; }

  function desenharConteudo() {
    const alvo = $("#conteudo");
    const p = estado.pagina;

    const listaFiltrada = () => Dados.filtrar(estado.busca, estado.filtros).sort(Kanban.ordenar);

    if (p === "visao-geral") {
      alvo.innerHTML = Paginas.visaoGeral();
      Paginas.ligarTabela(alvo);
      $$("[data-ir]", alvo).forEach((b) => b.addEventListener("click", () => ir(b.dataset.ir)));

    } else if (p === "workflow") {
      const lista = Dados.filtrar(estado.busca, estado.filtros);
      alvo.innerHTML = Paginas.filtrosHTML(estado.filtros, ["status"], estado.filtrosAbertos) + Kanban.quadroHTML(lista);
      Paginas.ligarFiltros(alvo, aplicarFiltro);
      Kanban.ligar(alvo);

    } else if (p === "urgentes" || p === "resolvendo" || p === "concluidos") {
      const lista = listaFiltrada();
      const item = itemMenu(p);
      alvo.innerHTML = Paginas.filtrosHTML(estado.filtros, [], estado.filtrosAbertos) + `
        <div class="cartao">
          <div class="cartao-topo">
            <div><h2>${Util.esc(item.titulo)}</h2><p>${Util.plural(lista.length, "sinistro", "sinistros")}</p></div>
            <button class="btn btn-vazio btn-pequeno" data-exportar>Exportar planilha</button>
          </div>
          ${Paginas.tabelaHTML(lista, { colunaTempo: p === "concluidos" ? "Concluído" : "Aberto há" })}
        </div>`;
      Paginas.ligarFiltros(alvo, aplicarFiltro);
      Paginas.ligarTabela(alvo);
      $("[data-exportar]", alvo).addEventListener("click", () => Relatorios.exportarSinistros(lista));

    } else if (p === "prazos") {
      alvo.innerHTML = Paginas.prazos();
      Paginas.ligarTabela(alvo);

    } else if (p === "historico") {
      alvo.innerHTML = Paginas.historico(estado);
      Paginas.ligarTabela(alvo);
      Paginas.ligarHistorico(alvo, estado, desenhar);

    } else if (p === "relatorios") {
      alvo.innerHTML = Relatorios.pagina(estado);
      Relatorios.ligar(alvo, estado, desenhar);
      Paginas.ligarTabela(alvo);

    } else if (p === "usuarios") {
      alvo.innerHTML = Paginas.usuarios();
      Paginas.ligarUsuarios(alvo, desenhar);

    } else if (p === "config") {
      alvo.innerHTML = Paginas.configuracoes();
      Paginas.ligarConfiguracoes(alvo, desenhar);
    }
  }

  function aplicarFiltro(chave, valor) {
    if (chave === "__alternar__") {
      estado.filtrosAbertos = !estado.filtrosAbertos;
      desenhar();
      return;
    }
    if (chave === "__limpar__") {
      estado.filtros = {};
      estado.busca = "";
      $("#busca").value = "";
    } else if (valor === null || valor === "" || valor === false) {
      delete estado.filtros[chave];
    } else {
      estado.filtros[chave] = valor;
    }
    desenhar();
  }

  function desenhar() {
    const usuario = Dados.usuarioAtual();
    if (!usuario) return mostrarLogin();

    const item = itemMenu(estado.pagina);
    $("#titulo-pagina").textContent = item.titulo || "Painel";
    $("#subtitulo-pagina").textContent = item.sub || "";
    $("#limpar-busca").hidden = !estado.busca;

    desenharMenu();
    desenharIndicadores();
    desenharConteudo();
  }

  /* ---------------------------------------------------------------- */
  /* Sessão                                                            */
  /* ---------------------------------------------------------------- */
  function mostrarLogin() {
    $("#app").hidden = true;
    $("#tela-login").hidden = false;
    const campo = $("#form-login").elements.usuario;
    if (campo) campo.focus();
  }

  function mostrarApp() {
    const usuario = Dados.usuarioAtual();
    $("#tela-login").hidden = true;
    $("#app").hidden = false;
    $("#usuario-nome").textContent = usuario.nome;
    $("#usuario-perfil").textContent = Dados.nomePerfil(usuario.perfil);
    $("#usuario-avatar").textContent = Util.iniciais(usuario.nome);
    desenhar();
  }

  /* ---------------------------------------------------------------- */
  /* Início                                                            */
  /* ---------------------------------------------------------------- */
  function iniciar() {
    Dados.carregar();
    UI.iniciar();

    // Login
    $("#form-login").addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      const r = Dados.entrar(form.elements.usuario.value, form.elements.senha.value);
      const erro = $("#login-erro");
      if (!r.ok) {
        erro.textContent = r.erro;
        erro.hidden = false;
        return;
      }
      erro.hidden = true;
      form.reset();
      estado.pagina = "workflow";
      mostrarApp();
      UI.sucesso(`Bem-vindo(a), ${r.usuario.nome.split(" ")[0]}.`);
    });

    $$("[data-preencher]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const form = $("#form-login");
        const admin = btn.dataset.preencher === "admin";
        form.elements.usuario.value = admin ? "admin" : "fernanda";
        form.elements.senha.value = admin ? "admin123" : "1234";
        form.elements.senha.focus();
      });
    });

    $("#btn-sair").addEventListener("click", async () => {
      const ok = await UI.confirmar({ titulo: "Sair do sistema", texto: "Deseja encerrar a sessão? Os sinistros continuam salvos.", rotulo: "Sair" });
      if (!ok) return;
      Dados.sair();
      mostrarLogin();
    });

    // Topo
    $("#btn-novo").addEventListener("click", () => Formularios.abrirCadastro());

    let tempoBusca = null;
    $("#busca").addEventListener("input", (e) => {
      estado.busca = e.target.value;
      clearTimeout(tempoBusca);
      tempoBusca = setTimeout(() => {
        // A busca só faz sentido nas telas de lista e no quadro.
        if (["visao-geral", "usuarios", "config", "relatorios"].indexOf(estado.pagina) >= 0) estado.pagina = "workflow";
        desenhar();
      }, 180);
    });

    $("#limpar-busca").addEventListener("click", () => {
      estado.busca = "";
      $("#busca").value = "";
      desenhar();
    });

    // Menu no celular
    $("#abrir-menu").addEventListener("click", () => {
      $("#lateral").classList.add("aberta");
      $("#lateral-fundo").hidden = false;
    });
    $("#fechar-menu").addEventListener("click", fecharMenuMobile);
    $("#lateral-fundo").addEventListener("click", fecharMenuMobile);

    // Qualquer escrita nos dados redesenha o painel.
    Dados.aoMudar(() => { if (Dados.usuarioAtual()) desenhar(); });

    // Os tempos ("aberto há…") envelhecem sozinhos.
    setInterval(() => {
      if (Dados.usuarioAtual() && !UI.gavetaAberta() && $("#modal-fundo").hidden) desenhar();
    }, 60000);

    if (Dados.usuarioAtual()) { estado.pagina = "workflow"; mostrarApp(); }
    else mostrarLogin();
  }

  return { iniciar, desenhar, ir, estado };
})();

document.addEventListener("DOMContentLoaded", App.iniciar);

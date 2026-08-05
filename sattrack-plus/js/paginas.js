/* ==================================================================
   Páginas — visão geral, listas por etapa, prazos, histórico,
   usuários e configurações.
   ================================================================== */
const Paginas = (() => {

  const $ = UI.$;
  const $$ = UI.$$;

  /* ---------------------------------------------------------------- */
  /* Tabela de sinistros reaproveitada nas listas                       */
  /* ---------------------------------------------------------------- */
  function tabelaHTML(lista, opcoes) {
    const o = opcoes || {};
    if (!lista.length) return `<div class="vazio">${Util.esc(o.vazio || "Nenhum sinistro encontrado com os filtros atuais.")}</div>`;

    return `<div class="tabela-rolagem"><table class="tabela">
      <thead><tr>
        <th>Sinistro</th><th>Associado</th><th>Veículo</th><th>Tipo</th>
        <th>Incidente</th><th>Equipe</th><th>Prioridade</th><th>Status</th>
        <th>${o.colunaTempo || "Aberto há"}</th><th>Alertas</th>
      </tr></thead>
      <tbody>${lista.map((s) => {
        const alertas = Dados.alertas(s);
        return `<tr class="clicavel" data-abrir="${Util.esc(s.id)}">
          <td><strong>${Util.esc(s.numero)}</strong><br /><small>${Util.esc(Util.ou(s.protocolo))}</small></td>
          <td>${Util.esc(s.associado)}<br /><small>${Util.esc(s.whatsapp)}</small></td>
          <td><span class="placa">${Util.esc(Util.ou(s.placa, "—"))}</span><br /><small>${Util.esc([s.marca, s.modelo].filter(Boolean).join(" ") || "—")}</small></td>
          <td>${Util.esc(s.tipo)}${Number(s.vitimas) > 0 ? `<br /><small style="color:var(--vermelho)">${Util.plural(Number(s.vitimas), "vítima", "vítimas")}</small>` : ""}</td>
          <td>${Util.esc(Util.fmtData(s.dataIncidente))}<br /><small>${Util.esc(Util.fmtHora(s.horaIncidente))}</small></td>
          <td><small>Atend.: ${Util.esc(Util.ou(s.atendente))}<br />Resp.: ${Util.esc(Util.ou(s.responsavel, "—"))}</small></td>
          <td>${UI.etiquetaPrioridade(s.prioridade)}</td>
          <td>${UI.etiquetaStatus(s.status)}</td>
          <td><small>${s.status === "concluido" && s.concluidoEm
              ? "Concluído há " + Util.esc(Util.tempoDesde(s.concluidoEm))
              : Util.esc(Util.tempoDesde(s.criadoEm))}</small></td>
          <td>${alertas.length
              ? alertas.map((a) => `<span class="alerta-mini${a.nivel === "aviso" ? " aviso" : ""}">${Util.esc(a.texto)}</span>`).join(" ")
              : '<small style="color:var(--cinza-texto)">—</small>'}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
  }

  function ligarTabela(raiz) {
    $$("[data-abrir]", raiz).forEach((linha) => {
      linha.addEventListener("click", () => Formularios.abrirDetalhe(linha.dataset.abrir));
    });
  }

  /* ---------------------------------------------------------------- */
  /* Barra de filtros                                                   */
  /* ---------------------------------------------------------------- */
  const MARCAS = [
    { chave: "comVitimas", nome: "Com vítimas" },
    { chave: "urgentes", nome: "Urgentes" },
    { chave: "documentosPendentes", nome: "Documentos pendentes" },
    { chave: "prazoVencido", nome: "Prazo vencido" },
    { chave: "semAtualizacao", nome: "Sem atualização" },
    { chave: "semResponsavel", nome: "Sem responsável" },
    { chave: "concluidos", nome: "Concluídos" },
  ];

  function filtrosHTML(f, esconder, aberto) {
    const oculto = esconder || [];
    const mostra = (chave) => oculto.indexOf(chave) < 0;
    const pessoas = Dados.pessoas();
    const ativos = Object.keys(f).filter((k) => f[k]).length;

    const barra = `<div class="filtros-barra nao-imprime">
      <button class="btn btn-vazio btn-pequeno" data-alternar-filtros>
        ${aberto ? "▾" : "▸"} Filtros${ativos ? ` <span class="selo-num">${ativos}</span>` : ""}
      </button>
      ${ativos ? `<span class="filtros-resumo">${Util.plural(ativos, "filtro aplicado", "filtros aplicados")}</span>
                  <button class="marca-filtro" data-limpar-filtros>Limpar filtros</button>` : ""}
    </div>`;

    return barra + `<div class="filtros nao-imprime" id="barra-filtros"${aberto ? "" : " hidden"}>
      ${mostra("status") ? `<label class="filtro"><span>Status</span>
        <select data-filtro="status">${UI.opcoes(Dados.STATUS, f.status, "Todos")}</select></label>` : ""}
      <label class="filtro"><span>Prioridade</span>
        <select data-filtro="prioridade">${UI.opcoes(Dados.PRIORIDADES, f.prioridade, "Todas")}</select></label>
      <label class="filtro"><span>Tipo de sinistro</span>
        <select data-filtro="tipo">${UI.opcoes(Dados.TIPOS, f.tipo, "Todos")}</select></label>
      <label class="filtro"><span>Atendente</span>
        <select data-filtro="atendente">${UI.opcoes(pessoas, f.atendente, "Todas")}</select></label>
      <label class="filtro"><span>Responsável</span>
        <select data-filtro="responsavel">${UI.opcoes(pessoas, f.responsavel, "Todos")}</select></label>
      <label class="filtro"><span>Incidente de</span>
        <input type="date" data-filtro="incidenteDe" value="${Util.esc(f.incidenteDe || "")}" /></label>
      <label class="filtro"><span>até</span>
        <input type="date" data-filtro="incidenteAte" value="${Util.esc(f.incidenteAte || "")}" /></label>
      <label class="filtro"><span>Abertura de</span>
        <input type="date" data-filtro="aberturaDe" value="${Util.esc(f.aberturaDe || "")}" /></label>
      <label class="filtro"><span>até</span>
        <input type="date" data-filtro="aberturaAte" value="${Util.esc(f.aberturaAte || "")}" /></label>

      <div class="filtros-marcas">
        ${MARCAS.filter((m) => mostra(m.chave)).map((m) =>
          `<button class="marca-filtro${f[m.chave] ? " ativo" : ""}" data-marca="${m.chave}">${Util.esc(m.nome)}</button>`).join("")}
        <button class="marca-filtro" data-limpar-filtros>Limpar filtros</button>
      </div>
    </div>`;
  }

  function ligarFiltros(raiz, aoMudar) {
    const alternar = $("[data-alternar-filtros]", raiz);
    if (alternar) alternar.addEventListener("click", () => aoMudar("__alternar__"));
    $$("[data-filtro]", raiz).forEach((el) => {
      el.addEventListener("change", () => aoMudar(el.dataset.filtro, el.value || null));
    });
    $$("[data-marca]", raiz).forEach((btn) => {
      btn.addEventListener("click", () => aoMudar(btn.dataset.marca, !btn.classList.contains("ativo") || null));
    });
    $$("[data-limpar-filtros]", raiz).forEach((btn) => {
      btn.addEventListener("click", () => aoMudar("__limpar__"));
    });
  }

  /* ---------------------------------------------------------------- */
  /* Visão geral                                                       */
  /* ---------------------------------------------------------------- */
  function visaoGeral() {
    const todos = Dados.lista();
    const ind = Dados.indicadores();
    const abertos = todos.filter((s) => s.status !== "concluido");

    const porStatus = Dados.STATUS.map((st) => ({ nome: st.nome, cor: st.cor, valor: todos.filter((s) => s.status === st.id).length }));
    const maxStatus = Math.max.apply(null, porStatus.map((p) => p.valor).concat([1]));

    const porTipo = Dados.TIPOS
      .map((t) => ({ nome: t, valor: todos.filter((s) => s.tipo === t).length }))
      .filter((t) => t.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    const maxTipo = Math.max.apply(null, porTipo.map((p) => p.valor).concat([1]));

    const pendencias = abertos
      .map((s) => ({ sin: s, alertas: Dados.alertas(s) }))
      .filter((x) => x.alertas.some((a) => a.nivel === "grave"))
      .slice(0, 6);

    const recentes = todos.slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 5);
    const atividade = Dados.historicoGlobal(8);

    return `
    <div class="grade-2">
      <div class="cartao">
        <div class="cartao-topo"><h2>Sinistros por etapa</h2><p>Distribuição atual do quadro</p></div>
        ${porStatus.map((p) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="min-width:130px;font-size:13.5px">${Util.esc(p.nome)}</span>
          ${UI.barra(p.valor, maxStatus, p.cor === "vermelha" ? "vermelho" : p.cor === "verde" ? "verde" : p.cor === "amarela" ? "amarelo" : null)}
          <b style="min-width:26px;text-align:right">${p.valor}</b>
        </div>`).join("")}
      </div>

      <div class="cartao">
        <div class="cartao-topo"><h2>Sinistros por tipo</h2><p>Todos os casos registrados</p></div>
        ${porTipo.length ? porTipo.map((p) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="min-width:150px;font-size:13.5px">${Util.esc(p.nome)}</span>
          ${UI.barra(p.valor, maxTipo)}
          <b style="min-width:26px;text-align:right">${p.valor}</b>
        </div>`).join("") : '<div class="vazio">Nenhum sinistro cadastrado.</div>'}
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo">
        <div><h2>Precisam de atenção agora</h2><p>Casos com alerta grave em aberto</p></div>
        <button class="btn btn-vazio btn-pequeno" data-ir="prazos">Ver todas as pendências</button>
      </div>
      ${pendencias.length ? `<div class="grade-3">${pendencias.map((x) => `
        <div class="card prioridade-${Util.esc(x.sin.prioridade)}" data-abrir="${Util.esc(x.sin.id)}" style="cursor:pointer">
          <div class="card-nome">${Util.esc(x.sin.associado)}</div>
          <div class="card-numero">${Util.esc(x.sin.numero)} · ${Util.esc(Dados.nomeStatus(x.sin.status))}</div>
          <div class="alertas-card">${x.alertas.map((a) =>
            `<span class="alerta-mini${a.nivel === "aviso" ? " aviso" : ""}">${Util.esc(a.texto)}</span>`).join("")}</div>
        </div>`).join("")}</div>`
        : `<div class="vazio">Nenhum caso com alerta grave. Bom trabalho.</div>`}
    </div>

    <div class="grade-2">
      <div class="cartao">
        <div class="cartao-topo"><h2>Últimos sinistros cadastrados</h2></div>
        ${recentes.length ? `<div class="linha-tempo">${recentes.map((s) => `
          <div class="evento" data-abrir="${Util.esc(s.id)}" style="cursor:pointer">
            <div class="evento-topo">
              <strong>${Util.esc(s.associado)}</strong>
              ${UI.etiquetaPrioridade(s.prioridade)}
              <span class="evento-quando">há ${Util.esc(Util.tempoDesde(s.criadoEm))}</span>
            </div>
            <p class="detalhe">${Util.esc(s.numero)} · ${Util.esc(s.tipo)} · ${Util.esc(Util.ou(s.placa))} · ${Util.esc(Dados.nomeStatus(s.status))}</p>
          </div>`).join("")}</div>` : '<div class="vazio">Nenhum sinistro cadastrado.</div>'}
      </div>

      <div class="cartao">
        <div class="cartao-topo"><h2>Atividade recente</h2><p>Últimos registros do histórico</p></div>
        ${atividade.length ? `<div class="linha-tempo">${atividade.map((h) => `
          <div class="evento historico" data-abrir="${Util.esc(h.sinistroId)}" style="cursor:pointer">
            <div class="evento-topo">
              <strong>${Util.esc(h.acao)}</strong>
              <span class="evento-quando">${Util.esc(Util.fmtDataHora(h.criadoEm))}</span>
            </div>
            <p class="detalhe">${Util.esc(h.numero)} — ${Util.esc(h.detalhe)} <em>(${Util.esc(h.usuario)})</em></p>
          </div>`).join("")}</div>` : '<div class="vazio">Sem movimentação registrada.</div>'}
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo">
        <div><h2>Resumo operacional</h2><p>Números do Setor Plus neste momento</p></div>
      </div>
      <div class="dados-grade">
        ${UI.dado("Sinistros abertos", ind.abertos)}
        ${UI.dado("Casos urgentes", ind.urgentes)}
        ${UI.dado("Casos com vítimas", ind.comVitimas)}
        ${UI.dado("Documentos pendentes", ind.documentosPendentes)}
        ${UI.dado("Prazo vencido", ind.prazoVencido)}
        ${UI.dado("Sem atualização", ind.semAtualizacao)}
        ${UI.dado("Sem responsável", ind.semResponsavel)}
        ${UI.dado("Concluídos hoje", ind.concluidosHoje)}
        ${UI.dado("Tempo médio de conclusão", ind.tempoMedio)}
      </div>
    </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Prazos e pendências                                               */
  /* ---------------------------------------------------------------- */
  function prazos() {
    const abertos = Dados.lista().filter((s) => s.status !== "concluido");

    const grupos = [
      { chave: "urgente-parado", titulo: "Casos urgentes sem atualização", cor: "var(--vermelho)" },
      { chave: "prazo", titulo: "Prazo de retorno vencido", cor: "var(--vermelho)" },
      { chave: "documentos", titulo: "Documentos pendentes", cor: "var(--amarelo)" },
      { chave: "parado", titulo: "Parados há muito tempo", cor: "var(--amarelo)" },
      { chave: "sem-atualizacao", titulo: "Sem atualização recente", cor: "var(--amarelo)" },
      { chave: "sem-responsavel", titulo: "Casos sem responsável", cor: "var(--amarelo)" },
      { chave: "sem-contato", titulo: "Sem contato recente com o associado", cor: "var(--amarelo)" },
    ];

    const proximos = abertos
      .filter((s) => s.prazoRetorno && !Dados.prazoVencido(s))
      .sort((a, b) => String(a.prazoRetorno).localeCompare(String(b.prazoRetorno)))
      .slice(0, 10);

    const blocos = grupos.map((g) => {
      const itens = abertos.filter((s) => Dados.temAlerta(s, g.chave));
      return `<div class="cartao" style="border-left:4px solid ${g.cor}">
        <div class="cartao-topo">
          <div><h2>${Util.esc(g.titulo)}</h2><p>${Util.plural(itens.length, "caso", "casos")}</p></div>
        </div>
        ${tabelaHTML(itens, { vazio: "Nenhum caso nesta condição." })}
      </div>`;
    }).join("");

    return `
    <div class="cartao">
      <div class="cartao-topo"><h2>Próximos prazos de retorno</h2><p>Casos em aberto com prazo definido</p></div>
      ${proximos.length ? `<div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Prazo</th><th>Sinistro</th><th>Associado</th><th>Próxima ação</th><th>Responsável</th><th>Status</th></tr></thead>
        <tbody>${proximos.map((s) => `<tr class="clicavel" data-abrir="${Util.esc(s.id)}">
          <td><strong>${Util.esc(Util.fmtData(s.prazoRetorno))}</strong></td>
          <td>${Util.esc(s.numero)}</td>
          <td>${Util.esc(s.associado)}</td>
          <td>${Util.esc(Util.ou(s.proximaAcao, "—"))}</td>
          <td>${Util.esc(Util.ou(s.responsavel, "—"))}</td>
          <td>${UI.etiquetaStatus(s.status)}</td>
        </tr>`).join("")}</tbody></table></div>` : '<div class="vazio">Nenhum prazo futuro cadastrado.</div>'}
    </div>
    ${blocos}`;
  }

  /* ---------------------------------------------------------------- */
  /* Histórico geral                                                   */
  /* ---------------------------------------------------------------- */
  function historico(estado) {
    const termo = Util.normalizar(estado.busca);
    const acoes = Array.from(new Set(Dados.historicoGlobal().map((h) => h.acao))).sort();
    const usuarios = Array.from(new Set(Dados.historicoGlobal().map((h) => h.usuario))).sort();

    const linhas = Dados.historicoGlobal().filter((h) => {
      if (estado.historicoAcao && h.acao !== estado.historicoAcao) return false;
      if (estado.historicoUsuario && h.usuario !== estado.historicoUsuario) return false;
      if (!termo) return true;
      return Util.normalizar([h.numero, h.associado, h.acao, h.detalhe, h.usuario].join(" ")).indexOf(termo) >= 0;
    });

    return `
    <div class="filtros nao-imprime">
      <label class="filtro"><span>Tipo de alteração</span>
        <select data-hist="historicoAcao">${UI.opcoes(acoes, estado.historicoAcao, "Todas")}</select></label>
      <label class="filtro"><span>Usuário</span>
        <select data-hist="historicoUsuario">${UI.opcoes(usuarios, estado.historicoUsuario, "Todos")}</select></label>
      <div class="filtros-marcas">
        <button class="marca-filtro" data-exportar-historico>Exportar planilha</button>
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo">
        <div><h2>Histórico de todos os sinistros</h2><p>${Util.plural(linhas.length, "registro", "registros")}</p></div>
      </div>
      ${linhas.length ? `<div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Data e horário</th><th>Sinistro</th><th>Usuário</th><th>Alteração</th><th>Detalhe</th><th>De → Para</th></tr></thead>
        <tbody>${linhas.slice(0, 400).map((h) => `<tr class="clicavel" data-abrir="${Util.esc(h.sinistroId)}">
          <td>${Util.esc(Util.fmtDataHora(h.criadoEm))}</td>
          <td><strong>${Util.esc(h.numero)}</strong><br /><small>${Util.esc(h.associado)}</small></td>
          <td>${Util.esc(h.usuario)}</td>
          <td>${Util.esc(h.acao)}</td>
          <td>${Util.esc(h.detalhe)}</td>
          <td>${h.de || h.para ? `${Util.esc(Util.ou(h.de, "—"))} → ${Util.esc(Util.ou(h.para, "—"))}` : "—"}</td>
        </tr>`).join("")}</tbody></table></div>
        ${linhas.length > 400 ? '<p class="detalhe" style="margin-top:10px;color:var(--cinza-texto)">Exibindo os 400 registros mais recentes. Use os filtros ou a busca para refinar.</p>' : ""}`
        : '<div class="vazio">Nenhum registro encontrado.</div>'}
    </div>`;
  }

  function ligarHistorico(raiz, estado, redesenhar) {
    $$("[data-hist]", raiz).forEach((sel) => {
      sel.addEventListener("change", () => { estado[sel.dataset.hist] = sel.value || null; redesenhar(); });
    });
    const exportar = $("[data-exportar-historico]", raiz);
    if (exportar) exportar.addEventListener("click", () => {
      const linhas = [["Data e horário", "Sinistro", "Associado", "Usuário", "Alteração", "Detalhe", "De", "Para"]];
      Dados.historicoGlobal().forEach((h) => linhas.push([
        Util.fmtDataHora(h.criadoEm), h.numero, h.associado, h.usuario, h.acao, h.detalhe, h.de, h.para,
      ]));
      Util.baixarCSV(`historico-sinistros-${Util.dataLocal()}.csv`, linhas);
      UI.sucesso("Histórico exportado.");
    });
  }

  /* ---------------------------------------------------------------- */
  /* Usuários                                                          */
  /* ---------------------------------------------------------------- */
  function usuarios() {
    if (!Dados.ehAdmin()) {
      return `<div class="cartao"><div class="vazio">
        Somente administradores podem gerenciar usuários.<br />
        Como atendente, você pode cadastrar, acompanhar, movimentar e concluir sinistros.
      </div></div>`;
    }

    const lista = Dados.listaUsuarios();
    return `
    <div class="cartao">
      <div class="cartao-topo">
        <div><h2>Usuários do sistema</h2><p>Administradores gerenciam tudo; atendentes não excluem registros nem usuários.</p></div>
        <button class="btn btn-verde" data-novo-usuario>+ Novo usuário</button>
      </div>
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Nome</th><th>Acesso</th><th>Perfil</th><th>Situação</th><th>Casos como atendente</th><th>Casos como responsável</th><th></th></tr></thead>
        <tbody>${lista.map((u) => {
          const comoAtendente = Dados.lista().filter((s) => s.atendente === u.nome).length;
          const comoResponsavel = Dados.lista().filter((s) => s.responsavel === u.nome).length;
          return `<tr>
            <td><strong>${Util.esc(u.nome)}</strong></td>
            <td>${Util.esc(u.usuario)}</td>
            <td>${u.perfil === "admin" ? '<span class="etiqueta azul">Administrador</span>' : '<span class="etiqueta cinza">Atendente</span>'}</td>
            <td>${u.ativo ? '<span class="etiqueta verde">Ativo</span>' : '<span class="etiqueta vermelha">Desativado</span>'}</td>
            <td class="num">${comoAtendente}</td>
            <td class="num">${comoResponsavel}</td>
            <td style="white-space:nowrap">
              <button class="btn btn-vazio btn-pequeno" data-editar-usuario="${Util.esc(u.id)}">Editar</button>
              <button class="btn btn-perigo-vazio btn-pequeno" data-excluir-usuario="${Util.esc(u.id)}">Excluir</button>
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Permissões</h2></div>
      <div class="grade-2">
        <div>
          <h3 style="font-size:14px;margin-bottom:6px">Administrador</h3>
          <p style="font-size:13.5px;color:var(--cinza-texto)">Cadastra, visualiza, edita, movimenta, conclui, reabre e exclui sinistros. Gerencia usuários, relatórios e configurações.</p>
        </div>
        <div>
          <h3 style="font-size:14px;margin-bottom:6px">Atendente</h3>
          <p style="font-size:13.5px;color:var(--cinza-texto)">Cadastra, visualiza, atualiza, movimenta e conclui sinistros. Não exclui registros nem gerencia usuários.</p>
        </div>
      </div>
    </div>`;
  }

  function formUsuario(u) {
    const usuario = u || {};
    return `<form id="form-usuario">
      <fieldset class="secao">
        <legend>Dados de acesso</legend>
        <div class="campo-linha">
          <label class="campo"><span>Nome completo <span class="obrig">*</span></span>
            <input name="nome" value="${Util.esc(usuario.nome || "")}" required /></label>
          <label class="campo"><span>Nome de acesso <span class="obrig">*</span></span>
            <input name="usuario" value="${Util.esc(usuario.usuario || "")}" required /></label>
          <label class="campo"><span>Senha ${usuario.id ? "(deixe vazio para manter)" : '<span class="obrig">*</span>'}</span>
            <input name="senha" type="text" placeholder="${usuario.id ? "••••••" : "Defina uma senha"}" /></label>
          <label class="campo"><span>Perfil</span>
            <select name="perfil">${UI.opcoes(Dados.PERFIS, usuario.perfil || "atendente")}</select></label>
        </div>
        <div style="margin-top:10px">
          <label class="campo-check"><input type="checkbox" name="ativo"${usuario.ativo !== false ? " checked" : ""} /> Usuário ativo</label>
        </div>
      </fieldset>
    </form>`;
  }

  function ligarUsuarios(raiz, redesenhar) {
    const abrirForm = (u) => {
      UI.abrirGaveta({
        titulo: u ? "Editar usuário" : "Novo usuário",
        subtitulo: "Administradores excluem registros; atendentes não.",
        corpo: formUsuario(u),
        rodape: `<button class="btn btn-vazio" data-acao="cancelar">Cancelar</button>
                 <div class="direita"><button class="btn btn-verde" data-acao="salvar">Salvar usuário</button></div>`,
        depois: (corpo, rodape) => {
          $('[data-acao="cancelar"]', rodape).addEventListener("click", UI.fecharGaveta);
          $('[data-acao="salvar"]', rodape).addEventListener("click", () => {
            const form = $("#form-usuario", corpo);
            const dados = Formularios.lerFormulario(form);
            if (u) dados.id = u.id;
            try {
              Dados.salvarUsuario(dados);
              UI.sucesso("Usuário salvo.");
              UI.fecharGaveta();
              redesenhar();
            } catch (e) { UI.erro(e.message); }
          });
        },
      });
    };

    const novo = $("[data-novo-usuario]", raiz);
    if (novo) novo.addEventListener("click", () => abrirForm(null));

    $$("[data-editar-usuario]", raiz).forEach((btn) => {
      btn.addEventListener("click", () => abrirForm(Dados.listaUsuarios().find((u) => u.id === btn.dataset.editarUsuario)));
    });

    $$("[data-excluir-usuario]", raiz).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const u = Dados.listaUsuarios().find((x) => x.id === btn.dataset.excluirUsuario);
        const ok = await UI.confirmar({
          titulo: "Excluir usuário",
          texto: `Excluir o acesso de ${u.nome}? Os sinistros em que aparece continuam registrados.`,
          rotulo: "Excluir", perigo: true,
        });
        if (!ok) return;
        try { Dados.excluirUsuario(u.id); UI.sucesso("Usuário excluído."); redesenhar(); }
        catch (e) { UI.erro(e.message); }
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Configurações                                                     */
  /* ---------------------------------------------------------------- */
  function configuracoes() {
    const c = Dados.config();
    const admin = Dados.ehAdmin();

    return `
    <div class="cartao">
      <div class="cartao-topo"><h2>Identificação</h2><p>Aparece nos relatórios impressos</p></div>
      <div class="campo-linha">
        <label class="campo"><span>Empresa</span><input data-config="empresa" value="${Util.esc(c.empresa)}" /></label>
        <label class="campo"><span>Setor</span><input data-config="setor" value="${Util.esc(c.setor)}" /></label>
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Alertas e prazos</h2><p>Quando o sistema deve avisar a equipe</p></div>
      <div class="campo-linha">
        <label class="campo"><span>Urgente sem atualização (horas)</span>
          <input type="number" min="1" data-config="horasUrgenteSemAtualizacao" value="${Number(c.horasUrgenteSemAtualizacao)}" /></label>
        <label class="campo"><span>Caso sem atualização (horas)</span>
          <input type="number" min="1" data-config="horasSemAtualizacao" value="${Number(c.horasSemAtualizacao)}" /></label>
        <label class="campo"><span>Caso parado (dias)</span>
          <input type="number" min="1" data-config="diasParado" value="${Number(c.diasParado)}" /></label>
        <label class="campo"><span>Sem contato com o associado (dias)</span>
          <input type="number" min="1" data-config="diasSemContato" value="${Number(c.diasSemContato)}" /></label>
        <label class="campo"><span>Tamanho máximo de anexo (MB)</span>
          <input type="number" min="1" max="5" data-config="limiteAnexoMB" value="${Number(c.limiteAnexoMB)}" /></label>
      </div>
      <div style="margin-top:12px"><button class="btn btn-verde" data-salvar-config>Salvar configurações</button></div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Backup dos dados</h2><p>Os sinistros ficam guardados neste navegador</p></div>
      <p style="font-size:13.5px;color:var(--cinza-texto)">
        Baixe uma cópia periodicamente. O arquivo pode ser importado em outro computador ou navegador.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-vazio" data-exportar-backup>Baixar backup (JSON)</button>
        <button class="btn btn-vazio" data-exportar-tudo>Exportar sinistros (planilha)</button>
        <label class="btn btn-vazio" style="position:relative;overflow:hidden">
          Importar backup
          <input type="file" accept="application/json,.json" data-importar-backup
                 style="position:absolute;inset:0;opacity:0;cursor:pointer" />
        </label>
        ${admin ? '<button class="btn btn-perigo-vazio" data-restaurar-demo>Recriar dados de demonstração</button>' : ""}
      </div>
    </div>`;
  }

  function ligarConfiguracoes(raiz, redesenhar) {
    const salvar = $("[data-salvar-config]", raiz);
    if (salvar) salvar.addEventListener("click", () => {
      const nova = {};
      $$("[data-config]", raiz).forEach((el) => {
        const chave = el.dataset.config;
        nova[chave] = el.type === "number" ? Math.max(1, Number(el.value) || 1) : el.value.trim();
      });
      Dados.salvarConfig(nova);
      UI.sucesso("Configurações salvas.");
      redesenhar();
    });

    const backup = $("[data-exportar-backup]", raiz);
    if (backup) backup.addEventListener("click", () => {
      Util.baixar(`backup-sattrack-plus-${Util.dataLocal()}.json`, Dados.exportarBackup(), "application/json");
      UI.sucesso("Backup gerado.");
    });

    const planilha = $("[data-exportar-tudo]", raiz);
    if (planilha) planilha.addEventListener("click", () => { Relatorios.exportarSinistros(Dados.lista()); });

    const importar = $("[data-importar-backup]", raiz);
    if (importar) importar.addEventListener("change", async () => {
      const arquivo = importar.files && importar.files[0];
      if (!arquivo) return;
      const ok = await UI.confirmar({
        titulo: "Importar backup",
        texto: "Os sinistros atuais deste navegador serão substituídos pelos do arquivo. Deseja continuar?",
        rotulo: "Importar", perigo: true,
      });
      if (!ok) { importar.value = ""; return; }
      const leitor = new FileReader();
      leitor.onload = () => {
        try { Dados.importarBackup(leitor.result); UI.sucesso("Backup importado."); redesenhar(); }
        catch (e) { UI.erro("Arquivo inválido: " + e.message); }
      };
      leitor.readAsText(arquivo);
    });

    const demo = $("[data-restaurar-demo]", raiz);
    if (demo) demo.addEventListener("click", async () => {
      const ok = await UI.confirmar({
        titulo: "Recriar dados de demonstração",
        texto: "Todos os sinistros atuais serão substituídos pelos cinco casos de exemplo. Essa ação não pode ser desfeita.",
        rotulo: "Recriar", perigo: true,
      });
      if (!ok) return;
      try { Dados.restaurarDemonstracao(); UI.sucesso("Base de demonstração recriada."); redesenhar(); }
      catch (e) { UI.erro(e.message); }
    });
  }

  return {
    tabelaHTML, ligarTabela, filtrosHTML, ligarFiltros,
    visaoGeral, prazos, historico, ligarHistorico,
    usuarios, ligarUsuarios, configuracoes, ligarConfiguracoes,
  };
})();

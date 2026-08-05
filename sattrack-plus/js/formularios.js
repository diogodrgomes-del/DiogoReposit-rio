/* ==================================================================
   Formulários — cadastro de sinistro e página interna do caso.
   Ambos vivem na gaveta lateral.
   ================================================================== */
const Formularios = (() => {

  const $ = UI.$;
  const $$ = UI.$$;

  let detalheId = null;
  let abaAtual = "resumo";

  /* ================================================================ */
  /* Cadastro / edição                                                 */
  /* ================================================================ */
  function campo(nome, rotulo, valor, opcoes) {
    const o = opcoes || {};
    const obrig = o.obrigatorio ? ' <span class="obrig" title="Campo obrigatório">*</span>' : "";
    const attrs = [
      `name="${nome}"`,
      `id="c-${nome}"`,
      o.tipo ? `type="${o.tipo}"` : 'type="text"',
      o.placeholder ? `placeholder="${Util.esc(o.placeholder)}"` : "",
      o.min != null ? `min="${o.min}"` : "",
      o.maxlength ? `maxlength="${o.maxlength}"` : "",
      o.inputmode ? `inputmode="${o.inputmode}"` : "",
      o.obrigatorio ? "required" : "",
    ].filter(Boolean).join(" ");

    return `<label class="campo${o.largo ? " campo-largo" : ""}">
      <span>${Util.esc(rotulo)}${obrig}</span>
      <input ${attrs} value="${Util.esc(valor == null ? "" : valor)}" />
      <em class="aviso-campo" data-erro="${nome}" hidden></em>
    </label>`;
  }

  function selecao(nome, rotulo, itens, valor, opcoes) {
    const o = opcoes || {};
    return `<label class="campo${o.largo ? " campo-largo" : ""}">
      <span>${Util.esc(rotulo)}${o.obrigatorio ? ' <span class="obrig">*</span>' : ""}</span>
      <select name="${nome}" id="c-${nome}">${UI.opcoes(itens, valor, o.vazio)}</select>
      <em class="aviso-campo" data-erro="${nome}" hidden></em>
    </label>`;
  }

  function area(nome, rotulo, valor, placeholder) {
    return `<label class="campo campo-largo">
      <span>${Util.esc(rotulo)}</span>
      <textarea name="${nome}" id="c-${nome}" placeholder="${Util.esc(placeholder || "")}">${Util.esc(valor || "")}</textarea>
      <em class="aviso-campo" data-erro="${nome}" hidden></em>
    </label>`;
  }

  function marcador(nome, rotulo, marcado) {
    return `<label class="campo-check"><input type="checkbox" name="${nome}" id="c-${nome}"${marcado ? " checked" : ""} /> ${Util.esc(rotulo)}</label>`;
  }

  function formularioHTML(sin) {
    const s = sin || {};
    const novo = !sin;
    const usuario = Dados.usuarioAtual();
    const pessoas = Dados.pessoas();

    return `<form id="form-sinistro" novalidate>
      <fieldset class="secao">
        <legend>Dados do registro</legend>
        <div class="campo-linha">
          ${campo("dataAtendimento", "Data do atendimento", s.dataAtendimento || Util.dataLocal(), { tipo: "date" })}
          ${campo("horaAtendimento", "Horário do atendimento", s.horaAtendimento || Util.horaLocal(), { tipo: "time" })}
          ${selecao("atendente", "Nome da atendente", pessoas, s.atendente || (usuario ? usuario.nome : ""), { obrigatorio: true, vazio: "Selecione…" })}
          ${selecao("responsavel", "Responsável pelo caso", pessoas, s.responsavel || "", { obrigatorio: true, vazio: "Selecione…" })}
          ${selecao("status", novo ? "Status inicial" : "Status", Dados.STATUS, s.status || "entrou")}
          ${selecao("prioridade", "Nível de prioridade", Dados.PRIORIDADES, s.prioridade || "normal")}
        </div>
      </fieldset>

      <fieldset class="secao">
        <legend>Dados do associado</legend>
        <div class="campo-linha">
          ${campo("associado", "Nome completo do associado", s.associado, { obrigatorio: true, largo: true, placeholder: "Ex.: Maria Aparecida da Silva" })}
          ${campo("whatsapp", "Número do WhatsApp", s.whatsapp, { obrigatorio: true, placeholder: "(00) 00000-0000", inputmode: "tel" })}
          ${campo("documento", "CPF ou documento", s.documento, { placeholder: "000.000.000-00" })}
          ${campo("contrato", "Número do contrato ou associação", s.contrato, { placeholder: "Opcional" })}
        </div>
      </fieldset>

      <fieldset class="secao">
        <legend>Dados do incidente</legend>
        <div class="campo-linha">
          ${campo("dataIncidente", "Data do incidente", s.dataIncidente || Util.dataLocal(), { tipo: "date", obrigatorio: true })}
          ${campo("horaIncidente", "Horário do incidente", s.horaIncidente || Util.horaLocal(), { tipo: "time", obrigatorio: true })}
          ${campo("local", "Local do incidente", s.local, { largo: true, placeholder: "Rua, número, cidade e estado" })}
          ${selecao("tipo", "Tipo de sinistro", Dados.TIPOS, s.tipo || "Colisão")}
          ${campo("vitimas", "Quantidade de vítimas", s.vitimas == null ? 0 : s.vitimas, { tipo: "number", min: 0, inputmode: "numeric" })}
          ${campo("veiculosEnvolvidos", "Veículos envolvidos", s.veiculosEnvolvidos == null ? 1 : s.veiculosEnvolvidos, { tipo: "number", min: 0, inputmode: "numeric" })}
          ${campo("numeroBO", "Número do boletim de ocorrência", s.numeroBO, { placeholder: "Preencher quando houver BO" })}
        </div>
        ${area("descricao", "Descrição completa do ocorrido", s.descricao, "Relato do associado, danos observados, envolvidos e providências já tomadas.")}
        <div class="campo-linha" style="margin-top:10px">
          ${marcador("temBO", "Existe boletim de ocorrência", s.temBO)}
          ${marcador("guincho", "Necessidade de guincho", s.guincho)}
          ${marcador("atendimentoMedico", "Necessidade de atendimento médico", s.atendimentoMedico)}
        </div>
      </fieldset>

      <fieldset class="secao">
        <legend>Dados do veículo protegido</legend>
        <div class="campo-linha">
          ${campo("placa", "Placa", s.placa, { obrigatorio: true, placeholder: "ABC1D23", maxlength: 8 })}
          ${campo("marca", "Marca", s.marca, { placeholder: "Ex.: Volkswagen" })}
          ${campo("modelo", "Modelo", s.modelo, { placeholder: "Ex.: Polo 1.0 TSI" })}
          ${campo("ano", "Ano", s.ano, { placeholder: "Ex.: 2022", inputmode: "numeric", maxlength: 9 })}
          ${campo("cor", "Cor", s.cor, { placeholder: "Ex.: Prata" })}
        </div>
      </fieldset>

      <fieldset class="secao">
        <legend>Dados do sinistro</legend>
        <div class="campo-linha">
          ${campo("numero", "Número do sinistro", s.numero || Dados.proximoNumeroSinistro(), { obrigatorio: true })}
          ${campo("protocolo", "Número do protocolo", s.protocolo || Dados.proximoProtocolo())}
          ${selecao("classificacao", "Classificação do sinistro", Dados.CLASSIFICACOES, s.classificacao || "Em análise")}
          ${campo("prestador", "Seguradora, oficina ou prestador", s.prestador, { largo: true, placeholder: "Quem está atendendo o caso" })}
        </div>
        ${area("observacoes", "Observações internas", s.observacoes, "Uso interno do Setor Plus.")}
      </fieldset>

      <fieldset class="secao">
        <legend>Prazos e pendências</legend>
        <div class="campo-linha">
          ${campo("proximaAcao", "Próxima ação", s.proximaAcao, { largo: true, placeholder: "O que precisa ser feito a seguir" })}
          ${campo("prazoRetorno", "Prazo para retorno", s.prazoRetorno, { tipo: "date" })}
        </div>
        <div style="margin-top:10px">${marcador("documentosPendentes", "Aguardando documentos do associado", s.documentosPendentes)}</div>
      </fieldset>
    </form>`;
  }

  /** Máscaras e travas de digitação. */
  function ligarMascaras(raiz) {
    const wpp = $("#c-whatsapp", raiz);
    if (wpp) wpp.addEventListener("input", () => { wpp.value = Util.mascaraTelefone(wpp.value); });

    const placa = $("#c-placa", raiz);
    if (placa) placa.addEventListener("input", () => { placa.value = Util.mascaraPlaca(placa.value); });

    const doc = $("#c-documento", raiz);
    if (doc) doc.addEventListener("input", () => { doc.value = Util.mascaraDocumento(doc.value); });

    ["vitimas", "veiculosEnvolvidos", "ano"].forEach((nome) => {
      const el = $("#c-" + nome, raiz);
      if (!el) return;
      el.addEventListener("input", () => { el.value = Util.soNumeros(el.value); });
    });
  }

  function lerFormulario(form) {
    const dados = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      dados[el.name] = el.type === "checkbox" ? el.checked : el.value;
    });
    return dados;
  }

  function mostrarErros(raiz, erros) {
    $$("[data-erro]", raiz).forEach((el) => { el.hidden = true; el.textContent = ""; });
    $$(".erro", raiz).forEach((el) => el.classList.remove("erro"));

    let primeiro = null;
    Object.keys(erros).forEach((campoNome) => {
      const alvo = $(`[data-erro="${campoNome}"]`, raiz);
      const entrada = $(`#c-${campoNome}`, raiz);
      if (alvo) { alvo.textContent = erros[campoNome]; alvo.hidden = false; }
      if (entrada) { entrada.classList.add("erro"); if (!primeiro) primeiro = entrada; }
    });
    if (primeiro) primeiro.scrollIntoView({ behavior: "smooth", block: "center" });
    UI.erro("Confira os campos obrigatórios destacados.");
  }

  function abrirCadastro(preset) {
    UI.abrirGaveta({
      titulo: "Cadastrar sinistro",
      subtitulo: "Campos marcados com <b>*</b> são obrigatórios.",
      corpo: formularioHTML(preset || null),
      rodape: `<button class="btn btn-vazio" data-acao="cancelar">Cancelar</button>
               <div class="direita">
                 <button class="btn btn-verde" data-acao="salvar-novo">Salvar sinistro</button>
               </div>`,
      depois: (corpo, rodape) => {
        ligarMascaras(corpo);
        $('[data-acao="cancelar"]', rodape).addEventListener("click", UI.fecharGaveta);
        $('[data-acao="salvar-novo"]', rodape).addEventListener("click", () => {
          const form = $("#form-sinistro", corpo);
          const r = Dados.criar(lerFormulario(form));
          if (!r.ok) return mostrarErros(corpo, r.erros);
          UI.sucesso(`Sinistro ${r.sinistro.numero} cadastrado.`);
          abrirDetalhe(r.sinistro.id);
        });
        const form = $("#form-sinistro", corpo);
        form.addEventListener("submit", (e) => e.preventDefault());
      },
    });
  }

  /* ================================================================ */
  /* Página interna do sinistro                                        */
  /* ================================================================ */
  function abrirDetalhe(id, aba) {
    detalheId = id;
    abaAtual = aba || "resumo";
    desenharDetalhe();
  }

  const ABAS = [
    { id: "resumo", nome: "Resumo" },
    { id: "acompanhamento", nome: "Acompanhamento do caso" },
    { id: "contatos", nome: "Contatos" },
    { id: "anexos", nome: "Documentos" },
    { id: "historico", nome: "Histórico do sinistro" },
    { id: "editar", nome: "Editar cadastro" },
  ];

  function desenharDetalhe() {
    const sin = Dados.obter(detalheId);
    if (!sin) { UI.fecharGaveta(); return; }

    const abas = `<div class="abas">${ABAS.map((a) =>
      `<button class="aba${a.id === abaAtual ? " ativa" : ""}" data-aba="${a.id}">${Util.esc(a.nome)}${
        a.id === "acompanhamento" ? ` (${(sin.acompanhamentos || []).length})` :
        a.id === "anexos" ? ` (${(sin.anexos || []).length})` :
        a.id === "contatos" ? ` (${(sin.contatos || []).length})` : ""
      }</button>`).join("")}</div>`;

    const corpos = {
      resumo: corpoResumo, acompanhamento: corpoAcompanhamento, contatos: corpoContatos,
      anexos: corpoAnexos, historico: corpoHistorico, editar: () => formularioHTML(sin),
    };

    UI.abrirGaveta({
      titulo: `${sin.associado}`,
      subtitulo: `${Util.esc(sin.numero)} · ${Util.esc(sin.tipo)} · Aberto há ${Util.esc(Util.tempoDesde(sin.criadoEm))}`,
      corpo: abas + `<div id="detalhe-corpo">${corpos[abaAtual](sin)}</div>`,
      rodape: rodapeDetalhe(sin),
      depois: (corpo, rodape) => ligarDetalhe(sin, corpo, rodape),
    });
  }

  function rodapeDetalhe(sin) {
    const admin = Dados.ehAdmin();
    const botoes = [];

    if (abaAtual === "editar") {
      botoes.push('<button class="btn btn-vazio" data-acao="cancelar-edicao">Cancelar</button>');
      botoes.push('<div class="direita"><button class="btn btn-verde" data-acao="salvar-edicao">Salvar alterações</button></div>');
      return botoes.join("");
    }

    botoes.push('<button class="btn btn-vazio" data-acao="fechar">Fechar</button>');
    if (admin) botoes.push(`<button class="btn btn-perigo-vazio" data-acao="excluir">Excluir</button>`);

    const direita = ['<button class="btn btn-azul-claro" data-acao="editar">Editar</button>'];
    if (sin.status !== "urgente" && sin.status !== "concluido") {
      direita.push('<button class="btn btn-vermelho" data-acao="urgente">Marcar como urgente</button>');
    }
    if (sin.status !== "resolvendo" && sin.status !== "concluido") {
      direita.push('<button class="btn" data-acao="resolvendo">Mover para resolvendo</button>');
    }
    if (sin.status === "concluido") {
      direita.push('<button class="btn btn-azul-claro" data-acao="reabrir">Reabrir caso</button>');
    } else {
      direita.push('<button class="btn btn-verde" data-acao="concluir">Concluir caso</button>');
    }
    botoes.push(`<div class="direita">${direita.join("")}</div>`);
    return botoes.join("");
  }

  /* --- Aba: resumo -------------------------------------------------- */
  function corpoResumo(sin) {
    const alertas = Dados.alertas(sin);
    const pessoas = Dados.pessoas();

    const faixaAlertas = alertas.length
      ? `<div class="cartao" style="border-left:4px solid var(--vermelho)">
           <div class="cartao-topo"><h2>Alertas do caso</h2></div>
           <div class="alertas-card">${alertas.map((a) =>
             `<span class="alerta-mini${a.nivel === "aviso" ? " aviso" : ""}">${a.nivel === "aviso" ? "•" : "!"} ${Util.esc(a.texto)}</span>`).join("")}</div>
         </div>`
      : "";

    return `
    <div class="cartao">
      <div class="cartao-topo">
        <div>
          <h2>${Util.esc(sin.associado)}</h2>
          <p>${Util.esc(sin.numero)} · Protocolo ${Util.esc(Util.ou(sin.protocolo))} · Aberto há ${Util.esc(Util.tempoDesde(sin.criadoEm))}</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${UI.etiquetaStatus(sin.status)} ${UI.etiquetaPrioridade(sin.prioridade)}
          ${Number(sin.vitimas) > 0 ? `<span class="etiqueta vermelha">${Util.plural(Number(sin.vitimas), "vítima", "vítimas")}</span>` : ""}
        </div>
      </div>
      <div class="campo-linha">
        <label class="campo"><span>Status</span>
          <select data-rapido="status">${UI.opcoes(Dados.STATUS, sin.status)}</select></label>
        <label class="campo"><span>Prioridade</span>
          <select data-rapido="prioridade">${UI.opcoes(Dados.PRIORIDADES, sin.prioridade)}</select></label>
        <label class="campo"><span>Atendente</span>
          <select data-rapido="atendente">${UI.opcoes(pessoas, sin.atendente, "Não informada")}</select></label>
        <label class="campo"><span>Responsável</span>
          <select data-rapido="responsavel">${UI.opcoes(pessoas, sin.responsavel, "Sem responsável")}</select></label>
      </div>
    </div>

    ${faixaAlertas}

    <div class="cartao">
      <div class="cartao-topo"><h2>Associado</h2></div>
      <div class="dados-grade">
        ${UI.dado("Nome completo", sin.associado)}
        ${UI.dado("WhatsApp", sin.whatsapp)}
        ${UI.dado("CPF ou documento", sin.documento)}
        ${UI.dado("Contrato/associação", sin.contrato)}
      </div>
      ${sin.whatsapp ? `<div style="margin-top:12px"><a class="btn btn-verde btn-pequeno" target="_blank" rel="noopener"
          href="https://wa.me/55${Util.esc(Util.soNumeros(sin.whatsapp))}">Abrir conversa no WhatsApp</a></div>` : ""}
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Incidente</h2></div>
      <div class="dados-grade">
        ${UI.dado("Data do incidente", Util.fmtData(sin.dataIncidente))}
        ${UI.dado("Horário do incidente", Util.fmtHora(sin.horaIncidente))}
        ${UI.dado("Tipo de sinistro", sin.tipo)}
        ${UI.dado("Classificação", sin.classificacao)}
        ${UI.dado("Local", sin.local)}
        ${UI.dado("Vítimas", sin.vitimas)}
        ${UI.dado("Veículos envolvidos", sin.veiculosEnvolvidos)}
        ${UI.dado("Boletim de ocorrência", sin.temBO ? Util.ou(sin.numeroBO, "Sim") : "Não")}
        ${UI.dado("Guincho", sin.guincho ? "Sim" : "Não")}
        ${UI.dado("Atendimento médico", sin.atendimentoMedico ? "Sim" : "Não")}
      </div>
      <div style="margin-top:12px">
        <div class="dado"><span>Descrição do ocorrido</span></div>
        <p style="white-space:pre-wrap;margin-top:4px">${Util.esc(Util.ou(sin.descricao, "Sem descrição registrada."))}</p>
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Veículo protegido</h2></div>
      <div class="dados-grade">
        ${UI.dado("Placa", sin.placa)}
        ${UI.dado("Marca", sin.marca)}
        ${UI.dado("Modelo", sin.modelo)}
        ${UI.dado("Ano", sin.ano)}
        ${UI.dado("Cor", sin.cor)}
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Registro e prazos</h2></div>
      <div class="dados-grade">
        ${UI.dado("Data do atendimento", Util.fmtData(sin.dataAtendimento))}
        ${UI.dado("Horário do atendimento", Util.fmtHora(sin.horaAtendimento))}
        ${UI.dado("Atendente", sin.atendente)}
        ${UI.dado("Responsável", sin.responsavel)}
        ${UI.dado("Seguradora/oficina/prestador", sin.prestador)}
        ${UI.dado("Próxima ação", sin.proximaAcao)}
        ${UI.dado("Prazo de retorno", sin.prazoRetorno ? Util.fmtData(sin.prazoRetorno) : "—")}
        ${UI.dado("Documentos pendentes", sin.documentosPendentes ? "Sim" : "Não")}
        ${UI.dado("Última atualização", Util.fmtDataHora(Dados.ultimaAtualizacao(sin)))}
        ${UI.dado("Concluído em", sin.concluidoEm ? Util.fmtDataHora(sin.concluidoEm) : "—")}
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Observações internas</h2></div>
      <p style="white-space:pre-wrap">${Util.esc(Util.ou(sin.observacoes, "Nenhuma observação registrada."))}</p>
      <div class="campo" style="margin-top:12px">
        <span>Adicionar observação</span>
        <textarea id="nova-observacao" placeholder="A observação fica carimbada com data, horário e autor."></textarea>
      </div>
      <div style="margin-top:8px"><button class="btn btn-verde btn-pequeno" data-acao="observacao">Adicionar observação</button></div>
    </div>`;
  }

  /* --- Aba: acompanhamento ------------------------------------------ */
  function corpoAcompanhamento(sin) {
    const usuario = Dados.usuarioAtual();
    const itens = (sin.acompanhamentos || []).slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));

    const lista = itens.length ? `<div class="linha-tempo">${itens.map((a) => `
      <div class="evento">
        <div class="evento-topo">
          <strong>${Util.esc(a.tipo)}</strong>
          <span class="etiqueta cinza">${Util.esc(a.autor)}</span>
          <span class="evento-quando">${Util.esc(Util.fmtData(a.data))} às ${Util.esc(Util.fmtHora(a.hora))}</span>
        </div>
        <p>${Util.esc(a.descricao)}</p>
        ${a.proximaAcao || a.prazoRetorno ? `<p class="detalhe">
          ${a.proximaAcao ? `<b>Próxima ação:</b> ${Util.esc(a.proximaAcao)}` : ""}
          ${a.prazoRetorno ? ` · <b>Prazo:</b> ${Util.esc(Util.fmtData(a.prazoRetorno))}` : ""}</p>` : ""}
        <div style="margin-top:8px"><button class="btn btn-perigo-vazio btn-pequeno" data-remover-acomp="${a.id}">Remover</button></div>
      </div>`).join("")}</div>`
      : `<div class="vazio">Nenhuma atualização registrada até agora.</div>`;

    return `
    <div class="cartao">
      <div class="cartao-topo">
        <div><h2>Registrar atualização</h2><p>Cada atualização entra no histórico do sinistro.</p></div>
      </div>
      <div class="campo-linha">
        <label class="campo"><span>Tipo de atualização</span>
          <select id="acomp-tipo">${UI.opcoes(Dados.TIPOS_ACOMPANHAMENTO, "Análise em andamento")}</select></label>
        <label class="campo"><span>Data</span><input type="date" id="acomp-data" value="${Util.dataLocal()}" /></label>
        <label class="campo"><span>Horário</span><input type="time" id="acomp-hora" value="${Util.horaLocal()}" /></label>
        <label class="campo"><span>Registrado por</span>
          <select id="acomp-autor">${UI.opcoes(Dados.pessoas(), usuario ? usuario.nome : "")}</select></label>
      </div>
      <div class="campo" style="margin-top:12px">
        <span>Descrição da atualização <span class="obrig">*</span></span>
        <textarea id="acomp-descricao" placeholder="O que foi feito, com quem foi falado, o que ficou definido."></textarea>
      </div>
      <div class="campo-linha" style="margin-top:12px">
        <label class="campo"><span>Próxima ação</span><input id="acomp-proxima" placeholder="O que precisa ser feito a seguir" /></label>
        <label class="campo"><span>Prazo para retorno</span><input type="date" id="acomp-prazo" /></label>
      </div>
      <div style="margin-top:12px"><button class="btn btn-verde" data-acao="add-acomp">Adicionar atualização</button></div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Acompanhamento do caso</h2><p>${Util.plural(itens.length, "atualização registrada", "atualizações registradas")}</p></div>
      ${lista}
    </div>`;
  }

  /* --- Aba: contatos ------------------------------------------------ */
  function corpoContatos(sin) {
    const itens = (sin.contatos || []).slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
    const lista = itens.length ? `<div class="linha-tempo">${itens.map((c) => `
      <div class="evento contato">
        <div class="evento-topo">
          <strong>${c.tipo === "associado" ? "Contato com o associado" : "Contato com oficina/prestador"}</strong>
          <span class="etiqueta cinza">${Util.esc(c.canal)}</span>
          <span class="evento-quando">${Util.esc(Util.fmtDataHora(c.criadoEm))}</span>
        </div>
        ${c.quem ? `<p class="detalhe"><b>Com:</b> ${Util.esc(c.quem)}</p>` : ""}
        <p>${Util.esc(c.resumo)}</p>
        <p class="detalhe">Registrado por ${Util.esc(c.autor)}</p>
      </div>`).join("")}</div>`
      : `<div class="vazio">Nenhum contato registrado.</div>`;

    return `
    <div class="cartao">
      <div class="cartao-topo"><h2>Registrar contato</h2></div>
      <div class="campo-linha">
        <label class="campo"><span>Tipo de contato</span>
          <select id="contato-tipo">
            <option value="associado">Associado</option>
            <option value="prestador">Oficina, seguradora ou prestador</option>
          </select></label>
        <label class="campo"><span>Canal</span>
          <select id="contato-canal">${UI.opcoes(["WhatsApp", "Telefone", "E-mail", "Presencial", "Outro"], "WhatsApp")}</select></label>
        <label class="campo"><span>Com quem</span><input id="contato-quem" placeholder="Nome de quem atendeu" /></label>
      </div>
      <div class="campo" style="margin-top:12px">
        <span>Resumo do contato <span class="obrig">*</span></span>
        <textarea id="contato-resumo" placeholder="O que foi tratado no contato."></textarea>
      </div>
      <div style="margin-top:12px"><button class="btn btn-verde" data-acao="add-contato">Registrar contato</button></div>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Contatos do caso</h2><p>${Util.plural(itens.length, "contato registrado", "contatos registrados")}</p></div>
      ${lista}
    </div>`;
  }

  /* --- Aba: anexos -------------------------------------------------- */
  function corpoAnexos(sin) {
    const limite = Dados.config().limiteAnexoMB;
    const itens = (sin.anexos || []).slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));

    const lista = itens.length ? `<div class="anexos">${itens.map((a) => `
      <div class="anexo">
        ${String(a.tipo).indexOf("image/") === 0
          ? `<img src="${Util.esc(a.conteudo)}" alt="${Util.esc(a.nome)}" />`
          : `<span class="anexo-icone">📄</span>`}
        <div class="anexo-info">
          <strong>${Util.esc(a.nome)}</strong>
          <small>${Util.esc(Util.tamanhoArquivo(a.tamanho))} · ${Util.esc(a.enviadoPor)} · ${Util.esc(Util.fmtDataHora(a.criadoEm))}</small>
        </div>
        <a class="btn btn-vazio btn-pequeno" href="${Util.esc(a.conteudo)}" download="${Util.esc(a.nome)}" target="_blank" rel="noopener">Abrir</a>
        <button class="btn btn-perigo-vazio btn-pequeno" data-remover-anexo="${a.id}">Remover</button>
      </div>`).join("")}</div>`
      : `<div class="vazio">Nenhum documento anexado.</div>`;

    return `
    <div class="cartao">
      <div class="cartao-topo"><h2>Anexar documento ou imagem</h2><p>Até ${limite} MB por arquivo.</p></div>
      <label class="campo">
        <span>Selecionar arquivos</span>
        <input type="file" id="anexo-arquivo" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
      </label>
      <p class="detalhe" style="color:var(--cinza-texto);font-size:12.5px;margin-top:8px">
        Fotos do veículo, boletim de ocorrência, CNH, orçamento da oficina e comprovantes.
      </p>
    </div>

    <div class="cartao">
      <div class="cartao-topo"><h2>Documentos do sinistro</h2><p>${Util.plural(itens.length, "arquivo", "arquivos")}</p></div>
      ${lista}
    </div>`;
  }

  /* --- Aba: histórico ----------------------------------------------- */
  function corpoHistorico(sin) {
    const itens = (sin.historico || []).slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
    if (!itens.length) return `<div class="cartao"><div class="vazio">Sem histórico.</div></div>`;

    return `<div class="cartao">
      <div class="cartao-topo"><h2>Histórico do sinistro</h2><p>Registro automático de tudo que aconteceu no caso.</p></div>
      <div class="linha-tempo">${itens.map((h) => `
        <div class="evento historico">
          <div class="evento-topo">
            <strong>${Util.esc(h.acao)}</strong>
            <span class="etiqueta cinza">${Util.esc(h.usuario)}</span>
            <span class="evento-quando">${Util.esc(Util.fmtDataHora(h.criadoEm))}</span>
          </div>
          <p>${Util.esc(h.detalhe)}</p>
          ${h.de || h.para ? `<p class="detalhe">${Util.esc(Util.ou(h.de, "—"))} → ${Util.esc(Util.ou(h.para, "—"))}</p>` : ""}
        </div>`).join("")}</div>
    </div>`;
  }

  /* --- Eventos do detalhe -------------------------------------------- */
  function ligarDetalhe(sin, corpo, rodape) {
    $$("[data-aba]", corpo).forEach((btn) => {
      btn.addEventListener("click", () => { abaAtual = btn.dataset.aba; desenharDetalhe(); });
    });

    if (abaAtual === "editar") ligarMascaras(corpo);

    // Alterações rápidas de status, prioridade, atendente e responsável.
    $$("[data-rapido]", corpo).forEach((sel) => {
      sel.addEventListener("change", () => {
        const campoNome = sel.dataset.rapido;
        const valor = sel.value;
        if (campoNome === "status") {
          if (valor === "concluido") return pedirConclusao(sin.id);
          if (sin.status === "concluido") return pedirReabertura(sin.id, valor);
          Dados.mover(sin.id, valor);
          UI.sucesso(`Movido para “${Dados.nomeStatus(valor)}”.`);
        } else if (campoNome === "prioridade") {
          Dados.alterarPrioridade(sin.id, valor);
          UI.sucesso(`Prioridade alterada para ${Dados.nomePrioridade(valor)}.`);
        } else {
          Dados.alterarPessoa(sin.id, campoNome, valor);
          UI.sucesso("Equipe do caso atualizada.");
        }
        desenharDetalhe();
      });
    });

    const clicar = (seletor, fn) => { const el = $(seletor, corpo) || $(seletor, rodape); if (el) el.addEventListener("click", fn); };

    clicar('[data-acao="observacao"]', () => {
      const txt = $("#nova-observacao", corpo);
      try {
        Dados.adicionarObservacao(sin.id, txt.value);
        UI.sucesso("Observação adicionada.");
        desenharDetalhe();
      } catch (e) { UI.erro(e.message); }
    });

    clicar('[data-acao="add-acomp"]', () => {
      try {
        Dados.adicionarAcompanhamento(sin.id, {
          tipo: $("#acomp-tipo", corpo).value,
          data: $("#acomp-data", corpo).value,
          hora: $("#acomp-hora", corpo).value,
          autor: $("#acomp-autor", corpo).value,
          descricao: $("#acomp-descricao", corpo).value,
          proximaAcao: $("#acomp-proxima", corpo).value,
          prazoRetorno: $("#acomp-prazo", corpo).value,
        });
        UI.sucesso("Atualização registrada.");
        desenharDetalhe();
      } catch (e) { UI.erro(e.message); }
    });

    $$("[data-remover-acomp]", corpo).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await UI.confirmar({ titulo: "Remover atualização", texto: "A atualização sai do acompanhamento, mas a remoção fica registrada no histórico.", rotulo: "Remover", perigo: true });
        if (!ok) return;
        Dados.removerAcompanhamento(sin.id, btn.dataset.removerAcomp);
        UI.sucesso("Atualização removida.");
        desenharDetalhe();
      });
    });

    clicar('[data-acao="add-contato"]', () => {
      try {
        Dados.adicionarContato(sin.id, {
          tipo: $("#contato-tipo", corpo).value,
          canal: $("#contato-canal", corpo).value,
          quem: $("#contato-quem", corpo).value,
          resumo: $("#contato-resumo", corpo).value,
        });
        UI.sucesso("Contato registrado.");
        desenharDetalhe();
      } catch (e) { UI.erro(e.message); }
    });

    const entradaAnexo = $("#anexo-arquivo", corpo);
    if (entradaAnexo) {
      entradaAnexo.addEventListener("change", async () => {
        const arquivos = Array.from(entradaAnexo.files || []);
        for (const arquivo of arquivos) {
          try {
            await Dados.adicionarAnexo(sin.id, arquivo);
            UI.sucesso(`“${arquivo.name}” anexado.`);
          } catch (e) { UI.erro(e.message); }
        }
        desenharDetalhe();
      });
    }

    $$("[data-remover-anexo]", corpo).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await UI.confirmar({ titulo: "Remover documento", texto: "O arquivo será apagado deste sinistro.", rotulo: "Remover", perigo: true });
        if (!ok) return;
        Dados.removerAnexo(sin.id, btn.dataset.removerAnexo);
        UI.sucesso("Documento removido.");
        desenharDetalhe();
      });
    });

    // Rodapé
    clicar('[data-acao="fechar"]', UI.fecharGaveta);
    clicar('[data-acao="editar"]', () => { abaAtual = "editar"; desenharDetalhe(); });
    clicar('[data-acao="cancelar-edicao"]', () => { abaAtual = "resumo"; desenharDetalhe(); });

    clicar('[data-acao="salvar-edicao"]', () => {
      const form = $("#form-sinistro", corpo);
      const r = Dados.atualizar(sin.id, lerFormulario(form));
      if (!r.ok) return mostrarErros(corpo, r.erros);
      UI.sucesso("Sinistro atualizado.");
      abaAtual = "resumo";
      desenharDetalhe();
    });

    clicar('[data-acao="urgente"]', () => {
      Dados.mover(sin.id, "urgente");
      UI.alerta("Caso marcado como urgente.");
      desenharDetalhe();
    });

    clicar('[data-acao="resolvendo"]', () => {
      Dados.mover(sin.id, "resolvendo");
      UI.sucesso("Caso movido para Resolvendo.");
      desenharDetalhe();
    });

    clicar('[data-acao="concluir"]', () => pedirConclusao(sin.id));
    clicar('[data-acao="reabrir"]', () => pedirReabertura(sin.id, "resolvendo"));

    clicar('[data-acao="excluir"]', async () => {
      const ok = await UI.confirmar({
        titulo: "Excluir sinistro",
        texto: `O cadastro ${sin.numero} — ${sin.associado} será apagado definitivamente, junto com o histórico e os anexos. Essa ação não pode ser desfeita.`,
        rotulo: "Excluir definitivamente", perigo: true,
      });
      if (!ok) return;
      try {
        Dados.excluir(sin.id);
        UI.sucesso("Sinistro excluído.");
        UI.fecharGaveta();
      } catch (e) { UI.erro(e.message); }
    });
  }

  async function pedirConclusao(id) {
    const sin = Dados.obter(id);
    const ok = await UI.confirmar({
      titulo: "Concluir caso",
      texto: `Confirmar a conclusão do sinistro ${sin.numero} — ${sin.associado}? O caso vai para a coluna “Caso concluído” e continua disponível para consulta.`,
      rotulo: "Concluir caso",
    });
    if (!ok) { desenharDetalhe(); return; }
    Dados.mover(id, "concluido");
    UI.sucesso("Caso concluído.");
    desenharDetalhe();
  }

  async function pedirReabertura(id, destino) {
    const sin = Dados.obter(id);
    const alvo = destino && destino !== "concluido" ? destino : "resolvendo";
    const ok = await UI.confirmar({
      titulo: "Reabrir caso",
      texto: `Reabrir o sinistro ${sin.numero} e mover para “${Dados.nomeStatus(alvo)}”?`,
      rotulo: "Reabrir caso",
    });
    if (!ok) { desenharDetalhe(); return; }
    Dados.mover(id, alvo);
    UI.sucesso("Caso reaberto.");
    desenharDetalhe();
  }

  return { abrirCadastro, abrirDetalhe, formularioHTML, ligarMascaras, lerFormulario, mostrarErros };
})();

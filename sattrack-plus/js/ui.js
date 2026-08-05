/* ==================================================================
   UI — avisos, confirmações, gaveta lateral e pedaços de HTML
   reaproveitados pelas telas.
   ================================================================== */
const UI = (() => {

  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

  /* ---------------------------------------------------------------- */
  /* Avisos                                                            */
  /* ---------------------------------------------------------------- */
  function aviso(texto, tipo) {
    const caixa = $("#avisos");
    const el = document.createElement("div");
    el.className = "aviso " + (tipo || "");
    el.textContent = texto;
    caixa.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 250);
    }, tipo === "erro" ? 5200 : 3200);
  }
  const sucesso = (t) => aviso(t, "sucesso");
  const erro = (t) => aviso(t, "erro");
  const alerta = (t) => aviso(t, "alerta");

  /* ---------------------------------------------------------------- */
  /* Confirmação (usada antes de excluir, concluir e reabrir)          */
  /* ---------------------------------------------------------------- */
  let confirmarResolver = null;

  function confirmar(opcoes) {
    const o = typeof opcoes === "string" ? { texto: opcoes } : (opcoes || {});
    $("#modal-titulo").textContent = o.titulo || "Confirmar";
    $("#modal-texto").textContent = o.texto || "";
    const btn = $("#modal-confirmar");
    btn.textContent = o.rotulo || "Confirmar";
    btn.className = "btn " + (o.perigo ? "btn-vermelho" : "btn-verde");
    $("#modal-fundo").hidden = false;
    btn.focus();
    return new Promise((resolve) => { confirmarResolver = resolve; });
  }

  function fecharModal(resposta) {
    $("#modal-fundo").hidden = true;
    if (confirmarResolver) { confirmarResolver(resposta); confirmarResolver = null; }
  }

  /* ---------------------------------------------------------------- */
  /* Gaveta lateral                                                    */
  /* ---------------------------------------------------------------- */
  let aoFecharGaveta = null;

  function abrirGaveta(opcoes) {
    $("#gaveta-titulo").textContent = opcoes.titulo || "";
    $("#gaveta-subtitulo").innerHTML = opcoes.subtitulo || "";
    $("#gaveta-corpo").innerHTML = opcoes.corpo || "";
    $("#gaveta-rodape").innerHTML = opcoes.rodape || "";
    $("#gaveta").hidden = false;
    $("#gaveta-fundo").hidden = false;
    document.body.style.overflow = "hidden";
    aoFecharGaveta = opcoes.aoFechar || null;
    if (typeof opcoes.depois === "function") opcoes.depois($("#gaveta-corpo"), $("#gaveta-rodape"));
  }

  function fecharGaveta() {
    $("#gaveta").hidden = true;
    $("#gaveta-fundo").hidden = true;
    document.body.style.overflow = "";
    $("#gaveta-corpo").innerHTML = "";
    $("#gaveta-rodape").innerHTML = "";
    const fn = aoFecharGaveta;
    aoFecharGaveta = null;
    if (fn) fn();
  }

  const gavetaAberta = () => !$("#gaveta").hidden;

  /* ---------------------------------------------------------------- */
  /* Pedaços de HTML reaproveitados                                    */
  /* ---------------------------------------------------------------- */
  const etiquetaPrioridade = (p) =>
    `<span class="etiqueta ${Util.esc(p)}${p === "urgente" ? " pulsa" : ""}">${Util.esc(Dados.nomePrioridade(p))}</span>`;

  const etiquetaStatus = (s) =>
    `<span class="etiqueta ${Util.esc(Dados.corStatus(s))}">${Util.esc(Dados.nomeStatus(s))}</span>`;

  const dado = (rotulo, valor) =>
    `<div class="dado"><span>${Util.esc(rotulo)}</span><strong>${Util.esc(Util.ou(valor))}</strong></div>`;

  function opcoes(itens, selecionado, vazio) {
    const inicio = vazio ? `<option value="">${Util.esc(vazio)}</option>` : "";
    return inicio + itens.map((i) => {
      const valor = typeof i === "string" ? i : i.id;
      const nome = typeof i === "string" ? i : i.nome;
      return `<option value="${Util.esc(valor)}"${Util.normalizar(valor) === Util.normalizar(selecionado) ? " selected" : ""}>${Util.esc(nome)}</option>`;
    }).join("");
  }

  /** Barra proporcional usada nos relatórios e na visão geral. */
  function barra(valor, maximo, cor) {
    const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
    const cores = { vermelho: "var(--vermelho)", verde: "var(--verde)", amarelo: "var(--amarelo)" };
    return `<div class="barra-medida" title="${pct}%"><i style="width:${pct}%${cor ? `;background:${cores[cor] || cor}` : ""}"></i></div>`;
  }

  function alertasHTML(sin) {
    const lista = Dados.alertas(sin);
    if (!lista.length) return "";
    return `<div class="alertas-card">${lista.map((a) =>
      `<span class="alerta-mini${a.nivel === "aviso" ? " aviso" : ""}">${a.nivel === "aviso" ? "•" : "!"} ${Util.esc(a.texto)}</span>`
    ).join("")}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Ligações fixas                                                    */
  /* ---------------------------------------------------------------- */
  function iniciar() {
    $("#modal-cancelar").addEventListener("click", () => fecharModal(false));
    $("#modal-confirmar").addEventListener("click", () => fecharModal(true));
    $("#modal-fundo").addEventListener("click", (e) => { if (e.target.id === "modal-fundo") fecharModal(false); });
    $("#gaveta-fechar").addEventListener("click", fecharGaveta);
    $("#gaveta-fundo").addEventListener("click", fecharGaveta);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!$("#modal-fundo").hidden) fecharModal(false);
      else if (gavetaAberta()) fecharGaveta();
    });
  }

  return {
    $, $$, aviso, sucesso, erro, alerta, confirmar,
    abrirGaveta, fecharGaveta, gavetaAberta,
    etiquetaPrioridade, etiquetaStatus, dado, opcoes, barra, alertasHTML, iniciar,
  };
})();

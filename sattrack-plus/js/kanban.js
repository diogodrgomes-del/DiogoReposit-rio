/* ==================================================================
   Kanban — o coração do sistema.
   Quatro colunas, cards arrastáveis e movimentação salva na hora.
   No toque (celular/tablet), os botões de mover fazem o mesmo papel
   do arrastar.
   ================================================================== */
const Kanban = (() => {

  const $ = UI.$;
  const $$ = UI.$$;

  let arrastandoId = null;

  /* ---------------------------------------------------------------- */
  /* Card                                                              */
  /* ---------------------------------------------------------------- */
  function cardHTML(sin) {
    const veiculo = [sin.marca, sin.modelo].filter(Boolean).join(" ");
    const destinos = Dados.STATUS.filter((s) => s.id !== sin.status);

    return `<article class="card prioridade-${Util.esc(sin.prioridade)}${sin.status === "concluido" ? " concluido" : ""}"
      draggable="true" data-id="${Util.esc(sin.id)}" tabindex="0"
      aria-label="Sinistro ${Util.esc(sin.numero)} de ${Util.esc(sin.associado)}">

      <div class="card-topo">
        <div>
          <div class="card-nome">${Util.esc(sin.associado)}</div>
          <div class="card-numero">${Util.esc(sin.numero)}${sin.protocolo ? ` · ${Util.esc(sin.protocolo)}` : ""}</div>
        </div>
        ${UI.etiquetaPrioridade(sin.prioridade)}
      </div>

      <div class="card-linha">
        <span class="etiqueta azul">${Util.esc(sin.tipo)}</span>
        ${Number(sin.vitimas) > 0 ? `<span class="etiqueta vermelha">${Util.plural(Number(sin.vitimas), "vítima", "vítimas")}</span>` : ""}
        ${Number(sin.veiculosEnvolvidos) > 1 ? `<span class="etiqueta cinza">${Number(sin.veiculosEnvolvidos)} veículos</span>` : ""}
      </div>

      <div class="card-veiculo">
        <span class="placa">${Util.esc(Util.ou(sin.placa, "SEM PLACA"))}</span>
        <span>${Util.esc(Util.ou(veiculo, "Veículo não informado"))}</span>
      </div>

      <div class="card-linha">
        <span><b>Incidente:</b> ${Util.esc(Util.fmtData(sin.dataIncidente))} às ${Util.esc(Util.fmtHora(sin.horaIncidente))}</span>
      </div>
      <div class="card-linha">
        <span><b>Atendente:</b> ${Util.esc(Util.ou(sin.atendente))}</span>
        <span><b>Responsável:</b> ${Util.esc(Util.ou(sin.responsavel, "sem responsável"))}</span>
      </div>

      ${UI.alertasHTML(sin)}

      <div class="card-rodape">
        ${UI.etiquetaStatus(sin.status)}
        <span class="card-tempo">${sin.status === "concluido"
          ? `Concluído ${sin.concluidoEm ? "há " + Util.esc(Util.tempoDesde(sin.concluidoEm)) : ""}`
          : `Aberto há ${Util.esc(Util.tempoDesde(sin.criadoEm))}`}</span>
      </div>

      <div class="card-mover">
        ${destinos.map((d) => `<button class="btn btn-vazio btn-pequeno" data-mover="${d.id}" data-sin="${Util.esc(sin.id)}"
          title="Mover para ${Util.esc(d.nome)}">→ ${Util.esc(d.nome)}</button>`).join("")}
      </div>
    </article>`;
  }

  /* ---------------------------------------------------------------- */
  /* Quadro                                                            */
  /* ---------------------------------------------------------------- */
  function quadroHTML(sinistros) {
    return `<div class="quadro" id="quadro">${Dados.STATUS.map((coluna) => {
      const itens = sinistros
        .filter((s) => s.status === coluna.id)
        .sort(ordenar);

      return `<section class="coluna" data-status="${coluna.id}">
        <header class="coluna-topo">
          <h3>${Util.esc(coluna.nome)}</h3>
          <span class="contador">${itens.length}</span>
        </header>
        <div class="coluna-lista" data-lista="${coluna.id}">
          ${itens.length ? itens.map(cardHTML).join("") : `<div class="vazio">Nenhum sinistro nesta etapa.</div>`}
        </div>
      </section>`;
    }).join("")}</div>`;
  }

  /** Urgentes primeiro, depois prazo vencido, depois mais antigos no topo. */
  function ordenar(a, b) {
    const peso = (s) => (s.prioridade === "urgente" ? 0 : s.prioridade === "atencao" ? 1 : 2);
    if (peso(a) !== peso(b)) return peso(a) - peso(b);
    const venc = (s) => (Dados.prazoVencido(s) ? 0 : 1);
    if (venc(a) !== venc(b)) return venc(a) - venc(b);
    if (a.status === "concluido") return String(b.concluidoEm || "").localeCompare(String(a.concluidoEm || ""));
    return String(a.criadoEm).localeCompare(String(b.criadoEm));
  }

  /* ---------------------------------------------------------------- */
  /* Interação                                                         */
  /* ---------------------------------------------------------------- */
  function ligar(raiz) {
    $$(".card", raiz).forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        arrastandoId = card.dataset.id;
        card.classList.add("arrastando");
        try {
          e.dataTransfer.setData("text/plain", arrastandoId);
          e.dataTransfer.effectAllowed = "move";
        } catch (err) { /* navegadores antigos */ }
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("arrastando");
        arrastandoId = null;
        $$(".coluna-lista", raiz).forEach((l) => l.classList.remove("recebendo"));
      });

      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-mover]")) return;
        Formularios.abrirDetalhe(card.dataset.id);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          Formularios.abrirDetalhe(card.dataset.id);
        }
      });
    });

    $$("[data-mover]", raiz).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        mover(btn.dataset.sin, btn.dataset.mover);
      });
    });

    $$(".coluna-lista", raiz).forEach((lista) => {
      lista.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        lista.classList.add("recebendo");
      });
      lista.addEventListener("dragleave", (e) => {
        if (!lista.contains(e.relatedTarget)) lista.classList.remove("recebendo");
      });
      lista.addEventListener("drop", (e) => {
        e.preventDefault();
        lista.classList.remove("recebendo");
        let id = arrastandoId;
        try { id = e.dataTransfer.getData("text/plain") || arrastandoId; } catch (err) { /* ignora */ }
        if (id) mover(id, lista.dataset.lista);
      });
    });
  }

  /** Movimentação: conclusão e reabertura pedem confirmação; o resto salva direto. */
  async function mover(id, destino) {
    const sin = Dados.obter(id);
    if (!sin || sin.status === destino) return;

    if (destino === "concluido") {
      const ok = await UI.confirmar({
        titulo: "Concluir caso",
        texto: `Confirmar a conclusão do sinistro ${sin.numero} — ${sin.associado}? O caso continua guardado no sistema.`,
        rotulo: "Concluir caso",
      });
      if (!ok) { App.desenhar(); return; }
    } else if (sin.status === "concluido") {
      const ok = await UI.confirmar({
        titulo: "Reabrir caso",
        texto: `Reabrir o sinistro ${sin.numero} e mover para “${Dados.nomeStatus(destino)}”?`,
        rotulo: "Reabrir caso",
      });
      if (!ok) { App.desenhar(); return; }
    }

    Dados.mover(id, destino);
    if (destino === "concluido") UI.sucesso("Caso concluído.");
    else if (destino === "urgente") UI.alerta(`${sin.numero} movido para Caso urgente.`);
    else UI.sucesso(`${sin.numero} movido para “${Dados.nomeStatus(destino)}”.`);
  }

  return { quadroHTML, cardHTML, ligar, mover, ordenar };
})();

/* ==================================================================
   Relatórios — números do Setor Plus por período, com exportação
   em planilha (CSV) e em PDF (impressão do navegador).
   ================================================================== */
const Relatorios = (() => {

  const $ = UI.$;
  const $$ = UI.$$;

  const PERIODOS = [
    { id: "hoje", nome: "Hoje" },
    { id: "7", nome: "Últimos 7 dias" },
    { id: "30", nome: "Últimos 30 dias" },
    { id: "mes", nome: "Este mês" },
    { id: "mespassado", nome: "Mês passado" },
    { id: "ano", nome: "Este ano" },
    { id: "tudo", nome: "Todo o período" },
    { id: "personalizado", nome: "Personalizado" },
  ];

  /** Converte o período escolhido em duas datas (aaaa-mm-dd). */
  function intervalo(estado) {
    const hoje = new Date();
    const dia = (d) => Util.dataLocal(d);
    const menos = (n) => dia(new Date(Date.now() - n * 86400000));

    switch (estado.periodo) {
      case "hoje": return { de: dia(hoje), ate: dia(hoje) };
      case "7": return { de: menos(6), ate: dia(hoje) };
      case "30": return { de: menos(29), ate: dia(hoje) };
      case "mes": return { de: dia(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: dia(hoje) };
      case "mespassado": {
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        return { de: dia(inicio), ate: dia(fim) };
      }
      case "ano": return { de: dia(new Date(hoje.getFullYear(), 0, 1)), ate: dia(hoje) };
      case "personalizado": return { de: estado.relDe || "", ate: estado.relAte || "" };
      default: return { de: "", ate: "" };
    }
  }

  function selecionados(estado) {
    const { de, ate } = intervalo(estado);
    return Dados.lista().filter((s) => {
      const abertura = Util.dataLocal(Util.paraData(s.criadoEm));
      if (de && abertura < de) return false;
      if (ate && abertura > ate) return false;
      return true;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Blocos                                                            */
  /* ---------------------------------------------------------------- */
  function agrupar(lista, obterChave) {
    const mapa = new Map();
    lista.forEach((s) => {
      const chave = obterChave(s) || "Não informado";
      mapa.set(chave, (mapa.get(chave) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }

  function tabelaAgrupada(titulo, subtitulo, linhas, total) {
    const max = Math.max.apply(null, linhas.map((l) => l.valor).concat([1]));
    return `<div class="cartao">
      <div class="cartao-topo"><div><h2>${Util.esc(titulo)}</h2><p>${Util.esc(subtitulo || "")}</p></div></div>
      ${linhas.length ? `<div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>${Util.esc(titulo)}</th><th class="num">Sinistros</th><th class="num">Participação</th><th style="width:180px"></th></tr></thead>
        <tbody>${linhas.map((l) => `<tr>
          <td>${Util.esc(l.nome)}</td>
          <td class="num">${l.valor}</td>
          <td class="num">${total ? Math.round((l.valor / total) * 100) : 0}%</td>
          <td>${UI.barra(l.valor, max)}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : '<div class="vazio">Sem dados no período selecionado.</div>'}
    </div>`;
  }

  /** Distribuição por mês de abertura. */
  function porMes(lista) {
    const mapa = new Map();
    lista.forEach((s) => {
      const d = Util.paraData(s.criadoEm);
      if (!d) return;
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      mapa.set(chave, (mapa.get(chave) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([chave, valor]) => {
        const [ano, mes] = chave.split("-");
        return { nome: `${mes}/${ano}`, valor };
      });
  }

  /* ---------------------------------------------------------------- */
  /* Página                                                            */
  /* ---------------------------------------------------------------- */
  function pagina(estado) {
    const lista = selecionados(estado);
    const { de, ate } = intervalo(estado);
    const c = Dados.config();

    const concluidos = lista.filter((s) => s.status === "concluido");
    const pendentes = lista.filter((s) => s.status !== "concluido");
    const urgentes = lista.filter((s) => s.status === "urgente" || s.prioridade === "urgente");
    const comVitimas = lista.filter((s) => Number(s.vitimas) > 0);
    const vencidos = lista.filter(Dados.prazoVencido);

    const tempos = concluidos
      .filter((s) => s.concluidoEm)
      .map((s) => new Date(s.concluidoEm) - new Date(s.criadoEm))
      .filter((ms) => ms >= 0);
    const medio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    const totalVitimas = lista.reduce((soma, s) => soma + Number(s.vitimas || 0), 0);
    const totalVeiculos = lista.reduce((soma, s) => soma + Number(s.veiculosEnvolvidos || 0), 0);

    return `
    <div class="filtros nao-imprime">
      <label class="filtro"><span>Período</span>
        <select data-rel="periodo">${UI.opcoes(PERIODOS, estado.periodo || "30")}</select></label>
      <label class="filtro"><span>De</span>
        <input type="date" data-rel="relDe" value="${Util.esc(estado.relDe || de || "")}" /></label>
      <label class="filtro"><span>Até</span>
        <input type="date" data-rel="relAte" value="${Util.esc(estado.relAte || ate || "")}" /></label>
      <div class="filtros-marcas">
        <button class="marca-filtro" data-rel-csv>Exportar planilha (CSV)</button>
        <button class="marca-filtro" data-rel-pdf>Gerar PDF</button>
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-topo">
        <div>
          <h2>${Util.esc(c.empresa)} — ${Util.esc(c.setor)}</h2>
          <p>Relatório de sinistros · ${de ? Util.fmtData(de) : "início"} a ${ate ? Util.fmtData(ate) : "hoje"} · gerado em ${Util.fmtDataHora(Util.agoraISO())}</p>
        </div>
      </div>
      <div class="dados-grade">
        ${UI.dado("Sinistros no período", lista.length)}
        ${UI.dado("Casos concluídos", concluidos.length)}
        ${UI.dado("Casos pendentes", pendentes.length)}
        ${UI.dado("Casos urgentes", urgentes.length)}
        ${UI.dado("Casos com vítimas", comVitimas.length)}
        ${UI.dado("Total de vítimas", totalVitimas)}
        ${UI.dado("Veículos envolvidos", totalVeiculos)}
        ${UI.dado("Sinistros com prazo vencido", vencidos.length)}
        ${UI.dado("Tempo médio de resolução", medio ? Util.duracao(medio) : "—")}
      </div>
    </div>

    ${tabelaAgrupada("Sinistros por período (mês de abertura)", "Volume de casos abertos por mês", porMes(lista), lista.length)}
    ${tabelaAgrupada("Sinistros por tipo", "Natureza das ocorrências", agrupar(lista, (s) => s.tipo), lista.length)}
    ${tabelaAgrupada("Sinistros por atendente", "Quem registrou o atendimento", agrupar(lista, (s) => s.atendente), lista.length)}
    ${tabelaAgrupada("Sinistros por responsável", "Quem conduz o caso", agrupar(lista, (s) => s.responsavel), lista.length)}
    ${tabelaAgrupada("Sinistros por status", "Situação atual no quadro", agrupar(lista, (s) => Dados.nomeStatus(s.status)), lista.length)}
    ${tabelaAgrupada("Sinistros por classificação", "Enquadramento do caso", agrupar(lista, (s) => s.classificacao), lista.length)}

    <div class="cartao">
      <div class="cartao-topo"><div><h2>Casos urgentes</h2><p>${Util.plural(urgentes.length, "caso", "casos")}</p></div></div>
      ${Paginas.tabelaHTML(urgentes, { vazio: "Nenhum caso urgente no período." })}
    </div>

    <div class="cartao">
      <div class="cartao-topo"><div><h2>Casos com vítimas</h2><p>${Util.plural(comVitimas.length, "caso", "casos")} · ${Util.plural(totalVitimas, "vítima", "vítimas")}</p></div></div>
      ${Paginas.tabelaHTML(comVitimas, { vazio: "Nenhum caso com vítimas no período." })}
    </div>

    <div class="cartao">
      <div class="cartao-topo"><div><h2>Sinistros com prazo vencido</h2><p>${Util.plural(vencidos.length, "caso", "casos")}</p></div></div>
      ${Paginas.tabelaHTML(vencidos, { vazio: "Nenhum prazo vencido no período." })}
    </div>

    <div class="cartao">
      <div class="cartao-topo"><div><h2>Casos pendentes</h2><p>${Util.plural(pendentes.length, "caso em aberto", "casos em aberto")}</p></div></div>
      ${Paginas.tabelaHTML(pendentes, { vazio: "Nenhum caso pendente no período." })}
    </div>

    <div class="cartao">
      <div class="cartao-topo"><div><h2>Casos concluídos</h2><p>${Util.plural(concluidos.length, "caso", "casos")} · tempo médio ${medio ? Util.duracao(medio) : "—"}</p></div></div>
      ${Paginas.tabelaHTML(concluidos, { vazio: "Nenhum caso concluído no período.", colunaTempo: "Concluído" })}
    </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Exportação                                                        */
  /* ---------------------------------------------------------------- */
  const CABECALHO = [
    "Número", "Protocolo", "Status", "Prioridade", "Classificação",
    "Associado", "WhatsApp", "CPF/documento", "Contrato",
    "Data do incidente", "Hora do incidente", "Local", "Tipo", "Descrição",
    "Vítimas", "Veículos envolvidos", "Boletim de ocorrência", "Número do BO",
    "Guincho", "Atendimento médico",
    "Placa", "Marca", "Modelo", "Ano", "Cor",
    "Data do atendimento", "Hora do atendimento", "Atendente", "Responsável",
    "Prestador", "Próxima ação", "Prazo de retorno", "Documentos pendentes",
    "Aberto em", "Aberto há", "Última atualização", "Concluído em",
    "Atualizações", "Contatos", "Anexos", "Observações internas",
  ];

  function linhaCSV(s) {
    return [
      s.numero, s.protocolo, Dados.nomeStatus(s.status), Dados.nomePrioridade(s.prioridade), s.classificacao,
      s.associado, s.whatsapp, s.documento, s.contrato,
      Util.fmtData(s.dataIncidente), Util.fmtHora(s.horaIncidente), s.local, s.tipo, s.descricao,
      s.vitimas, s.veiculosEnvolvidos, s.temBO ? "Sim" : "Não", s.numeroBO,
      s.guincho ? "Sim" : "Não", s.atendimentoMedico ? "Sim" : "Não",
      s.placa, s.marca, s.modelo, s.ano, s.cor,
      Util.fmtData(s.dataAtendimento), Util.fmtHora(s.horaAtendimento), s.atendente, s.responsavel,
      s.prestador, s.proximaAcao, s.prazoRetorno ? Util.fmtData(s.prazoRetorno) : "", s.documentosPendentes ? "Sim" : "Não",
      Util.fmtDataHora(s.criadoEm), Util.tempoDesde(s.criadoEm), Util.fmtDataHora(Dados.ultimaAtualizacao(s)),
      s.concluidoEm ? Util.fmtDataHora(s.concluidoEm) : "",
      (s.acompanhamentos || []).length, (s.contatos || []).length, (s.anexos || []).length,
      String(s.observacoes || "").replace(/\s+/g, " "),
    ];
  }

  function exportarSinistros(lista, nome) {
    const linhas = [CABECALHO].concat(lista.map(linhaCSV));
    Util.baixarCSV(nome || `sinistros-${Util.dataLocal()}.csv`, linhas);
    UI.sucesso(`${Util.plural(lista.length, "sinistro exportado", "sinistros exportados")}.`);
  }

  function ligar(raiz, estado, redesenhar) {
    $$("[data-rel]", raiz).forEach((el) => {
      el.addEventListener("change", () => {
        const chave = el.dataset.rel;
        estado[chave] = el.value;
        if (chave === "relDe" || chave === "relAte") estado.periodo = "personalizado";
        redesenhar();
      });
    });

    const csv = $("[data-rel-csv]", raiz);
    if (csv) csv.addEventListener("click", () => {
      const { de, ate } = intervalo(estado);
      exportarSinistros(selecionados(estado), `relatorio-sinistros-${de || "inicio"}-a-${ate || Util.dataLocal()}.csv`);
    });

    const pdf = $("[data-rel-pdf]", raiz);
    if (pdf) pdf.addEventListener("click", () => {
      UI.aviso("Escolha “Salvar como PDF” na janela de impressão.");
      setTimeout(() => window.print(), 350);
    });
  }

  return { pagina, ligar, exportarSinistros, selecionados, intervalo, PERIODOS };
})();

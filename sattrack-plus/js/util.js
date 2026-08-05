/* ==================================================================
   Util — formatação, máscaras e apoio geral.
   Tudo em pt-BR: o sistema é usado por uma equipe brasileira.
   ================================================================== */
const Util = (() => {

  /* ---------------------------------------------------------------- */
  /* Identificadores                                                   */
  /* ---------------------------------------------------------------- */
  function id(prefixo) {
    return (prefixo || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------------------------------------------------------- */
  /* Datas e horários                                                  */
  /* ---------------------------------------------------------------- */
  const agora = () => new Date();
  const agoraISO = () => new Date().toISOString();

  /** "2026-08-04" no fuso local (input type=date). */
  function dataLocal(d) {
    const x = d || new Date();
    const mes = String(x.getMonth() + 1).padStart(2, "0");
    const dia = String(x.getDate()).padStart(2, "0");
    return `${x.getFullYear()}-${mes}-${dia}`;
  }

  /** "16:20" no fuso local (input type=time). */
  function horaLocal(d) {
    const x = d || new Date();
    return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  }

  /** Junta "2026-08-04" + "16:20" num Date local. */
  function juntarDataHora(data, hora) {
    if (!data) return null;
    const [a, m, d] = data.split("-").map(Number);
    const [h, min] = (hora || "00:00").split(":").map(Number);
    const dt = new Date(a, (m || 1) - 1, d || 1, h || 0, min || 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function paraData(valor) {
    if (!valor) return null;
    const d = valor instanceof Date ? valor : new Date(valor);
    return isNaN(d.getTime()) ? null : d;
  }

  /** 04/08/2026 */
  function fmtData(valor) {
    if (!valor) return "—";
    if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      const [a, m, d] = valor.split("-");
      return `${d}/${m}/${a}`;
    }
    const d = paraData(valor);
    return d ? d.toLocaleDateString("pt-BR") : "—";
  }

  /** 16:20 */
  function fmtHora(valor) {
    if (!valor) return "—";
    if (typeof valor === "string" && /^\d{2}:\d{2}/.test(valor)) return valor.slice(0, 5);
    const d = paraData(valor);
    return d ? horaLocal(d) : "—";
  }

  /** 04/08/2026 às 16h20 — formato usado no histórico. */
  function fmtDataHora(valor) {
    const d = paraData(valor);
    if (!d) return "—";
    return `${d.toLocaleDateString("pt-BR")} às ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  }

  /** "20 minutos", "4 horas", "3 dias" — sem o prefixo. */
  function duracao(ms) {
    const min = Math.max(0, Math.floor(ms / 60000));
    if (min < 1) return "menos de 1 minuto";
    if (min < 60) return min === 1 ? "1 minuto" : `${min} minutos`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return horas === 1 ? "1 hora" : `${horas} horas`;
    const dias = Math.floor(horas / 24);
    if (dias < 30) return dias === 1 ? "1 dia" : `${dias} dias`;
    const meses = Math.floor(dias / 30);
    return meses === 1 ? "1 mês" : `${meses} meses`;
  }

  /** "Aberto há 4 horas" a partir de uma data de referência. */
  function tempoDesde(valor) {
    const d = paraData(valor);
    if (!d) return "—";
    return duracao(Date.now() - d.getTime());
  }

  function horasDesde(valor) {
    const d = paraData(valor);
    if (!d) return Infinity;
    return (Date.now() - d.getTime()) / 3600000;
  }

  function mesmoDia(a, b) {
    const x = paraData(a), y = paraData(b);
    if (!x || !y) return false;
    return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  }

  /* ---------------------------------------------------------------- */
  /* Máscaras e normalizações                                          */
  /* ---------------------------------------------------------------- */
  const soNumeros = (v) => String(v || "").replace(/\D+/g, "");

  /** (11) 98765-4321 — máscara brasileira, com 10 ou 11 dígitos. */
  function mascaraTelefone(valor) {
    const n = soNumeros(valor).slice(0, 11);
    if (n.length <= 2) return n.length ? `(${n}` : "";
    if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }

  /** 123.456.789-01 quando parecer CPF; caso contrário devolve como veio. */
  function mascaraDocumento(valor) {
    const bruto = String(valor || "");
    const n = soNumeros(bruto);
    if (n.length !== bruto.replace(/[.\-\/\s]/g, "").length) return bruto; // tem letras: outro documento
    const c = n.slice(0, 11);
    if (c.length <= 3) return c;
    if (c.length <= 6) return `${c.slice(0, 3)}.${c.slice(3)}`;
    if (c.length <= 9) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6)}`;
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }

  /** Placa sempre em maiúsculas: ABC1D23 / ABC-1234. */
  function mascaraPlaca(valor) {
    return String(valor || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);
  }

  /** Texto sem acentos e em minúsculas — usado na busca. */
  function normalizar(texto) {
    return String(texto == null ? "" : texto)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim();
  }

  function inteiro(valor, minimo) {
    const n = parseInt(soNumeros(valor), 10);
    const piso = minimo == null ? 0 : minimo;
    return isNaN(n) ? piso : Math.max(piso, n);
  }

  function tamanhoArquivo(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function iniciais(nome) {
    const partes = String(nome || "?").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  /* ---------------------------------------------------------------- */
  /* HTML                                                              */
  /* ---------------------------------------------------------------- */
  /** Escapa tudo que vem do usuário antes de entrar em innerHTML. */
  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Valor de exibição: cai para "—" quando vazio. */
  function ou(valor, alternativa) {
    const v = valor == null ? "" : String(valor).trim();
    return v === "" ? (alternativa || "—") : v;
  }

  function plural(n, singular, pluralPalavra) {
    return `${n} ${n === 1 ? singular : pluralPalavra}`;
  }

  /* ---------------------------------------------------------------- */
  /* Exportação de arquivos                                            */
  /* ---------------------------------------------------------------- */
  function baixar(nomeArquivo, conteudo, mime) {
    const blob = new Blob([conteudo], { type: (mime || "text/plain") + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /** CSV com ponto-e-vírgula e BOM: abre direto no Excel em pt-BR. */
  function baixarCSV(nomeArquivo, linhas) {
    const corpo = linhas
      .map((linha) => linha.map((celula) => {
        const v = celula == null ? "" : String(celula).replace(/"/g, '""');
        return `"${v}"`;
      }).join(";"))
      .join("\r\n");
    baixar(nomeArquivo, "﻿" + corpo, "text/csv");
  }

  return {
    id, agora, agoraISO, dataLocal, horaLocal, juntarDataHora, paraData,
    fmtData, fmtHora, fmtDataHora, duracao, tempoDesde, horasDesde, mesmoDia,
    soNumeros, mascaraTelefone, mascaraDocumento, mascaraPlaca, normalizar,
    inteiro, tamanhoArquivo, iniciais, esc, ou, plural, baixar, baixarCSV,
  };
})();

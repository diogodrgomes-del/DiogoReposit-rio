/* ==================================================================
   Gera o arquivo único: sattrack-plus.html

   Junta index.html, o CSS e todos os scripts num só arquivo, para
   abrir com dois cliques ou enviar por e-mail/WhatsApp sem depender
   de servidor nem de pastas.

   Uso:  node build.mjs
   ================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

// A mesma ordem do index.html: cada arquivo depende dos anteriores.
const SCRIPTS = [
  "js/util.js", "js/dados.js", "js/ui.js", "js/formularios.js",
  "js/kanban.js", "js/paginas.js", "js/relatorios.js", "js/app.js",
];

let html = ler("index.html");

const css = ler("css/estilos.css");
// Atenção: a substituição precisa ser feita por função. Numa string de
// substituição, "$$" vira "$" — e o código usa $$ para buscar elementos.
html = html.replace(
  '<link rel="stylesheet" href="css/estilos.css" />',
  () => `<style>\n${css}\n</style>`
);

const favicon = Buffer.from(ler("favicon.svg")).toString("base64");
html = html.replace(
  '<link rel="icon" href="favicon.svg" type="image/svg+xml" />',
  () => `<link rel="icon" href="data:image/svg+xml;base64,${favicon}" type="image/svg+xml" />`
);

const juntos = SCRIPTS
  .map((arquivo) => `/* ===== ${arquivo} ===== */\n${ler(arquivo)}`)
  .join("\n");
const marcacaoScripts = SCRIPTS.map((a) => `<script src="${a}"></script>`).join("\n");
html = html.replace(marcacaoScripts, () => `<script>\n${juntos}\n</script>`);

// O código embutido tem de chegar inteiro: se algum "$$" virar "$", o
// sistema quebra logo no carregamento com "Identifier '$' has already
// been declared".
const cifroesFonte = (juntos.match(/\$\$/g) || []).length;
const cifroesSaida = (html.match(/\$\$/g) || []).length;
if (cifroesSaida !== cifroesFonte) {
  console.error(`Código corrompido na junção: ${cifroesFonte} ocorrências de "$$" viraram ${cifroesSaida}.`);
  process.exit(1);
}

// Confere que nada externo sobrou na marcação. O conteúdo de <script> e
// <style> fica de fora: lá dentro há templates que montam data: URLs dos
// anexos em tempo de execução.
const marcacao = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "");
const pendentes = marcacao.match(/(src|href)="(?!data:)[^"]+"/g);
if (pendentes) {
  console.error("Sobraram referências a arquivos externos:", pendentes);
  process.exit(1);
}

const aviso = `<!--
  SatTrack Plus — Controle de Sinistros · Setor Plus
  Arquivo único gerado por build.mjs a partir dos fontes em sattrack-plus/.
  Não edite este arquivo à mão: altere os fontes e rode "node build.mjs".
-->
`;

const saida = path.join(RAIZ, "sattrack-plus.html");
fs.writeFileSync(saida, aviso + html);
console.log(`sattrack-plus.html gerado (${(fs.statSync(saida).size / 1024).toFixed(0)} KB)`);

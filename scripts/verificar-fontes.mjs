#!/usr/bin/env node
/**
 * Recusa byte de controle em arquivo-fonte.
 *
 * Existe porque um NUL (0x00) entrou uma vez num literal de string e o
 * sintoma apareceu longe da causa: o Postgres recusa NUL em texto, então a
 * busca global respondia 500 só para termos sem dígito. TypeScript, ESLint e
 * o build passaram — nenhum deles olha byte.
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const EXTENSOES = new Set([".ts", ".tsx", ".mjs", ".js", ".css", ".prisma", ".json"]);
const IGNORAR = new Set(["node_modules", ".next", ".git", "dist", "build"]);

/** Permitidos: tab (9), LF (10), CR (13). O resto não tem o que fazer aqui. */
const PERMITIDOS = new Set([9, 10, 13]);

async function* arquivos(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (IGNORAR.has(item.name)) continue;
    const caminho = join(dir, item.name);
    if (item.isDirectory()) yield* arquivos(caminho);
    else if (EXTENSOES.has(extname(item.name))) yield caminho;
  }
}

let problemas = 0;

for await (const caminho of arquivos(process.cwd())) {
  const bytes = readFileSync(caminho);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 32 && !PERMITIDOS.has(b)) {
      const linha = bytes.subarray(0, i).toString("utf8").split("\n").length;
      console.error(
        `${caminho}:${linha} — byte de controle 0x${b.toString(16).padStart(2, "0")}`
      );
      problemas++;
      break;
    }
  }
}

if (problemas > 0) {
  console.error(`\n${problemas} arquivo(s) com byte de controle.`);
  process.exit(1);
}

console.log("Nenhum byte de controle nos fontes.");

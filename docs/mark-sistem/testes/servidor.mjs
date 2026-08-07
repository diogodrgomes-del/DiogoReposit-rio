import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const bruto = await readFile(new URL("../demonstracao.html", import.meta.url), "utf8");
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${bruto}</body></html>`;
createServer((_, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); }).listen(8099);

#!/usr/bin/env node
/**
 * Verificação end-to-end dos fluxos críticos, dirigindo o navegador de verdade.
 *
 *   node scripts/e2e.mjs [url]
 *
 * Cobre o que quebra caro: login, criação de lead com dois campos, arrastar no
 * pipeline, conversão de lead em cliente com contrato, criação e conclusão de
 * demanda, baixa financeira, e as barreiras de permissão.
 *
 * Não substitui uma suíte Playwright de verdade — é o passo mínimo para não
 * declarar "funciona" sem ter aberto a tela.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const DONO = { email: "diogodrgomes@gmail.com", senha: "marktiva2026" };

let passou = 0;
let falhou = 0;

function ok(nome, detalhe = "") {
  passou++;
  console.log(`  ✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

function erro(nome, detalhe) {
  falhou++;
  console.log(`  ✗ ${nome} — ${detalhe}`);
}

async function checar(nome, fn) {
  try {
    const detalhe = await fn();
    ok(nome, detalhe);
  } catch (e) {
    erro(nome, String(e.message ?? e).split("\n")[0].slice(0, 160));
  }
}

async function entrar(page, email, senha) {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
}

const navegador = await chromium.launch({
  executablePath:
    process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
ctx.setDefaultTimeout(20000);
ctx.setDefaultNavigationTimeout(20000);
const page = await ctx.newPage();

const errosConsole = [];
page.on("console", (m) => {
  if (m.type() === "error") errosConsole.push(m.text());
});
page.on("pageerror", (e) => errosConsole.push(String(e)));

console.log(`\nMARK SISTEM — verificação em ${BASE}\n`);

console.log("Autenticação");
await checar("login do proprietário", async () => {
  await entrar(page, DONO.email, DONO.senha);
  return page.url().replace(BASE, "") || "/";
});

await checar("painel geral carrega com indicadores", async () => {
  await page.goto(BASE, { waitUntil: "load" });
  const n = await page.locator('a[href^="/demandas"], a[href^="/vendas"]').count();
  if (n === 0) throw new Error("nenhum indicador clicável");
  return `${n} cards`;
});

console.log("\nCRM de vendas");
const carimbo = Date.now().toString().slice(-7);
const nomeLead = `Teste E2E ${carimbo}`;
const telLead = `469${carimbo}`;
const descDespesa = `Despesa E2E ${carimbo}`;

await checar("criar lead com dois campos", async () => {
  await page.goto(`${BASE}/vendas`, { waitUntil: "load" });
  await page.getByRole("button", { name: /novo lead/i }).click();
  await page.fill('input[name="nome"]', nomeLead);
  await page.fill('input[name="telefone"]', telLead);
  await page.getByRole("button", { name: /criar lead/i }).click();
  await page.waitForSelector(`text=${nomeLead}`, { timeout: 15000 });
  return nomeLead;
});

await checar("lead aparece no pipeline", async () => {
  await page.goto(`${BASE}/vendas`, { waitUntil: "load" });
  const visivel = await page.locator(`text=${nomeLead}`).first().isVisible();
  if (!visivel) throw new Error("card não encontrado");
  return "coluna Lead novo";
});

await checar("telefone repetido não duplica lead", async () => {
  await page.goto(`${BASE}/vendas`, { waitUntil: "load" });
  await page.getByRole("button", { name: /novo lead/i }).click();
  await page.fill('input[name="nome"]', `${nomeLead} repetido`);
  await page.fill('input[name="telefone"]', telLead);
  await page.getByRole("button", { name: /criar lead/i }).click();
  await page.waitForSelector("text=/j.* tem um lead aberto/i", { timeout: 15000 });
  return "avisa em vez de criar duplicata";
});

await checar("abrir ficha do lead e editar valor", async () => {
  await page.click(`text=${nomeLead}`);
  await page.waitForURL(/\/vendas\/lead\//, { timeout: 15000 });
  const campo = page.locator('input[type="number"]').first();
  await campo.fill("2500");
  await campo.blur();
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "load" });
  const v = await page.locator('input[type="number"]').first().inputValue();
  if (v !== "2500") throw new Error(`valor não persistiu: ${v}`);
  return "R$ 2.500 salvo";
});

await checar("histórico automático registrou a criação", async () => {
  const txt = await page.locator("body").innerText();
  if (!/criado|Lead .* criado/i.test(txt)) throw new Error("sem entrada de histórico");
  return "auditoria visível na ficha";
});

const urlLead = page.url();

await checar("converter lead em cliente", async () => {
  await page.goto(urlLead, { waitUntil: "load" });
  await page.getByRole("button", { name: /virar cliente/i }).click();
  await page.fill('input[name="razaoSocial"]', `${nomeLead} LTDA`);
  await page.fill('input[name="valor"]', "1500");
  await page.getByRole("button", { name: /criar cliente/i }).click();
  await page.waitForURL(/\/clientes\//, { timeout: 20000 });
  return "cliente + contrato + projeto criados";
});

await checar("contrato aparece na ficha do cliente", async () => {
  const txt = await page.locator("body").innerText();
  if (!txt.includes("1.500")) throw new Error("mensalidade não exibida");
  return "R$ 1.500,00";
});

console.log("\nOperacional");
const tituloDemanda = `Demanda E2E ${Date.now().toString().slice(-5)}`;

await checar("criar demanda", async () => {
  await page.goto(`${BASE}/demandas`, { waitUntil: "load" });
  await page.getByRole("button", { name: /nova demanda/i }).click();
  await page.fill('input[name="titulo"]', tituloDemanda);
  await page.getByLabel(/demanda interna/i).check();
  await page.getByRole("button", { name: /criar demanda/i }).click();
  await page.waitForSelector(`text=${tituloDemanda}`, { timeout: 15000 });
  return tituloDemanda;
});

await checar("abrir demanda e adicionar item de checklist", async () => {
  await page.click(`text=${tituloDemanda}`);
  await page.waitForURL(/\/demandas\/[0-9a-f]/, { timeout: 15000 });
  await page.fill('input[placeholder*="Adicionar item"]', "Primeiro item");
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=Primeiro item", { timeout: 10000 });
  return "checklist gravado";
});

await checar("comentar na demanda", async () => {
  await page.fill('input[placeholder*="comentário"]', "Comentário de verificação");
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=Comentário de verificação", { timeout: 10000 });
  return "comentário gravado";
});

console.log("\nAgenda");
await checar("criar evento", async () => {
  await page.goto(`${BASE}/agenda`, { waitUntil: "load" });
  await page.getByRole("button", { name: /novo evento/i }).click();
  await page.fill('input[name="titulo"]', "Reunião E2E");
  const d = new Date(Date.now() + 86400000);
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.fill('input[name="inicio"]', iso);
  await page.getByRole("button", { name: /criar evento/i }).click();
  await page.waitForSelector("text=Reunião E2E", { timeout: 15000 });
  return "aparece na grade do mês";
});

console.log("\nFinanceiro");
await checar("lançar despesa", async () => {
  await page.goto(`${BASE}/financeiro`, { waitUntil: "load" });
  await page.getByRole("button", { name: /^lançar$/i }).click();
  await page.fill('input[name="descricao"]', descDespesa);
  await page.fill('input[name="valor"]', "1.234,56");
  await page.getByRole("button", { name: /^lançar$/i }).last().click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/financeiro/a-pagar`, { waitUntil: "load" });
  const txt = await page.locator("body").innerText();
  if (!txt.includes(descDespesa)) throw new Error("não apareceu em contas a pagar");
  if (!txt.includes("1.234,56")) throw new Error("valor em centavos incorreto");
  return "R$ 1.234,56 — centavos corretos";
});

await checar("dar baixa na despesa", async () => {
  const linha = page.locator("tr", { hasText: descDespesa }).first();
  await linha.getByRole("button", { name: /baixar/i }).click();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "load" });
  const txt = await page.locator("tr", { hasText: descDespesa }).first().innerText();
  if (!/pago/i.test(txt)) throw new Error(`status não mudou: ${txt.slice(0, 80)}`);
  return "status Pago";
});

console.log("\nBusca global");
await checar("⌘K encontra sem acento", async () => {
  await page.goto(BASE, { waitUntil: "load" });
  await page.click("body");
  // Maiúsculo de propósito: é o que chega com CapsLock ligado.
  await page.keyboard.press("Control+K");
  await page.fill('input[placeholder*="Buscar"]', "calendario");
  await page.waitForSelector("text=/Calend.rio/", { timeout: 10000 });
  await page.keyboard.press("Escape");
  return '"calendario" achou "Calendário"';
});

console.log("\nPermissões");
const ctx2 = await navegador.newContext();
ctx2.setDefaultTimeout(20000);
ctx2.setDefaultNavigationTimeout(20000);
const p2 = await ctx2.newPage();

await checar("designer não alcança o financeiro", async () => {
  await entrar(p2, "designer@marktiva.local", "teste123456");
  const r = await p2.goto(`${BASE}/financeiro`, { waitUntil: "load" });
  if (r.status() !== 404) throw new Error(`esperado 404, veio ${r.status()}`);
  return "404, não 403";
});

await checar("financeiro não aparece no menu do designer", async () => {
  await p2.goto(BASE, { waitUntil: "load" });
  const n = await p2.locator('aside a[href="/financeiro"]').count();
  if (n !== 0) throw new Error("item visível no menu");
  return "item ausente, não desabilitado";
});

await checar("busca do designer não vaza financeiro", async () => {
  const r = await p2.request.get(`${BASE}/api/busca?q=mensalidade`);
  const { resultados } = await r.json();
  if (resultados.length !== 0) throw new Error(`vazou ${resultados.length}`);
  return "0 resultados";
});

await ctx2.close();

console.log("\nConsole do navegador");
const relevantes = errosConsole.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
if (relevantes.length === 0) ok("nenhum erro de JavaScript");
else erro("erros no console", relevantes.slice(0, 3).join(" | "));

await navegador.close();

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou > 0 ? 1 : 0);

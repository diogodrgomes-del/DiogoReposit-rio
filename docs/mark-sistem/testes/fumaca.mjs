import { chromium } from "playwright";

const URL_APP = "http://127.0.0.1:8099/demonstracao.html";

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

const erros = [];
p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) erros.push("console: " + m.text()); });

await p.goto(URL_APP, { waitUntil: "networkidle" });

const checar = async (nome, fn) => {
  try { const r = await fn(); console.log(`  ${r ? "✓" : "✗"} ${nome}`); return r; }
  catch (e) { console.log(`  ✗ ${nome} — ${e.message}`); return false; }
};

let tudo = true;
const reg = async (n, f) => { tudo = (await checar(n, f)) && tudo; };

console.log("\nPAINEL");
await reg("renderiza o painel", async () => (await p.locator("h1").innerText()).startsWith("Olá"));
await reg("mostra indicadores", async () => (await p.locator(".indicador").count()) >= 8);
await reg("lista o que precisa de atenção", async () => await p.locator("text=Precisa de você hoje").isVisible());

console.log("\nPIPELINE");
await p.click('a[href="#/vendas"]');
await p.waitForTimeout(300);
await reg("abre o quadro", async () => (await p.locator(".quadro__coluna").count()) === 8);
await reg("tem cards", async () => (await p.locator(".card").count()) >= 8);

const antesLeadNovo = await p.locator('[data-cards="e1"] .card').count();

console.log("\nCRIAR LEAD");
await p.click('[data-acao="novo-lead"]');
await reg("abre o modal", async () => await p.locator(".modal").isVisible());

// Telefone invalido tem de ser recusado com mensagem util.
const M = p.locator(".modal");
await M.locator('input[name="nome"]').fill("Teste Recusa");
await M.locator('input[name="telefone"]').fill("123");
await M.locator('button[type="submit"]').click();
await reg("recusa telefone invalido", async () => (await p.locator(".aviso-erro").innerText()).includes("DDD"));

await M.locator('input[name="telefone"]').fill("44 98888-1234");
await M.locator('input[name="empresa"]').fill("Empresa Teste");
await M.locator('input[name="valorEstimado"]').fill("1500");
await M.locator('button[type="submit"]').click();
await p.waitForTimeout(300);
await reg("vai para a ficha do lead", async () => (await p.locator("h1").innerText()) === "Teste Recusa");
await reg("normaliza o telefone", async () => (await p.locator("body").innerText()).includes("(44) 98888-1234"));

console.log("\nATIVIDADE");
await p.locator('form[data-form="nova-atividade"] input[name="titulo"]').fill("Ligar amanhã de manhã");
await p.click('form[data-form="nova-atividade"] button[type="submit"]');
await p.waitForTimeout(250);
await reg("registra a atividade", async () => (await p.locator("body").innerText()).includes("Ligar amanhã de manhã"));

console.log("\nCONVERTER EM CLIENTE");
await p.click('form[data-form="converter"] button[type="submit"]');
await p.waitForTimeout(500);
await reg("cria o cliente", async () => (await p.locator("h1").innerText()) === "Empresa Teste");
await reg("mantém o telefone do contato", async () => (await p.locator("body").innerText()).includes("(44) 98888-1234"));
await reg("registra a origem", async () => (await p.locator("body").innerText()).toLowerCase().includes("veio do lead"));

console.log("\nARRASTAR CARD");
await p.click('a[href="#/vendas"]');
await p.waitForTimeout(200);
const depoisConversao = await p.locator('[data-cards="e1"] .card').count();
await reg("o lead saiu da primeira coluna ao virar cliente", async () => depoisConversao === antesLeadNovo);

// Arrasto via eventos de DnD (o mouse nao dispara HTML5 drag em headless).
const moveu = await p.evaluate(() => {
  const card = document.querySelector('[data-cards="e1"] .card');
  const destino = document.querySelector('[data-etapa="e3"]');
  if (!card || !destino) return false;
  const id = card.dataset.lead;
  const dt = new DataTransfer();
  card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
  destino.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  destino.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  return id;
});
await p.waitForTimeout(250);
await reg("card mudou de coluna", async () =>
  (await p.locator(`[data-cards="e3"] [data-lead="${moveu}"]`).count()) === 1);
await reg("a mudança entra no histórico", async () => {
  await p.click(`[data-lead="${moveu}"] .card__nome`);
  await p.waitForTimeout(250);
  return (await p.locator("body").innerText()).includes("Reunião agendada");
});

console.log("\nBUSCA ⌘K");
await p.click('a[href="#/painel"]');
await p.keyboard.press("Control+k");
await p.waitForTimeout(150);
await reg("abre a busca", async () => await p.locator("#busca-campo").isVisible());
await p.fill("#busca-campo", "oticas gouvea");
await p.waitForTimeout(300);
await reg("acha apesar do acento e do erro", async () =>
  (await p.locator(".busca-item").first().innerText()).includes("Óticas Gouveia"));
await p.keyboard.press("Enter");
await p.waitForTimeout(300);
await reg("navega para o cliente", async () => (await p.locator("h1").innerText()) === "Óticas Gouveia");

console.log("\nCLIENTES");
await p.click('a[href="#/clientes"]');
await p.waitForTimeout(200);
await reg("lista clientes", async () => (await p.locator("tbody tr").count()) >= 6);
await p.fill('input[name="q"]', "carvalho");
await p.click('form[data-form="filtros-clientes"] button[type="submit"]');
await p.waitForTimeout(200);
await reg("filtra por texto", async () => (await p.locator("tbody tr").count()) === 1);

console.log("\nPERSISTÊNCIA");
// Sai da página antes de voltar: goto para a mesma URL com o mesmo hash é
// navegação no mesmo documento e não reexecuta o script — o filtro anterior
// ficaria de pé e o teste mediria a coisa errada.
await p.goto("about:blank");
await p.goto(URL_APP + "#/clientes", { waitUntil: "networkidle" });
await p.waitForTimeout(300);
const gravado = await p.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("mark-sistem-demo-v1") || "null"); } catch (e) { return null; }
});
console.log("    clientes no localStorage:", gravado ? gravado.clientes.map((c) => c.nome).join(", ") : "NADA");
await p.waitForTimeout(300);
await reg("os dados sobrevivem ao recarregar", async () =>
  (await p.locator("body").innerText()).includes("Empresa Teste"));

console.log("\nRESPONSIVO");
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(150);
await reg("não rola na horizontal no celular", async () =>
  await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

console.log("\n" + (erros.length ? "ERROS DE CONSOLE:\n  " + erros.join("\n  ") : "Nenhum erro de console."));
await navegador.close();
console.log(tudo && !erros.length ? "\n=== TUDO OK ===" : "\n=== FALHOU ===");
process.exit(tudo && !erros.length ? 0 : 1);

import { chromium } from "playwright";

const URL_APP = "http://127.0.0.1:8099/demonstracao.html";

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

const erros = [];
p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) erros.push("console: " + m.text()); });

await p.goto(URL_APP, { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.goto(URL_APP, { waitUntil: "networkidle" });

let tudo = true;
const reg = async (nome, fn) => {
  let ok = false;
  try { ok = Boolean(await fn()); }
  catch (e) { console.log(`  ✗ ${nome} — ${e.message}`); tudo = false; return false; }
  console.log(`  ${ok ? "✓" : "✗"} ${nome}`);
  tudo = ok && tudo;
  return ok;
};
const irPara = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(250); };

/* ------------------------------------------------------------- WhatsApp */
console.log("\nWHATSAPP");
await irPara("#/whatsapp");
await reg("lista as conversas", async () => (await p.locator(".caixa__item").count()) === 6);
await reg("abre a mais recente com o fio de mensagens", async () =>
  (await p.locator(".bolha").count()) >= 2);
await reg("mostra quem é o contato do outro lado", async () =>
  (await p.locator('.caixa__cabeca a:has-text("Lead")').count()) === 1);

const naoLidasAntes = await p.locator('a[href="#/whatsapp"] .pino').innerText();
await p.locator('.caixa__item:has-text("Vanessa Prado")').click();
await p.waitForTimeout(300);
await reg("abrir a conversa zera o não-lido", async () => {
  const agora = await p.locator('a[href="#/whatsapp"] .pino').count()
    ? await p.locator('a[href="#/whatsapp"] .pino').innerText() : "0";
  return Number(agora) === Number(naoLidasAntes) - 1;
});

const bolhasAntes = await p.locator(".bolha").count();
await p.fill('.caixa__responder textarea', "Oi! Depende do que você precisa — posso te explicar em 10 minutos?");
await p.click('.caixa__responder button[type="submit"]');
await p.waitForTimeout(300);
await reg("responder adiciona a mensagem no fio", async () =>
  (await p.locator(".bolha").count()) === bolhasAntes + 1);
await reg("a resposta sai como enviada", async () =>
  (await p.locator(".bolha--enviada").last().innerText()).includes("10 minutos"));

/* contato sem cadastro vira lead, reaproveitando o contato */
await reg("contato sem cadastro é sinalizado", async () =>
  (await p.locator('.caixa__item:has-text("Vanessa Prado") .selo--ambar').count()) === 1);
const contatosAntes = await p.evaluate(() => S.contatos.length);
await p.click('[data-acao="lead-da-conversa"]');
await p.waitForTimeout(400);
await reg("virar lead abre a ficha do lead", async () => (await p.url()).includes("#/lead/"));
await reg("não duplica o contato", async () =>
  (await p.evaluate(() => S.contatos.length)) === contatosAntes);
await reg("o lead novo mostra o botão de ver conversa", async () =>
  await p.locator('[data-acao="abrir-conversa-de"]').isVisible());

/* ------------------------------------------------------------ propostas */
console.log("\nPROPOSTAS");
await irPara("#/propostas");
await reg("lista as propostas", async () => (await p.locator("tbody tr").count()) === 3);
await reg("calcula a taxa de aceite", async () =>
  (await p.locator(".indicador:has-text('Taxa de aceite') .indicador__valor").innerText()).endsWith("%"));

await p.locator('td a[href^="#/proposta/"]').first().click();
await p.waitForTimeout(300);
await reg("abre a proposta com os itens", async () => (await p.locator("tbody tr").count()) >= 2);

/* somar item recalcula o total */
const totalAntes = await p.evaluate(() => {
  const id = location.hash.slice(11);
  return propostaDe(id).valor;
});
await p.fill('[data-form="item-proposta"] input[name="descricao"]', "Relatório mensal");
await p.fill('[data-form="item-proposta"] input[name="valor"]', "500");
await p.click('[data-form="item-proposta"] button[type="submit"]');
await p.waitForTimeout(300);
await reg("somar item recalcula o total pelos itens", async () =>
  (await p.evaluate((antes) => {
    const pr = propostaDe(location.hash.slice(11));
    return pr.valor === pr.itens.reduce((s, i) => s + i.valor, 0) && pr.valor === antes + 500;
  }, totalAntes)));

/* enviar rascunho move o lead de etapa */
await irPara("#/propostas");
await p.locator('tr:has-text("Rascunho") a[href^="#/proposta/"]').first().click();
await p.waitForTimeout(300);
const leadDaProposta = await p.evaluate(() => propostaDe(location.hash.slice(11)).leadId);
await p.click('[data-acao="enviar-proposta"]');
await p.waitForTimeout(400);
await reg("enviar move o lead para “Proposta enviada”", async () =>
  await p.evaluate((i) => leadDe(i).etapaId === "e5", leadDaProposta));
await reg("enviar define validade de 7 dias", async () =>
  await p.evaluate((i) => Boolean(S.propostas.find((x) => x.leadId === i && x.status === "enviada").validade), leadDaProposta));

/* aceitar fecha o lead */
await irPara("#/propostas");
await p.locator('tr:has-text("Enviada") a[href^="#/proposta/"]').first().click();
await p.waitForTimeout(300);
const leadAceito = await p.evaluate(() => propostaDe(location.hash.slice(11)).leadId);
await p.click('[data-acao="aceitar-proposta"]');
await p.waitForTimeout(400);
await reg("aceitar fecha o lead", async () =>
  await p.evaluate((i) => Boolean(leadDe(i).fechadoEm), leadAceito));
await reg("aceitar registra o valor no lead", async () =>
  await p.evaluate((i) => leadDe(i).valorEstimado > 0, leadAceito));

/* ---------------------------------------------------------------- mural */
console.log("\nMURAL");
await irPara("#/mural");
await reg("o aviso fixado vem primeiro", async () =>
  (await p.locator(".mural-item").first().innerText()).toLowerCase().includes("fixado"));
await p.locator('[data-form="comentar"] input').first().fill("Vale para renovação também?");
await p.locator('[data-form="comentar"] button').first().click();
await p.waitForTimeout(300);
await reg("comentar publica no aviso", async () =>
  await p.locator('.comentario:has-text("Vale para renovação também?")').isVisible());

await p.click('[data-acao="novo-aviso"]');
await p.fill('.modal input[name="titulo"]', "Reunião de time na sexta às 9h");
await p.fill('.modal textarea[name="texto"]', "Pauta: resultados de agosto e o que muda em setembro.");
await p.click('.modal button[type="submit"]');
await p.waitForTimeout(300);
await reg("publica aviso novo", async () =>
  await p.locator('.mural-item__titulo:has-text("Reunião de time na sexta")').isVisible());

/* ----------------------------------------------------------------- wiki */
console.log("\nWIKI");
await irPara("#/wiki");
await reg("lista os artigos", async () => (await p.locator(".fatia__cartao").count()) === 4);
await p.selectOption('select[name="categoria"]', "comercial");
await p.click('[data-form="filtros-wiki"] button[type="submit"]');
await p.waitForTimeout(250);
await reg("filtra por categoria", async () => (await p.locator(".fatia__cartao").count()) === 1);

await p.locator(".fatia__cartao").first().click();
await p.waitForTimeout(300);
await reg("abre o artigo com o texto inteiro", async () =>
  (await p.locator(".prosa").innerText()).includes("Quanto vale um cliente novo"));

/* ------------------------------------------------------------- pesquisa */
console.log("\nSATISFAÇÃO");
await irPara("#/pesquisa");
await reg("calcula o NPS", async () =>
  (await p.locator(".indicador:has-text('NPS') .indicador__valor").innerText()).match(/-?\d+/) !== null);
await reg("mostra a pesquisa pendente", async () => (await p.locator(".notas").count()) === 1);

const clientePendente = await p.evaluate(() => {
  const x = S.pesquisas.find((q) => q.nota === null);
  return x ? x.clienteId : null;
});
await p.locator('.nota:has-text("4")').first().click();
await p.waitForTimeout(400);
await reg("registrar nota baixa muda a saúde do cliente para risco", async () =>
  await p.evaluate((i) => clienteDe(i).saude === "vermelho", clientePendente));
await reg("a nota entra no histórico do cliente", async () =>
  await p.evaluate((i) => S.eventos.some((e) => e.entidadeId === i && e.tipo === "pesquisa.respondida"), clientePendente));
await reg("o NPS cai com o detrator novo", async () =>
  (await p.evaluate(() => nps())) < 50);

/* ---------------------------------------------------------------- lixeira */
console.log("\nLIXEIRA");
await irPara("#/lixeira");
await reg("começa vazia", async () =>
  (await p.locator(".estado__titulo").innerText()).includes("Lixeira vazia"));

await irPara("#/operacional");
await p.locator('[data-acao="editar-demanda"]').first().click();
await p.waitForTimeout(250);
const tituloExcluido = await p.inputValue('.modal input[name="titulo"]');
p.once("dialog", (d) => d.accept());
await p.click('[data-acao="excluir-demanda"]');
await p.waitForTimeout(400);
await reg("demanda excluída some do quadro", async () =>
  (await p.locator(`.card:has-text(${JSON.stringify(tituloExcluido)})`).count()) === 0);

await irPara("#/lixeira");
await reg("e aparece na lixeira", async () =>
  await p.locator(`td:has-text(${JSON.stringify(tituloExcluido)})`).isVisible());
await p.locator('[data-acao="restaurar"]').first().click();
await p.waitForTimeout(400);
await irPara("#/operacional");
await reg("restaurar traz a demanda de volta", async () =>
  (await p.locator(`.card:has-text(${JSON.stringify(tituloExcluido)})`).count()) === 1);

/* ------------------------------------------------------------- permissões */
console.log("\nPERMISSÕES");
await irPara("#/config");
await p.locator('tr:has-text("Criação") [data-acao="trocar-usuario"]').click();
await p.waitForTimeout(300);
await reg("Criação não vê WhatsApp nem propostas", async () =>
  (await p.locator('a[href="#/whatsapp"]').count()) === 0
  && (await p.locator('a[href="#/propostas"]').count()) === 0);
await reg("mas vê mural e wiki", async () =>
  (await p.locator('a[href="#/mural"]').count()) === 1
  && (await p.locator('a[href="#/wiki"]').count()) === 1);
await irPara("#/whatsapp");
await reg("digitar #/whatsapp não abre", async () =>
  (await p.locator(".caixa-bloqueio .estado__titulo").innerText()).includes("não é do seu papel"));
await irPara("#/wiki");
await reg("Criação lê a wiki mas não escreve", async () =>
  (await p.locator('[data-acao="novo-artigo"]').count()) === 0
  && (await p.locator(".fatia__cartao").count()) > 0);

await irPara("#/config");
await p.locator('tr:has-text("Proprietário") [data-acao="trocar-usuario"]').click();
await p.waitForTimeout(300);

/* ---------------------------------------------------------------- busca */
console.log("\nBUSCA");
await p.keyboard.press("Control+k");
await p.waitForTimeout(200);
await p.fill("#busca-campo", "diagnostico");
await p.waitForTimeout(300);
await reg("acha o artigo da wiki sem acento", async () =>
  (await p.locator('.busca-item:has-text("Wiki")').count()) >= 1);
await p.fill("#busca-campo", "garagem");
await p.waitForTimeout(300);
await reg("acha a proposta pelo nome", async () =>
  (await p.locator('.busca-item:has-text("Proposta")').count()) >= 1);
await p.keyboard.press("Escape");

/* ------------------------------------------------------- persistência e celular */
console.log("\nPERSISTÊNCIA E CELULAR");
await p.goto("about:blank");
await p.goto(URL_APP, { waitUntil: "networkidle" });
await irPara("#/mural");
await reg("o aviso criado sobrevive ao recarregar", async () =>
  await p.locator('.mural-item__titulo:has-text("Reunião de time na sexta")').isVisible());

await p.setViewportSize({ width: 390, height: 844 });
for (const h of ["#/whatsapp", "#/propostas", "#/mural", "#/wiki", "#/pesquisa", "#/lixeira"]) {
  await irPara(h);
  await reg(`sem rolagem lateral em ${h}`, async () =>
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
}

console.log(erros.length ? "\nERROS DE CONSOLE:\n" + erros.join("\n") : "\nNenhum erro de console.");
console.log(tudo && !erros.length ? "\n=== TUDO OK ===" : "\n=== HÁ FALHAS ===");

await navegador.close();
process.exit(tudo && !erros.length ? 0 : 1);

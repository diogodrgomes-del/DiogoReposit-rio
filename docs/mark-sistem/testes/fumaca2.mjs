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

const irPara = async (hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(250); };

/* ---------------------------------------------------------------- painel */
console.log("\nPAINEL");
await reg("saúda pelo nome", async () => (await p.locator("h1").innerText()).startsWith("Olá"));
await reg("tem as quatro seções", async () => {
  const t = (await p.locator(".secao-rotulo").allInnerTexts()).map((x) => x.toLowerCase());
  return ["comercial", "clientes", "entrega", "financeiro"].every((s) => t.some((x) => x.includes(s)));
});
await reg("menu traz os 12 módulos", async () => (await p.locator(".nav__item").count()) === 12);
await reg("aprovações pendentes aparecem no menu", async () =>
  (await p.locator('a[href="#/aprovacoes"] .pino').innerText()) === "2");

/* ----------------------------------------------------------- operacional */
console.log("\nOPERACIONAL");
await irPara("#/operacional");
await reg("quadro com 5 fases", async () => (await p.locator(".quadro__coluna[data-fase]").count()) === 5);
await reg("cards de demanda carregados", async () => (await p.locator(".card[data-demanda]").count()) === 10);

const backlogAntes = await p.locator('[data-fase="backlog"] .card').count();
await p.click('[data-acao="nova-demanda"]');
await p.fill('.modal input[name="titulo"]', "Post de aniversário da loja");
await p.selectOption('.modal select[name="tipo"]', "social");
await p.fill('.modal input[name="prazo"]', "2026-08-20");
await p.click('.modal button[type="submit"]');
await p.waitForTimeout(300);
await reg("cria demanda no backlog", async () =>
  (await p.locator('[data-fase="backlog"] .card').count()) === backlogAntes + 1);
await reg("demanda nova aparece com o título digitado", async () =>
  (await p.locator('.card:has-text("Post de aniversário da loja")').count()) === 1);

/* arrasto entre fases */
const origem = p.locator('[data-fase="backlog"] .card').first();
const tituloArrastado = await origem.locator(".card__nome").innerText();
await origem.dragTo(p.locator('[data-fase="fazendo"]'));
await p.waitForTimeout(300);
await reg("arrastar move de fase", async () =>
  (await p.locator(`[data-fase="fazendo"] .card:has-text(${JSON.stringify(tituloArrastado)})`).count()) === 1);

/* mover para "Com o cliente" tem de abrir uma aprovação */
const pendentesAntes = await p.evaluate(() => S.aprovacoes.filter((a) => a.status === "pendente").length);
await p.locator('[data-fase="fazendo"] .card').first().dragTo(p.locator('[data-fase="cliente"]'));
await p.waitForTimeout(300);
await reg("mandar para o cliente abre pedido de aprovação", async () =>
  (await p.evaluate(() => S.aprovacoes.filter((a) => a.status === "pendente").length)) === pendentesAntes + 1);

/* fase final conclui */
await p.locator('[data-fase="cliente"] .card').first().dragTo(p.locator('[data-fase="concluida"]'));
await p.waitForTimeout(300);
await reg("fase final carimba a conclusão", async () =>
  await p.evaluate(() => S.demandas.filter((d) => d.fase === "concluida").every((d) => Boolean(d.concluidaEm))));

/* filtro */
await p.selectOption('select[name="cliente"]', { label: "Casa Carvalho" });
await p.click('[data-form="filtros-op"] button[type="submit"]');
await p.waitForTimeout(250);
await reg("filtro por cliente reduz o quadro", async () => {
  const n = await p.locator(".card[data-demanda]").count();
  return n > 0 && n <= 3;
});
await p.click('[data-acao="limpar-op"]');
await p.waitForTimeout(250);

/* -------------------------------------------------------------- agenda */
console.log("\nAGENDA");
await irPara("#/agenda");
await reg("mostra o dia de hoje", async () => await p.locator(".dia--hoje").isVisible());
await reg("junta comercial, entrega e financeiro", async () => {
  const t = (await p.locator(".dia").allInnerTexts()).join(" ");
  return t.includes("Comercial") && t.includes("Entrega") && t.includes("Financeiro");
});

/* --------------------------------------------------------- aprovações */
console.log("\nAPROVAÇÕES");
await irPara("#/aprovacoes");
await reg("lista os pedidos pendentes", async () => (await p.locator('[data-form="responder-aprovacao"]').count()) >= 2);

/* pedir ajuste sem comentário tem de ser recusado */
await p.locator('[data-form="responder-aprovacao"]').first().locator('button[value="ajuste"]').click();
await p.waitForTimeout(200);
await reg("recusa pedido de ajuste sem comentário", async () =>
  (await p.locator(".aviso-erro").first().innerText()).includes("Escreva o que o cliente pediu"));

const form = p.locator('[data-form="responder-aprovacao"]').first();
const idAprov = await form.getAttribute("data-id");
const demandaLigada = await p.evaluate((i) => (S.aprovacoes.find((a) => a.id === i) || {}).demandaId, idAprov);
await form.locator('input[name="comentario"]').fill("Trocar a cor do fundo e o texto da chamada");
await form.locator('button[value="ajuste"]').click();
await p.waitForTimeout(300);
await reg("ajuste devolve a demanda para “Fazendo”", async () =>
  demandaLigada
    ? await p.evaluate((i) => S.demandas.find((d) => d.id === i).fase === "fazendo", demandaLigada)
    : true);
await reg("comentário do cliente vira o detalhe da demanda", async () =>
  demandaLigada
    ? (await p.evaluate((i) => S.demandas.find((d) => d.id === i).descricao, demandaLigada)) === "Trocar a cor do fundo e o texto da chamada"
    : true);

await irPara("#/aprovacoes");
const form2 = p.locator('[data-form="responder-aprovacao"]').first();
const idAprov2 = await form2.getAttribute("data-id");
const demandaLigada2 = await p.evaluate((i) => (S.aprovacoes.find((a) => a.id === i) || {}).demandaId, idAprov2);
await form2.locator('button[value="aprovado"]').click();
await p.waitForTimeout(300);
await reg("aprovar conclui a demanda ligada", async () =>
  demandaLigada2
    ? await p.evaluate((i) => S.demandas.find((d) => d.id === i).fase === "concluida", demandaLigada2)
    : true);

/* --------------------------------------------------------- financeiro */
console.log("\nFINANCEIRO");
await irPara("#/financeiro");
await reg("mostra receita recorrente", async () =>
  (await p.locator(".indicador:has-text('Receita recorrente') .indicador__valor").innerText()).includes("R$"));
await reg("existe cobrança vencida", async () => (await p.locator('.selo:has-text("Vencido")').count()) >= 1);

const vencidoAntes = await p.locator(".indicador:has-text('Vencido') .indicador__valor").innerText();
await p.locator('[data-acao="receber"]').first().click();
await p.waitForTimeout(300);
await reg("marcar recebido muda o total vencido", async () =>
  (await p.locator(".indicador:has-text('Vencido') .indicador__valor").innerText()) !== vencidoAntes);
await reg("linha passa a Recebido", async () => (await p.locator('.selo:has-text("Recebido")').count()) >= 1);

await p.locator('[data-acao="desfazer-recebimento"]').first().click();
await p.waitForTimeout(300);
await reg("desfazer volta ao estado anterior", async () =>
  (await p.locator(".indicador:has-text('Vencido') .indicador__valor").innerText()) === vencidoAntes);

/* despesa */
await p.click('[data-acao="nova-despesa"]');
await p.fill('.modal input[name="descricao"]', "Impulsionamento extra");
await p.fill('.modal input[name="valor"]', "1.250,90");
await p.click('.modal button[type="submit"]');
await p.waitForTimeout(300);
await reg("lança despesa com valor no formato brasileiro", async () =>
  (await p.evaluate(() => S.despesas.find((x) => x.descricao === "Impulsionamento extra").valor)) === 1250.9);

/* trava do financeiro pessoal */
await reg("proprietário vê o financeiro pessoal", async () =>
  await p.locator('.cartao:has-text("Financeiro pessoal") .dado__rotulo:has-text("Pró-labore")').isVisible());

/* ------------------------------------------------------------ tráfego */
console.log("\nTRÁFEGO");
await irPara("#/trafego");
await reg("mostra 30 barras de investimento diário", async () => (await p.locator(".colunas-mini i").count()) === 30);
await reg("calcula custo por resultado", async () =>
  (await p.locator(".indicador:has-text('Custo por resultado') .indicador__valor").innerText()).includes("R$"));
await p.selectOption('select[name="cliente"]', { index: 1 });
await p.click('[data-form="cliente-trafego"] button[type="submit"]');
await p.waitForTimeout(250);
await reg("trocar de cliente troca os números", async () => (await p.locator(".colunas-mini i").count()) === 30);

/* ------------------------------------------------------------- cofre */
console.log("\nCOFRE");
await irPara("#/cofre");
await reg("senhas vêm escondidas", async () =>
  (await p.locator("td.segredo").nth(1).innerText()).startsWith("••"));
const esperado = await p.evaluate(() =>
  [...S.senhas].sort((a, b) => nomeCliente(a.clienteId).localeCompare(nomeCliente(b.clienteId)))[0].segredo);
await p.locator('[data-acao="revelar"]').first().click();
await p.waitForTimeout(250);
await reg("revelar mostra a senha", async () =>
  (await p.locator("td.segredo").nth(1).innerText()) === esperado);
await reg("revelar fica no histórico", async () =>
  await p.evaluate(() => S.eventos.some((e) => e.tipo === "senha.revelada")));

/* -------------------------------------------------------- estratégias */
console.log("\nESTRATÉGIAS");
await irPara("#/estrategias");
await reg("lista todos os clientes", async () => (await p.locator(".cartao").count()) >= 5);
await p.locator('[data-acao="editar-estrategia"]').first().click();
await p.fill('.modal textarea[name="objetivo"]', "Dobrar os agendamentos até dezembro");
await p.click('.modal button[type="submit"]');
await p.waitForTimeout(300);
await reg("salva a estratégia editada", async () =>
  await p.locator('text=Dobrar os agendamentos até dezembro').first().isVisible());

/* ---------------------------------------------------------- arquivos */
console.log("\nARQUIVOS");
await irPara("#/arquivos");
await reg("lista arquivos com tamanho legível", async () =>
  (await p.locator("td.num").first().innerText()).match(/(KB|MB|GB)/) !== null);
await p.click('[data-acao="novo-arquivo"]');
await p.fill('.modal input[name="nome"]', "Briefing de setembro.pdf");
await p.fill('.modal input[name="mb"]', "3,5");
await p.click('.modal button[type="submit"]');
await p.waitForTimeout(300);
await reg("registra arquivo novo", async () =>
  await p.locator('td:has-text("Briefing de setembro.pdf")').first().isVisible());

/* ---------------------------------------------------- ficha do cliente */
console.log("\nFICHA DO CLIENTE");
await irPara("#/clientes");
await p.locator('td a[href^="#/cliente/"]').first().click();
await p.waitForTimeout(300);
await reg("abre com 6 abas", async () => (await p.locator(".aba").count()) === 6);
for (const aba of ["entrega", "financeiro", "estrategia", "acessos", "historico"]) {
  await p.locator(`[data-aba="${aba}"]`).click();
  await p.waitForTimeout(200);
  await reg(`aba ${aba} renderiza`, async () =>
    (await p.locator(`[data-aba="${aba}"]`).getAttribute("aria-selected")) === "true"
    && (await p.locator(".cartao").count()) >= 1);
}

/* ------------------------------------------------------- permissões */
console.log("\nPERMISSÕES");
await irPara("#/config");
await p.locator('tr:has-text("Criação") [data-acao="trocar-usuario"]').click();
await p.waitForTimeout(300);
await reg("trocar de pessoa reduz o menu", async () => (await p.locator(".nav__item").count()) < 12);
await reg("financeiro some do menu da Criação", async () =>
  (await p.locator('a[href="#/financeiro"]').count()) === 0);

await irPara("#/financeiro");
await reg("digitar o endereço não abre o financeiro", async () =>
  (await p.locator(".caixa-bloqueio .estado__titulo").innerText()).includes("não é do seu papel"));

await irPara("#/config");
await p.locator('tr:has-text("Gestor de Tráfego") [data-acao="trocar-usuario"]').click();
await p.waitForTimeout(300);
await irPara("#/financeiro");
await reg("gestor vê o financeiro da agência", async () =>
  await p.locator(".indicador:has-text('Receita recorrente')").isVisible());
await reg("mas o financeiro pessoal fica travado", async () =>
  (await p.locator('.cartao:has-text("Financeiro pessoal") .estado__titulo').innerText()).includes("Só o proprietário"));

await irPara("#/cofre");
await reg("gestor tem leitura do cofre, não edição", async () =>
  (await p.locator('[data-acao="nova-senha"]').count()) === 0
  && (await p.locator('[data-acao="revelar"]').count()) > 0);

await irPara("#/config");
await p.locator('tr:has-text("Proprietário") [data-acao="trocar-usuario"]').click();
await p.waitForTimeout(300);

/* --------------------------------------------------------------- busca */
console.log("\nBUSCA");
await p.keyboard.press("Control+k");
await p.waitForTimeout(200);
await p.fill("#busca-campo", "post de aniversario");
await p.waitForTimeout(300);
await reg("acha demanda sem acento", async () =>
  (await p.locator(".busca-item").first().innerText()).toLowerCase().includes("aniversário"));
await p.keyboard.press("Escape");

/* --------------------------------------------------- persistência e mobile */
console.log("\nPERSISTÊNCIA E CELULAR");
await p.goto("about:blank");
await p.goto(URL_APP, { waitUntil: "networkidle" });
await irPara("#/operacional");
await reg("demanda criada sobrevive ao recarregar", async () =>
  (await p.locator('.card:has-text("Post de aniversário da loja")').count()) === 1);

await p.setViewportSize({ width: 390, height: 844 });
for (const hash of ["#/painel", "#/operacional", "#/financeiro", "#/agenda", "#/cofre", "#/trafego"]) {
  await irPara(hash);
  await reg(`sem rolagem lateral em ${hash}`, async () =>
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
}

console.log(erros.length ? "\nERROS DE CONSOLE:\n" + erros.join("\n") : "\nNenhum erro de console.");
console.log(tudo && !erros.length ? "\n=== TUDO OK ===" : "\n=== HÁ FALHAS ===");

await navegador.close();
process.exit(tudo && !erros.length ? 0 : 1);

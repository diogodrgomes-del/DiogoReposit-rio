import { normalizarTelefone as n, formatarTelefone as f, entre, aoInicio, similaridade as sim, semAcento } from "./puras.mjs";
let ok = 0, falhas = [];
const t = (nome, real, esperado) => {
  const bate = JSON.stringify(real) === JSON.stringify(esperado);
  bate ? ok++ : falhas.push(`${nome}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(real)}`);
};

t("celular simples",      n("44998887777"),      "+5544998887777");
t("formatado",            n("(44) 99888-7777"),  "+5544998887777");
t("com pais",             n("5544998887777"),    "+5544998887777");
t("E.164",                n("+55 44 99888-7777"),"+5544998887777");
t("zero de operadora",    n("044998887777"),     "+5544998887777");
t("nono digito",          n("4488887777"),       "+5544998887777".replace("99888","98888"));
t("fixo 8 digitos",       n("4432217777"),       "+554432217777");
t("DDD 55 (RS)",          n("55998887777"),      "+5555998887777");
t("13 digitos com 55",    n("5555998887777"),    "+5555998887777");
t("DDD inexistente",      n("2098887777"),       null);
t("vazio",                n(""),                 null);
t("sem digito",           n("abc"),              null);
t("internacional",        n("+1 415 555 2671"),  "+14155552671");
t("idempotente",          n(n("(44) 99888-7777")), "+5544998887777");

t("formata celular",      f("+5544998887777"),   "(44) 99888-7777");
t("formata fixo",         f("+554432217777"),    "(44) 3221-7777");

t("entre vazio",          entre(null, null),     1000);
t("entre meio",           entre(1000, 2000),     1500);
t("entre topo",           entre(null, 1000),     0);
t("entre fim",            entre(3000, null),     4000);
t("entre sem espaco",     entre(1000, 1000 + 1e-9), null);
t("aoInicio",             aoInicio(1000),        0);

// A ordem tem de se manter em insercoes repetidas no mesmo ponto.
let a = 1000; const pos = [];
for (let i = 0; i < 20; i++) { const m = entre(a, 2000); pos.push(m); a = m; }
t("ordem preservada", JSON.stringify(pos) === JSON.stringify([...pos].sort((x,y)=>x-y)), true);

t("acento",     semAcento("Óticas Gouveia"), "oticas gouveia");
t("fuzzy acha", sim("Óticas Gouveia", "oticas gouvea") > 0.4, true);
t("fuzzy nega", sim("Casa Carvalho", "moraes") > 0.25, false);
t("substring",  sim("Óticas Gouveia", "otica"), 1);

console.log(`${ok} passaram, ${falhas.length} falharam`);
falhas.forEach((x) => console.log("  ✗ " + x));
process.exit(falhas.length ? 1 : 0);

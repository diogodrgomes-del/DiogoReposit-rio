
/* ============================================================================
   MARK SISTEM — versão navegável.

   Os algoritmos abaixo são os mesmos do sistema real, portados para o
   navegador: normalização de telefone (packages/core/src/telefone.ts),
   ordenação fracionária do Kanban (ordem.ts) e a busca tolerante a acento e
   erro de digitação (busca.ts).

   A diferença é onde o dado mora: aqui é o localStorage do seu navegador; lá é
   Postgres com Row Level Security. A lógica que você vai sentir clicando é a
   mesma.
   ========================================================================== */

/* ---------------------------------------------------------------- telefone */
const DDDS = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,
  81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);

function normalizarTelefone(bruto) {
  if (!bruto) return null;
  const tinhaMais = String(bruto).trim().startsWith("+");
  let d = String(bruto).replace(/\D/g, "");
  if (!d) return null;

  if (tinhaMais && !d.startsWith("55")) return d.length >= 8 && d.length <= 15 ? "+" + d : null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11 && d.startsWith("0")) d = d.replace(/^0+/, "");
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = Number(d.slice(0, 2));
  if (!DDDS.has(ddd)) return null;

  let ass = d.slice(2);
  // Nono dígito: celular antigo de 8 dígitos ganha o 9 na frente.
  if (ass.length === 8 && /^[6-9]/.test(ass)) ass = "9" + ass;
  if (ass.length === 9 && !ass.startsWith("9")) return null;
  if (ass.length === 8 && !/^[2-5]/.test(ass)) return null;
  return "+55" + ddd + ass;
}

function formatarTelefone(e164) {
  if (!e164) return "";
  if (!e164.startsWith("+55")) return e164;
  const d = e164.slice(3);
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return e164;
}

const linkWhatsApp = (e164) => e164 ? "https://wa.me/" + e164.replace(/\D/g, "") : null;

/* ----------------------------------------------------- ordenação do Kanban */
const PASSO = 1000, MINIMO = 1e-6;

function entre(anterior, proximo) {
  if (anterior === null && proximo === null) return PASSO;
  if (anterior === null) return proximo - PASSO;
  if (proximo === null) return anterior + PASSO;
  if (proximo - anterior < MINIMO) return null;
  return anterior + (proximo - anterior) / 2;
}
const aoInicio = (p) => p === null ? PASSO : p - PASSO;

/* ---------------------------------------------------------------- utilidades */
const semAcento = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Similaridade por bigramas — o que o pg_trgm faz no banco. */
function similaridade(a, b) {
  const A = semAcento(a), B = semAcento(b);
  if (!A || !B) return 0;
  if (A.includes(B) || B.includes(A)) return 1;
  const par = (s) => { const r = new Set(); for (let i = 0; i < s.length - 1; i++) r.add(s.slice(i, i + 2)); return r; };
  const pa = par(A), pb = par(B);
  if (!pa.size || !pb.size) return 0;
  let comuns = 0;
  pb.forEach((g) => { if (pa.has(g)) comuns++; });
  return (2 * comuns) / (pa.size + pb.size);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moedaExata = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR");
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const hojeISO = () => new Date().toISOString().slice(0, 10);

function quando(iso) {
  const seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "agora";
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `há ${Math.floor(seg / 86400)} d`;
  return fmtData.format(new Date(iso));
}

/** Escapa antes de interpolar em HTML. O nome do lead é digitado pelo usuário. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}


export { normalizarTelefone, formatarTelefone, entre, aoInicio, similaridade, semAcento };

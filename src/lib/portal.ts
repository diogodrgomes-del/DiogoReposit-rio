import { SignJWT, jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/**
 * Portal cativo de Wi-Fi com login social.
 *
 * O visitante conecta no Wi-Fi, cai nesta pagina, entra com Facebook ou Google
 * e so entao ganha internet. O login e feito por OAuth: a senha e digitada no
 * proprio Facebook/Google, nunca aqui — nos recebemos de volta apenas nome e
 * e-mail, com o consentimento da pessoa. Nada de imitar tela de login e
 * capturar senha; isso seria phishing, alem de derrubar o dominio na hora.
 *
 * O que sai disto para o negocio: um lead (nome + e-mail) por visita, guardado
 * para marketing, e a opcao de um check-in voluntario na pagina do lugar. O
 * check-in automatico no feed (o antigo Facebook WiFi) foi encerrado pela Meta
 * em 2022 e nao existe mais via API — por isso nao ha promessa dele aqui.
 */

export type Provedor = "facebook" | "google";

/** Como o visitante entrou: rede social ou formulário de dados pessoais. */
export type OrigemLead = Provedor | "cadastro";

export type Visitante = {
  provedor: OrigemLead;
  nome: string;
  email: string | null;
  telefone?: string | null;
  idExterno: string;
};

/** Nome do lugar que aparece no topo da pagina. */
export function nomeNegocio(): string {
  return process.env.PORTAL_NEGOCIO?.trim() || "Wi-Fi";
}

/** Pagina do negocio no Facebook, para o botao de check-in voluntario. */
export function paginaFacebook(): string | null {
  const u = process.env.PORTAL_FACEBOOK_PAGE?.trim();
  return u || null;
}

/** Para onde mandar o visitante depois de conectar (site do negocio, cardapio…). */
export function destinoFinal(): string | null {
  const u = process.env.PORTAL_URL_DESTINO?.trim();
  return u || null;
}

type ConfigProvedor = { clientId: string; secret: string };

function configProvedor(p: Provedor): ConfigProvedor | null {
  if (p === "facebook") {
    const clientId = process.env.PORTAL_FACEBOOK_APP_ID?.trim();
    const secret = process.env.PORTAL_FACEBOOK_SECRET?.trim();
    if (!clientId || !secret) return null;
    return { clientId, secret };
  }
  const clientId = process.env.PORTAL_GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.PORTAL_GOOGLE_SECRET?.trim();
  if (!clientId || !secret) return null;
  return { clientId, secret };
}

/**
 * Sem credenciais de OAuth cadastradas, o portal roda em modo demonstracao: o
 * fluxo inteiro funciona com um visitante ficticio, para dar para ver a tela e
 * o caminho antes de criar os apps no Facebook e no Google.
 */
export function modoDemo(p: Provedor): boolean {
  return configProvedor(p) === null;
}

/**
 * URL publica base, para montar o redirect_uri que o Facebook/Google exigem
 * bater exatamente com o cadastrado no painel deles. Prioriza PORTAL_URL_BASE;
 * sem ela, deduz dos cabecalhos da requisicao (util atras da Vercel).
 */
export function urlBase(req: Request): string {
  const fixa = process.env.PORTAL_URL_BASE?.trim();
  if (fixa) return fixa.replace(/\/+$/, "");
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export function redirectUri(req: Request, p: Provedor): string {
  return `${urlBase(req)}/api/wifi/${p}/callback`;
}

// ----------------------------------------------------------------------------
// Estado assinado
//
// Entre o clique e a volta do OAuth, o portal precisa lembrar quais parametros
// o roteador mandou (para liberar a internet depois) e proteger contra CSRF. Em
// vez de sessao no servidor, vai tudo num JWT curto assinado com o mesmo
// SESSION_SECRET do painel — some sozinho em 10 minutos.
// ----------------------------------------------------------------------------

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(s);
}

export type EstadoPortal = {
  p: Provedor;
  /** Parametros do roteador/AP (uamip, mac, challenge…), preservados como vieram. */
  ap: Record<string, string>;
};

export async function assinarEstado(dados: EstadoPortal): Promise<string> {
  return new SignJWT(dados as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(segredo());
}

export async function lerEstado(token: string): Promise<EstadoPortal | null> {
  try {
    const { payload } = await jwtVerify(token, segredo());
    const p = payload.p;
    if (p !== "facebook" && p !== "google") return null;
    const ap =
      payload.ap && typeof payload.ap === "object"
        ? (payload.ap as Record<string, string>)
        : {};
    return { p, ap };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// OAuth: monta a URL de autorizacao e troca o code por perfil
// ----------------------------------------------------------------------------

export function urlAutorizacao(req: Request, p: Provedor, state: string): string {
  const cfg = configProvedor(p);
  if (!cfg) throw new Error("Provedor sem credenciais.");
  const redirect = redirectUri(req, p);

  if (p === "facebook") {
    const q = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: redirect,
      state,
      response_type: "code",
      scope: "public_profile,email",
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${q}`;
  }

  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirect,
    state,
    response_type: "code",
    scope: "openid email profile",
    // Sempre mostrar a conta: quiosque compartilhado nao pode logar sempre a
    // mesma pessoa que o navegador lembrou.
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function jsonOuErro(r: Response, contexto: string): Promise<unknown> {
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${contexto}: ${r.status} ${txt.slice(0, 200)}`);
  }
  return r.json();
}

export async function trocarCodePorVisitante(
  req: Request,
  p: Provedor,
  code: string
): Promise<Visitante> {
  const cfg = configProvedor(p);
  if (!cfg) throw new Error("Provedor sem credenciais.");
  const redirect = redirectUri(req, p);

  if (p === "facebook") {
    const q = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.secret,
      redirect_uri: redirect,
      code,
    });
    const tk = (await jsonOuErro(
      await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${q}`),
      "token Facebook"
    )) as { access_token?: string };
    if (!tk.access_token) throw new Error("Facebook não devolveu access_token.");

    const perfil = (await jsonOuErro(
      await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${encodeURIComponent(
          tk.access_token
        )}`
      ),
      "perfil Facebook"
    )) as { id?: string; name?: string; email?: string };

    return {
      provedor: "facebook",
      idExterno: String(perfil.id ?? ""),
      nome: perfil.name?.trim() || "Visitante",
      email: perfil.email?.trim() || null,
    };
  }

  // Google
  const corpo = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.secret,
    redirect_uri: redirect,
    code,
    grant_type: "authorization_code",
  });
  const tk = (await jsonOuErro(
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corpo,
    }),
    "token Google"
  )) as { access_token?: string };
  if (!tk.access_token) throw new Error("Google não devolveu access_token.");

  const perfil = (await jsonOuErro(
    await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tk.access_token}` },
    }),
    "perfil Google"
  )) as { sub?: string; name?: string; email?: string };

  return {
    provedor: "google",
    idExterno: String(perfil.sub ?? ""),
    nome: perfil.name?.trim() || "Visitante",
    email: perfil.email?.trim() || null,
  };
}

// ----------------------------------------------------------------------------
// Formulário de dados pessoais (alternativa ao login social)
// ----------------------------------------------------------------------------

export type DadosCadastro = { nome: string; email: string; telefone: string | null };

/** E-mail plausível: um @, algo antes, e um domínio com ponto depois. */
function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Valida o formulário. Pede só o essencial (nome e e-mail) — coletar menos é a
 * regra da LGPD. Telefone é opcional e guardado só com os dígitos.
 */
export function validarCadastro(bruto: {
  nome?: unknown;
  email?: unknown;
  telefone?: unknown;
  consentimento?: unknown;
}): { ok: true; dados: DadosCadastro } | { ok: false; erro: string } {
  const nome = String(bruto.nome ?? "").trim();
  const email = String(bruto.email ?? "").trim().toLowerCase();
  const telBruto = String(bruto.telefone ?? "").replace(/\D/g, "");

  if (bruto.consentimento !== true) {
    return { ok: false, erro: "É preciso aceitar os termos para conectar." };
  }
  if (nome.length < 2) {
    return { ok: false, erro: "Informe seu nome." };
  }
  if (!emailValido(email)) {
    return { ok: false, erro: "Informe um e-mail válido." };
  }
  if (telBruto && (telBruto.length < 10 || telBruto.length > 13)) {
    return { ok: false, erro: "Telefone inválido. Use o DDD e o número." };
  }

  return {
    ok: true,
    dados: { nome, email, telefone: telBruto || null },
  };
}

// ----------------------------------------------------------------------------
// Liberar a internet
//
// Num portal cativo real, o roteador manda o visitante para ca com parametros
// (uamip/uamport/challenge no CoovaChilli/UAM). Depois do login, devolvemos a
// pessoa para o endereco de logon do roteador, que abre o acesso. Sem esses
// parametros — teste no navegador, ou AP que so redireciona — cai na tela de
// "conectado".
// ----------------------------------------------------------------------------

export function urlLiberacao(ap: Record<string, string>): string | null {
  const uamip = ap.uamip;
  const uamport = ap.uamport;
  if (uamip && uamport) {
    const q = new URLSearchParams();
    if (ap.userurl) q.set("userurl", ap.userurl);
    const base = `http://${uamip}:${uamport}/logon`;
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  }
  // Modelo generico: alguns APs aceitam uma URL de concessao pronta via env,
  // com {ip}/{mac} trocados pelos dados do cliente.
  const modelo = process.env.PORTAL_LIBERAR_URL?.trim();
  if (modelo) {
    return modelo
      .replace("{ip}", ap.ip ?? "")
      .replace("{mac}", ap.mac ?? "");
  }
  return null;
}

/** Parametros que interessam do AP, filtrados do querystring de entrada. */
export function extrairParametrosAp(params: URLSearchParams): Record<string, string> {
  const chaves = [
    "uamip",
    "uamport",
    "challenge",
    "mac",
    "ip",
    "userurl",
    "called",
    "nasid",
    "ssid",
  ];
  const out: Record<string, string> = {};
  for (const k of chaves) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Banco: guarda cada visitante (o lead)
//
// Mesmo Postgres do resto do painel (Neon na Vercel, driver HTTP; qualquer
// outro Postgres pelo driver padrao). Sem DATABASE_URL, o portal continua
// liberando a internet — so nao registra o lead, em vez de quebrar.
// ----------------------------------------------------------------------------

type Consulta = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...valores: unknown[]
) => Promise<T[]>;

function urlBanco(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

let pool: Pool | null = null;

function conexao(): Consulta | null {
  const url = urlBanco();
  if (!url) return null;

  if (/neon\.tech|vercel-storage\.com/.test(url)) {
    const sql = neon(url);
    return ((strings, ...valores) =>
      sql(strings, ...valores) as unknown as Promise<never[]>) as Consulta;
  }

  pool ??= new Pool({ connectionString: url, max: 3 });
  return (async <T>(strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.reduce(
      (acc, parte, i) => acc + parte + (i < valores.length ? `$${i + 1}` : ""),
      ""
    );
    const r = await pool!.query(texto, valores);
    return r.rows as T[];
  }) as Consulta;
}

let tabelaPronta = false;
async function garantirTabela(sql: Consulta) {
  if (tabelaPronta) return;
  await sql`
    CREATE TABLE IF NOT EXISTS wifi_visitantes (
      id         SERIAL PRIMARY KEY,
      provedor   TEXT        NOT NULL,
      id_externo TEXT        NOT NULL,
      nome       TEXT        NOT NULL,
      email      TEXT,
      telefone   TEXT,
      ssid       TEXT,
      ip         TEXT,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Tabela criada antes de existir o formulário não tem a coluna; adiciona sem
  // quebrar quem já rodou a versão só com login social.
  await sql`ALTER TABLE wifi_visitantes ADD COLUMN IF NOT EXISTS telefone TEXT`;
  await sql`
    CREATE INDEX IF NOT EXISTS wifi_visitantes_data
      ON wifi_visitantes (criado_em DESC)
  `;
  tabelaPronta = true;
}

/**
 * Registra o visitante. Nao quebra o acesso se o banco falhar: o objetivo
 * numero um do portal e liberar a internet; o lead e consequencia.
 */
export async function registrarVisitante(
  v: Visitante,
  ap: Record<string, string>
): Promise<void> {
  const sql = conexao();
  if (!sql) return;
  try {
    await garantirTabela(sql);
    await sql`
      INSERT INTO wifi_visitantes
        (provedor, id_externo, nome, email, telefone, ssid, ip)
      VALUES (${v.provedor}, ${v.idExterno}, ${v.nome}, ${v.email},
              ${v.telefone ?? null}, ${ap.ssid ?? null}, ${ap.ip ?? null})
    `;
  } catch (e) {
    console.error("Falha ao registrar visitante do Wi-Fi:", (e as Error).message);
  }
}

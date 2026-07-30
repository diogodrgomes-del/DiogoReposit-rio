/**
 * Carteira de clientes: cada um tem app e token proprios no Meta Business
 * Manager, entao o painel guarda um token por cliente.
 *
 * Os tokens vem de META_TOKENS, uma linha por cliente:
 *
 *   META_TOKENS="
 *   Bom pra home = EAAZCj...
 *   Casa Carvalho = EAAbxT...
 *   "
 *
 * O separador entre linhas pode ser quebra de linha ou ponto-e-virgula, e o
 * separador entre nome e token pode ser `=` ou `|`. Isso cobre tanto o campo
 * multilinha da Vercel quanto um valor colado numa linha so.
 *
 * META_ACCESS_TOKEN continua valendo como cliente unico, para nao quebrar quem
 * ja tinha configurado antes da carteira existir.
 */

export type Cliente = {
  /** Identificador estavel usado na URL. */
  id: string;
  nome: string;
};

type ClienteInterno = Cliente & { token: string };

function semAcento(s: string): string {
  // \u0300-\u036f = marcas diacriticas que o NFD separa das letras.
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function apelido(nome: string): string {
  return semAcento(nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

let cache: ClienteInterno[] | null = null;
let cacheDe = "";

function carregar(): ClienteInterno[] {
  const bruto = process.env.META_TOKENS ?? "";
  const unico = process.env.META_ACCESS_TOKEN ?? "";
  const chave = `${bruto.length}:${unico.length}`;

  if (cache && cacheDe === chave) return cache;

  const lista: ClienteInterno[] = [];
  const vistos = new Set<string>();

  const adicionar = (nome: string, token: string) => {
    const limpo = token.trim();
    const rotulo = nome.trim();
    if (!limpo || !rotulo) return;
    let id = apelido(rotulo) || `cliente-${lista.length + 1}`;
    // Dois clientes com nomes que geram o mesmo apelido nao podem colidir:
    // o segundo perderia o proprio token na busca por id.
    let n = 2;
    while (vistos.has(id)) id = `${apelido(rotulo)}-${n++}`;
    vistos.add(id);
    lista.push({ id, nome: rotulo, token: limpo });
  };

  for (const linha of bruto.split(/[\n;]+/)) {
    const texto = linha.trim();
    if (!texto || texto.startsWith("#")) continue;
    const corte = texto.search(/[=|]/);
    if (corte < 1) continue;
    adicionar(texto.slice(0, corte), texto.slice(corte + 1));
  }

  if (unico.trim() && !lista.some((c) => c.token === unico.trim())) {
    adicionar(process.env.META_ACCESS_TOKEN_NOME || "Marktiva", unico);
  }

  cache = lista;
  cacheDe = chave;
  return lista;
}

/**
 * Lista publica: sem token, seguro para enviar ao navegador.
 *
 * Ordenada por nome na leitura, e nao na variavel de ambiente: META_TOKENS fica
 * como esta, e acrescentar um cliente novo no fim da variavel ja o coloca no
 * lugar certo do seletor. Comparacao com locale pt-BR para "Óticas" cair junto
 * de "O", e nao depois de Z.
 */
export function listarClientes(): Cliente[] {
  return carregar()
    .map(({ id, nome }) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

/** Token de um cliente. Nunca exponha o retorno numa resposta HTTP. */
export function tokenDe(id: string): string | null {
  return carregar().find((c) => c.id === id)?.token ?? null;
}

export function clientesComToken(): ClienteInterno[] {
  return carregar();
}

export function nenhumClienteConfigurado(): boolean {
  return carregar().length === 0;
}

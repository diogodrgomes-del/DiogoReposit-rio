import type { SaudeCliente, StatusCliente } from "@mark/core/navegador";

/**
 * Vocabulário visual de cliente, num lugar só.
 *
 * Rótulo e cor de status vivem aqui porque aparecem na lista, na ficha, na
 * lixeira e — em breve — no painel geral. Repetir o mapa em cada tela é como
 * se perde a consistência que faz o sistema ser lido sem legenda.
 */

export const ROTULO_STATUS: Record<StatusCliente, string> = {
  ativo: "Ativo",
  onboarding: "Onboarding",
  pausado: "Pausado",
  inadimplente: "Inadimplente",
  em_risco: "Em risco",
  cancelado: "Cancelado",
  encerrado: "Encerrado",
};

export const ROTULO_SAUDE: Record<SaudeCliente, string> = {
  verde: "Saudável",
  amarelo: "Atenção",
  vermelho: "Risco",
};

const CLASSE_SAUDE: Record<SaudeCliente, string> = {
  verde: "selo--verde",
  amarelo: "selo--ambar",
  vermelho: "selo--vermelho",
};

/**
 * O ponto colorido nunca carrega a informação sozinho: o texto ao lado diz a
 * mesma coisa. É o que mantém a leitura possível para quem não distingue as
 * cores — e para quem está imprimindo em preto e branco.
 */
export function SeloSaude({ saude }: { saude: SaudeCliente }) {
  return <span className={`selo ${CLASSE_SAUDE[saude]}`}>{ROTULO_SAUDE[saude]}</span>;
}

export function SeloStatus({ status }: { status: StatusCliente }) {
  const classe =
    status === "ativo"
      ? "selo--verde"
      : status === "inadimplente" || status === "cancelado" || status === "encerrado"
        ? "selo--vermelho"
        : status === "em_risco" || status === "pausado"
          ? "selo--ambar"
          : "";
  return <span className={`selo ${classe}`}>{ROTULO_STATUS[status]}</span>;
}

const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const FORMATO_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const data = (d: Date) => FORMATO_DATA.format(d);
export const dataHora = (d: Date) => FORMATO_HORA.format(d);

/**
 * "há 3 dias" em vez de uma data absoluta quando o que importa é a recência.
 * Acima de uma semana volta à data, porque "há 43 dias" não diz nada a ninguém.
 */
export function quando(d: Date): string {
  const seg = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seg < 60) return "agora";
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86_400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 604_800) return `há ${Math.floor(seg / 86_400)} d`;
  return data(d);
}

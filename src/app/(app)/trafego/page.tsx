import Painel from "@/components/Painel";

export const dynamic = "force-dynamic";

/**
 * Painel de campanhas do Meta Ads — o sistema anterior, agora dentro do MARK
 * SISTEM como o módulo de Gestão de Tráfego. Continua lendo a Graph API ao
 * vivo, com os tokens em META_TOKENS.
 *
 * Próximo passo previsto (docs/arquitetura/08-integracoes.md): tokens saem da
 * variável de ambiente para o cofre de credenciais, e as métricas passam a ser
 * gravadas em ad_metrics_daily em vez de descartadas a cada tela.
 */
export default function TrafegoPage() {
  return <Painel />;
}

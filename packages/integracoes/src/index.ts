/**
 * Camada de integração.
 *
 * Todo serviço externo entra por aqui, atrás de uma interface. O resto do
 * sistema conhece a interface, nunca o fornecedor — é o que permite trocar
 * provedor de WhatsApp, ou de armazenamento, escrevendo uma classe nova em vez
 * de caçar chamadas espalhadas por quinze arquivos.
 *
 * Meta Ads é a primeira: saiu de apps/web para cá porque o worker precisa dela
 * tanto quanto a web. Enquanto morava dentro do app, sincronizar em segundo
 * plano exigiria duplicar o cliente.
 */
export * as metaAds from "./meta-ads/index";

import { v7 } from "uuid";

/**
 * Identificador de toda entidade do sistema.
 *
 * UUID v7, não v4: os 48 bits mais significativos são o timestamp em
 * milissegundos, então ids gerados em sequência ficam próximos no índice
 * B-tree. Com v4 cada inserção cai num ponto aleatório da árvore, o que
 * fragmenta a página e derruba a taxa de acerto do cache — um efeito que só
 * aparece quando a tabela já cresceu, e aí a correção custa uma migração de
 * chave primária.
 *
 * Vantagem colateral: `ORDER BY id` já é ordem cronológica, o que torna a
 * paginação por cursor mais barata em tabelas com muita escrita.
 *
 * O Postgres 18 traz `uuidv7()` nativo; até a Neon chegar lá, geramos aqui.
 */
export function novoId(): string {
  return v7();
}

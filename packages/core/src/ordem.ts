/**
 * Ordenação fracionária para quadros Kanban.
 *
 * O jeito ingênuo de ordenar cards é uma coluna `posicao` inteira: 1, 2, 3…
 * Arrastar um card para o meio obriga a renumerar todos os seguintes — dezenas
 * de UPDATEs numa transação, com lock na coluna inteira. Com 200 cards a
 * diferença é entre 4ms e 400ms, e dois usuários arrastando ao mesmo tempo
 * disputam as mesmas linhas.
 *
 * A alternativa é guardar `numeric` e colocar o card **entre** os vizinhos: um
 * card entre 3 e 4 recebe 3.5. Arrastar vira um UPDATE de uma linha, sem lock
 * em nada além dela.
 *
 * O preço é a precisão finita: dividir ao meio repetidamente no mesmo ponto
 * esgota os dígitos. `precisaReequilibrar` detecta isso, e `reequilibrar`
 * redistribui a coluna — uma operação rara, feita de propósito e não a cada
 * arrasto.
 */

/** Espaço deixado entre cards ao numerar do zero. */
const PASSO = 1000;

/**
 * Menor diferença tolerada entre dois vizinhos.
 *
 * `numeric` do Postgres tem precisão arbitrária, mas o JavaScript passa por
 * `number` (double, ~15 dígitos significativos) na ida e na volta. Abaixo deste
 * limiar as divisões deixam de produzir valores distintos.
 */
const MINIMO = 1e-6;

/**
 * Posição para um card solto entre `anterior` e `proximo`.
 *
 * `null` em qualquer um dos lados significa borda: início ou fim da coluna.
 * Devolve `null` quando não há espaço — sinal de que a coluna precisa ser
 * reequilibrada antes de aceitar o movimento.
 */
export function entre(anterior: number | null, proximo: number | null): number | null {
  if (anterior === null && proximo === null) return PASSO;
  if (anterior === null) return (proximo as number) - PASSO;
  if (proximo === null) return anterior + PASSO;

  if (proximo <= anterior) {
    throw new Error(
      `Vizinhos fora de ordem: ${anterior} não é menor que ${proximo}. A coluna precisa ser reequilibrada.`,
    );
  }

  if (proximo - anterior < MINIMO) return null;
  return anterior + (proximo - anterior) / 2;
}

/** Posição para um card acrescentado ao fim da coluna. */
export function aoFim(ultimo: number | null): number {
  return ultimo === null ? PASSO : ultimo + PASSO;
}

/** Posição para um card acrescentado no topo — o padrão de "lead novo". */
export function aoInicio(primeiro: number | null): number {
  return primeiro === null ? PASSO : primeiro - PASSO;
}

/**
 * Verdadeiro quando dois vizinhos ficaram próximos demais.
 *
 * Chamado depois de cada movimento. Só dispara depois de muitas inserções
 * seguidas exatamente no mesmo ponto — cerca de 50 divisões ao meio.
 */
export function precisaReequilibrar(ordens: readonly number[]): boolean {
  for (let i = 1; i < ordens.length; i++) {
    const anterior = ordens[i - 1];
    const atual = ordens[i];
    if (anterior === undefined || atual === undefined) continue;
    if (atual - anterior < MINIMO) return true;
  }
  return false;
}

/**
 * Redistribui a coluna preservando a ordem visível.
 *
 * Devolve a nova posição de cada id, na sequência recebida. É o único momento
 * em que a coluna inteira é reescrita — e ele existe justamente para que o
 * arrasto do dia a dia nunca precise fazer isso.
 */
export function reequilibrar(ids: readonly string[]): { id: string; ordem: number }[] {
  return ids.map((id, i) => ({ id, ordem: (i + 1) * PASSO }));
}

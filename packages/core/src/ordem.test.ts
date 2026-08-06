import { describe, expect, it } from "vitest";
import { aoFim, aoInicio, entre, precisaReequilibrar, reequilibrar } from "./ordem";

describe("entre", () => {
  it("coluna vazia recebe a primeira posição", () => {
    expect(entre(null, null)).toBe(1000);
  });

  it("no topo, fica antes do primeiro", () => {
    const r = entre(null, 1000);
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(1000);
  });

  it("no fim, fica depois do último", () => {
    const r = entre(3000, null);
    expect(r!).toBeGreaterThan(3000);
  });

  it("no meio, fica entre os dois", () => {
    const r = entre(1000, 2000);
    expect(r).toBe(1500);
  });

  it("recusa vizinhos fora de ordem", () => {
    // Sinal de dado corrompido: seguir em frente esconderia o problema.
    expect(() => entre(2000, 1000)).toThrow(/fora de ordem/);
    expect(() => entre(1000, 1000)).toThrow(/fora de ordem/);
  });
});

describe("entre — o card não muda de lugar sozinho", () => {
  it("a posição calculada mantém a ordem relativa", () => {
    const meio = entre(1000, 2000)!;
    expect(meio).toBeGreaterThan(1000);
    expect(meio).toBeLessThan(2000);
  });

  it("inserções repetidas no mesmo ponto continuam ordenadas", () => {
    // Cada arrasto para o mesmo lugar divide o espaço ao meio. A ordem tem de
    // se manter mesmo quando o intervalo fica pequeno.
    let anterior = 1000;
    const proximo = 2000;
    const posicoes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const nova = entre(anterior, proximo);
      expect(nova).not.toBeNull();
      posicoes.push(nova!);
      anterior = nova!;
    }

    const ordenadas = [...posicoes].sort((a, b) => a - b);
    expect(posicoes).toEqual(ordenadas);
  });
});

describe("esgotamento de precisão", () => {
  it("devolve null quando não há mais espaço", () => {
    expect(entre(1000, 1000 + 1e-9)).toBeNull();
  });

  it("aguenta muitas divisões antes de esgotar", () => {
    // Se esgotasse em poucas divisões, reequilibrar viraria rotina em vez de
    // exceção — e aí a ordenação fracionária não teria valido a pena.
    const a = 0;
    let b = 1000;
    let divisoes = 0;

    while (divisoes < 100) {
      const meio = entre(a, b);
      if (meio === null) break;
      b = meio;
      divisoes++;
    }

    expect(divisoes).toBeGreaterThan(25);
  });
});

describe("aoInicio e aoFim", () => {
  it("coluna vazia", () => {
    expect(aoInicio(null)).toBe(1000);
    expect(aoFim(null)).toBe(1000);
  });

  it("abre espaço nas bordas", () => {
    expect(aoInicio(1000)).toBe(0);
    expect(aoFim(1000)).toBe(2000);
  });

  it("aceita posição negativa no topo", () => {
    // Inserir sempre no topo empurra para números negativos. Isso é esperado:
    // `numeric` não tem piso, e a ordem relativa é o que importa.
    expect(aoInicio(0)).toBe(-1000);
    expect(aoInicio(-1000)).toBe(-2000);
  });
});

describe("precisaReequilibrar", () => {
  it("coluna saudável não precisa", () => {
    expect(precisaReequilibrar([1000, 2000, 3000])).toBe(false);
  });

  it("coluna vazia ou de um item não precisa", () => {
    expect(precisaReequilibrar([])).toBe(false);
    expect(precisaReequilibrar([1000])).toBe(false);
  });

  it("detecta vizinhos colados", () => {
    expect(precisaReequilibrar([1000, 1000 + 1e-9, 2000])).toBe(true);
  });
});

describe("reequilibrar", () => {
  it("redistribui preservando a sequência recebida", () => {
    const r = reequilibrar(["c", "a", "b"]);
    expect(r).toEqual([
      { id: "c", ordem: 1000 },
      { id: "a", ordem: 2000 },
      { id: "b", ordem: 3000 },
    ]);
  });

  it("o resultado volta a ter espaço para inserções", () => {
    const r = reequilibrar(["a", "b"]);
    const meio = entre(r[0]!.ordem, r[1]!.ordem);
    expect(meio).toBe(1500);
  });

  it("coluna vazia devolve vazio", () => {
    expect(reequilibrar([])).toEqual([]);
  });
});

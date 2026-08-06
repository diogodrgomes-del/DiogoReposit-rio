import { describe, expect, it } from "vitest";
import { formatarTelefone, linkWhatsApp, normalizarTelefone } from "./telefone.js";

/**
 * Esta função decide se uma mensagem de WhatsApp encontra o contato certo. Cada
 * caso aqui é um formato que aparece de verdade — colado de agenda, digitado à
 * mão, vindo da API da Meta ou herdado de planilha antiga.
 */
describe("normalizarTelefone — celular do Paraná", () => {
  const esperado = "+5544998887777";

  it.each([
    ["44998887777", "só os dígitos"],
    ["(44) 99888-7777", "formatado"],
    ["44 99888 7777", "com espaços"],
    ["+55 44 99888-7777", "E.164 formatado"],
    ["5544998887777", "com código do país"],
    ["+5544998887777", "E.164 puro"],
    ["004544998887777".replace("0045", "00"), "prefixo internacional 00"],
    ["044998887777", "zero de operadora"],
    ["44.99888.7777", "com pontos"],
  ])("%s (%s)", (entrada) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });
});

describe("normalizarTelefone — nono dígito", () => {
  it("acrescenta o 9 em celular antigo de 8 dígitos", () => {
    expect(normalizarTelefone("4488887777")).toBe("+5544988887777");
  });

  it("não mexe em fixo de 8 dígitos", () => {
    expect(normalizarTelefone("4432217777")).toBe("+554432217777");
  });

  it("número antigo e número novo da mesma pessoa convergem", () => {
    expect(normalizarTelefone("44 8888-7777")).toBe(normalizarTelefone("44 98888-7777"));
  });
});

describe("normalizarTelefone — DDD", () => {
  it("aceita 55 como DDD do Rio Grande do Sul", () => {
    // A armadilha: 55 também é o código do país. Com 11 dígitos é DDD.
    expect(normalizarTelefone("55998887777")).toBe("+5555998887777");
  });

  it("trata 13 dígitos começando em 55 como código do país", () => {
    expect(normalizarTelefone("5555998887777")).toBe("+5555998887777");
  });

  it("recusa DDD inexistente", () => {
    expect(normalizarTelefone("2098887777")).toBeNull();
    expect(normalizarTelefone("00998887777")).toBeNull();
  });
});

describe("normalizarTelefone — recusas", () => {
  it.each<[string | null | undefined, string]>([
    ["", "vazio"],
    [null, "nulo"],
    [undefined, "indefinido"],
    ["abc", "sem dígito"],
    ["12345", "curto demais"],
    ["44 12345-6789", "celular de 9 dígitos que não começa com 9"],
    ["44 1234-5678", "fixo começando com 1"],
  ])("%s (%s)", (entrada) => {
    expect(normalizarTelefone(entrada)).toBeNull();
  });
});

describe("normalizarTelefone — internacional", () => {
  it("aceita número estrangeiro com + explícito", () => {
    expect(normalizarTelefone("+1 415 555 2671")).toBe("+14155552671");
  });

  it("recusa internacional curto demais", () => {
    expect(normalizarTelefone("+1 415")).toBeNull();
  });
});

describe("idempotência", () => {
  it("normalizar duas vezes dá o mesmo resultado", () => {
    const uma = normalizarTelefone("(44) 99888-7777");
    expect(normalizarTelefone(uma)).toBe(uma);
  });
});

describe("formatarTelefone", () => {
  it("formata celular", () => {
    expect(formatarTelefone("+5544998887777")).toBe("(44) 99888-7777");
  });

  it("formata fixo", () => {
    expect(formatarTelefone("+554432217777")).toBe("(44) 3221-7777");
  });

  it("devolve internacional como está", () => {
    expect(formatarTelefone("+14155552671")).toBe("+14155552671");
  });

  it("aceita vazio", () => {
    expect(formatarTelefone(null)).toBe("");
  });
});

describe("linkWhatsApp", () => {
  it("monta o link", () => {
    expect(linkWhatsApp("+5544998887777")).toBe("https://wa.me/5544998887777");
  });

  it("devolve null sem número", () => {
    expect(linkWhatsApp(null)).toBeNull();
  });
});

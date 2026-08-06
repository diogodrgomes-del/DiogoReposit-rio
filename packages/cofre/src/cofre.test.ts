import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDoCofre, cifrar, cofreConfigurado, decifrar, mascarar, rotacionar } from "./index";

const chave = (): string => randomBytes(32).toString("base64url");
const original = { ...process.env };

beforeEach(() => {
  process.env.COFRE_KEKS = `1:${chave()}`;
  delete process.env.COFRE_KEK_ATUAL;
});

afterEach(() => {
  process.env = { ...original };
});

const AAD = "org-1:cred-1";
const TOKEN = "EAAaAQyGYHBUBO1exemplo7de8token9da0Meta";

describe("ida e volta", () => {
  it("decifra o que cifrou", () => {
    expect(decifrar(cifrar(TOKEN, AAD), AAD)).toBe(TOKEN);
  });

  it("preserva acento e emoji", () => {
    const segredo = "Óticas Gouveia — senha çã 🔐";
    expect(decifrar(cifrar(segredo, AAD), AAD)).toBe(segredo);
  });

  it("aceita segredo vazio", () => {
    expect(decifrar(cifrar("", AAD), AAD)).toBe("");
  });

  it("não guarda o segredo em claro no envelope", () => {
    const e = cifrar(TOKEN, AAD);
    expect(e.segredo.toString("utf8")).not.toContain("EAAa");
    expect(e.segredo.toString("base64")).not.toContain(Buffer.from(TOKEN).toString("base64"));
  });

  it("duas cifragens do mesmo segredo dão bytes diferentes", () => {
    // Nonce e DEK aleatórios: sem isso, dois clientes com a mesma senha
    // teriam o mesmo texto cifrado, o que já é um vazamento.
    const a = cifrar(TOKEN, AAD);
    const b = cifrar(TOKEN, AAD);
    expect(a.segredo.equals(b.segredo)).toBe(false);
    expect(a.dek.equals(b.dek)).toBe(false);
  });
});

describe("AAD — o envelope não é transplantável", () => {
  it("recusa decifrar com outro aad", () => {
    const e = cifrar(TOKEN, "org-1:cred-1");
    expect(() => decifrar(e, "org-1:cred-2")).toThrow();
  });

  it("recusa decifrar em outra organização", () => {
    const e = cifrar(TOKEN, "org-1:cred-1");
    expect(() => decifrar(e, "org-2:cred-1")).toThrow();
  });

  it("exige aad na cifragem", () => {
    expect(() => cifrar(TOKEN, "")).toThrow(ErroDoCofre);
  });
});

describe("integridade", () => {
  it("recusa segredo adulterado", () => {
    const e = cifrar(TOKEN, AAD);
    const ultimo = e.segredo.length - 1;
    e.segredo.writeUInt8(e.segredo.readUInt8(ultimo) ^ 0xff, ultimo); // mexe na tag
    expect(() => decifrar(e, AAD)).toThrow();
  });

  it("recusa DEK adulterada", () => {
    const e = cifrar(TOKEN, AAD);
    e.dek.writeUInt8(e.dek.readUInt8(0) ^ 0xff, 0);
    expect(() => decifrar(e, AAD)).toThrow();
  });

  it("recusa envelope truncado", () => {
    const e = cifrar(TOKEN, AAD);
    e.segredo = e.segredo.subarray(0, 10);
    expect(() => decifrar(e, AAD)).toThrow(ErroDoCofre);
  });

  it("recusa envelope de outra chave mestra", () => {
    const e = cifrar(TOKEN, AAD);
    process.env.COFRE_KEKS = `1:${chave()}`; // outra chave, mesma versão
    expect(() => decifrar(e, AAD)).toThrow();
  });
});

describe("rotação de chave mestra", () => {
  it("recifra a DEK e mantém o segredo legível", () => {
    const k1 = chave();
    process.env.COFRE_KEKS = `1:${k1}`;
    const e = cifrar(TOKEN, AAD);
    expect(e.versaoKek).toBe(1);

    process.env.COFRE_KEKS = `1:${k1},2:${chave()}`;
    process.env.COFRE_KEK_ATUAL = "2";

    const novo = rotacionar(e, AAD);
    expect(novo.versaoKek).toBe(2);
    expect(decifrar(novo, AAD)).toBe(TOKEN);
  });

  it("não mexe no texto cifrado do segredo", () => {
    // É o que torna a rotação barata: custo por linha, não por tamanho.
    const k1 = chave();
    process.env.COFRE_KEKS = `1:${k1}`;
    const e = cifrar(TOKEN, AAD);

    process.env.COFRE_KEKS = `1:${k1},2:${chave()}`;
    process.env.COFRE_KEK_ATUAL = "2";
    expect(rotacionar(e, AAD).segredo.equals(e.segredo)).toBe(true);
  });

  it("segredos antigos continuam legíveis durante a rotação", () => {
    const k1 = chave();
    process.env.COFRE_KEKS = `1:${k1}`;
    const antigo = cifrar(TOKEN, AAD);

    process.env.COFRE_KEKS = `1:${k1},2:${chave()}`;
    process.env.COFRE_KEK_ATUAL = "2";
    const novo = cifrar("outro segredo", AAD);

    expect(novo.versaoKek).toBe(2);
    expect(decifrar(antigo, AAD)).toBe(TOKEN);
    expect(decifrar(novo, AAD)).toBe("outro segredo");
  });

  it("avisa de forma acionável quando a chave antiga sumiu", () => {
    const e = cifrar(TOKEN, AAD);
    process.env.COFRE_KEKS = `2:${chave()}`;
    process.env.COFRE_KEK_ATUAL = "2";
    expect(() => decifrar(e, AAD)).toThrow(/irrecuperável/);
  });

  it("sem COFRE_KEK_ATUAL, cifra com a versão mais nova", () => {
    process.env.COFRE_KEKS = `1:${chave()},3:${chave()},2:${chave()}`;
    expect(cifrar(TOKEN, AAD).versaoKek).toBe(3);
  });
});

describe("configuração", () => {
  it("recusa chave de tamanho errado", () => {
    process.env.COFRE_KEKS = `1:${randomBytes(16).toString("base64url")}`;
    expect(() => cifrar(TOKEN, AAD)).toThrow(/32/);
  });

  it("erro de KEK ausente diz como gerar uma", () => {
    delete process.env.COFRE_KEKS;
    expect(() => cifrar(TOKEN, AAD)).toThrow(/randomBytes\(32\)/);
  });

  it("cofreConfigurado responde sem lançar", () => {
    expect(cofreConfigurado()).toBe(true);
    delete process.env.COFRE_KEKS;
    expect(cofreConfigurado()).toBe(false);
  });
});

describe("mascarar", () => {
  it("mostra as pontas de um token longo", () => {
    const m = mascarar(TOKEN);
    expect(m.startsWith("EAAa")).toBe(true);
    expect(m.endsWith("Meta")).toBe(true);
    expect(m).not.toContain("exemplo");
  });

  it("esconde segredo curto por inteiro", () => {
    expect(mascarar("12345678")).toBe("••••••••");
  });
});

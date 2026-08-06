import { pbkdf2Sync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { derivar, verificar } from "./senha";

/**
 * Gera um hash no formato exato do painel de campanhas, com o mesmo algoritmo
 * de `scripts/gerar-senha.mjs`. Se esta função e a verificação divergirem, os
 * usuários existentes não conseguem entrar depois da migração — e é justamente
 * isso que o teste protege.
 */
function hashAntigo(senha: string, iteracoes = 210_000): string {
  const sal = randomBytes(16);
  const hash = pbkdf2Sync(senha, sal, iteracoes, 32, "sha256");
  return `pbkdf2.${iteracoes}.${sal.toString("base64url")}.${hash.toString("base64url")}`;
}

describe("argon2id", () => {
  it("confere a senha certa", async () => {
    const h = await derivar("senha bem comprida");
    expect(h.startsWith("$argon2id$")).toBe(true);
    await expect(verificar("senha bem comprida", h)).resolves.toMatchObject({ confere: true });
  });

  it("recusa a senha errada", async () => {
    const h = await derivar("senha bem comprida");
    await expect(verificar("senha bem compridA", h)).resolves.toMatchObject({ confere: false });
  });

  it("não pede regravação", async () => {
    const h = await derivar("senha bem comprida");
    await expect(verificar("senha bem comprida", h)).resolves.toMatchObject({
      precisaRegravar: false,
    });
  });

  it("recusa senha curta na derivação", async () => {
    await expect(derivar("curta")).rejects.toThrow(/12 caracteres/);
  });

  it("dois hashes da mesma senha são diferentes", async () => {
    const [a, b] = await Promise.all([derivar("senha bem comprida"), derivar("senha bem comprida")]);
    expect(a).not.toBe(b);
  });
});

describe("compatibilidade com o painel antigo", () => {
  it("aceita hash PBKDF2 existente", async () => {
    const r = await verificar("senha do painel", hashAntigo("senha do painel"));
    expect(r.confere).toBe(true);
  });

  it("marca para regravar em argon2id", async () => {
    const r = await verificar("senha do painel", hashAntigo("senha do painel"));
    expect(r.precisaRegravar).toBe(true);
  });

  it("recusa senha errada no formato antigo", async () => {
    const r = await verificar("outra senha", hashAntigo("senha do painel"));
    expect(r).toEqual({ confere: false, precisaRegravar: false });
  });

  it("respeita a contagem de iterações gravada", async () => {
    const r = await verificar("senha do painel", hashAntigo("senha do painel", 100_000));
    expect(r.confere).toBe(true);
  });

  it("recusa hash com iterações abaixo do mínimo aceitável", async () => {
    const r = await verificar("senha do painel", hashAntigo("senha do painel", 10));
    expect(r.confere).toBe(false);
  });
});

describe("entradas degeneradas", () => {
  it("hash nulo não confere e não estoura", async () => {
    await expect(verificar("qualquer", null)).resolves.toEqual({
      confere: false,
      precisaRegravar: false,
    });
  });

  it("formato desconhecido não confere", async () => {
    await expect(verificar("qualquer", "md5:abc")).resolves.toMatchObject({ confere: false });
  });

  it("hash PBKDF2 truncado não confere", async () => {
    await expect(verificar("qualquer", "pbkdf2.210000.abc")).resolves.toMatchObject({
      confere: false,
    });
  });
});

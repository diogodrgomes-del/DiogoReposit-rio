import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * As fronteiras do monorepo valem tanto quanto o lint que as aplica — e este
 * lint já falhou em silêncio uma vez: `no-restricted-imports` não acumula entre
 * blocos de configuração, então um bloco posterior apagava o anterior sem erro
 * nenhum. Tudo continuava verde e nada estava protegido.
 *
 * Estes testes rodam o ESLint de verdade sobre código inventado e conferem que
 * ele **reprova**. É a única forma de saber que a regra está ligada.
 */

const eslint = new ESLint({ cwd: process.cwd() });

async function erros(codigo: string, caminho: string): Promise<string[]> {
  const [r] = await eslint.lintText(codigo, { filePath: caminho });
  return (r?.messages ?? []).map((m) => `${m.ruleId}: ${m.message}`);
}

const contem = (msgs: string[], trecho: string) => msgs.some((m) => m.includes(trecho));

describe("fronteira do @mark/core", () => {
  const NEGA = "não conhece apresentação nem sessão";

  it("recusa importar React", async () => {
    const msgs = await erros(
      `import { useState } from "react";\nexport const x = useState;\n`,
      "packages/core/src/exemplo.ts",
    );
    expect(contem(msgs, NEGA)).toBe(true);
  });

  it("recusa importar Next", async () => {
    const msgs = await erros(
      `import { cookies } from "next/headers";\nexport const x = cookies;\n`,
      "packages/core/src/exemplo.ts",
    );
    expect(contem(msgs, NEGA)).toBe(true);
  });

  it("recusa importar @mark/auth — quem monta o Contexto é ele, não o core", async () => {
    const msgs = await erros(
      `import { sessao } from "@mark/auth";\nexport const x = sessao;\n`,
      "packages/core/src/exemplo.ts",
    );
    expect(contem(msgs, NEGA)).toBe(true);
  });

  it("aceita o banco — o core é TypeScript sobre Drizzle", async () => {
    const msgs = await erros(
      `import { comContexto } from "@mark/db";\nexport const x = comContexto;\n`,
      "packages/core/src/exemplo.ts",
    );
    expect(contem(msgs, "no-restricted-imports")).toBe(false);
  });

  it("recusa comoAdmin mesmo no core", async () => {
    const msgs = await erros(
      `import { comoAdmin } from "@mark/db";\nexport const x = comoAdmin;\n`,
      "packages/core/src/exemplo.ts",
    );
    expect(contem(msgs, "comoAdmin ignora a RLS")).toBe(true);
  });

  it("aceita import interno", async () => {
    const msgs = await erros(
      `import { pode } from "./contexto.js";\nexport const x = pode;\n`,
      "packages/core/src/exemplo.ts",
    );
    expect(contem(msgs, "no-restricted-imports")).toBe(false);
  });
});

describe("fronteira do comoAdmin", () => {
  it("recusa em @mark/auth", async () => {
    const msgs = await erros(
      `import { comoAdmin } from "@mark/db";\nexport const x = comoAdmin;\n`,
      "packages/auth/src/exemplo.ts",
    );
    expect(contem(msgs, "comoAdmin ignora a RLS")).toBe(true);
  });

  it("recusa no worker", async () => {
    const msgs = await erros(
      `import { comoAdmin } from "@mark/db";\nexport const x = comoAdmin;\n`,
      "apps/worker/src/exemplo.ts",
    );
    expect(contem(msgs, "comoAdmin ignora a RLS")).toBe(true);
  });

  it("aceita comContexto no lugar", async () => {
    const msgs = await erros(
      `import { comContexto } from "@mark/db";\nexport const x = comContexto;\n`,
      "packages/auth/src/exemplo.ts",
    );
    expect(contem(msgs, "no-restricted-imports")).toBe(false);
  });

  it("permite na CLI de manutenção, que é para onde ela existe", async () => {
    const msgs = await erros(
      `import { comoAdmin } from "../cliente.js";\nexport const x = comoAdmin;\n`,
      "packages/db/src/cli/exemplo.ts",
    );
    expect(contem(msgs, "comoAdmin ignora a RLS")).toBe(false);
  });
});

describe("fronteira de aplicação", () => {
  it("pacote não importa app", async () => {
    const msgs = await erros(
      `import { algo } from "@mark/web";\nexport const x = algo;\n`,
      "packages/auth/src/exemplo.ts",
    );
    expect(contem(msgs, "sentido contrário")).toBe(true);
  });
});

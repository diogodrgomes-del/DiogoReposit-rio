import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A fronteira entre navegador e servidor.
 *
 * `@mark/core` reexporta as regras de negócio, que falam com Drizzle. Um único
 * `import` de **valor** a partir dele dentro de um componente `"use client"`
 * arrasta o driver do Postgres para o pacote que vai ao navegador — e o build
 * quebra com um rastro de vinte linhas apontando para `node_modules/pg`.
 *
 * Aconteceu com o quadro Kanban. `@mark/core/navegador` existe para isso: só
 * telefone, ordenação, permissões e tipos, sem nada que toque em banco.
 *
 * O build do Next também pega o problema, mas leva minutos e a mensagem não diz
 * o que fazer. Este teste leva milissegundos e diz.
 */

const RAIZ = new URL("../apps/web/src", import.meta.url).pathname;

async function arquivos(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true });
  const saida: string[] = [];
  for (const e of entradas) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) saida.push(...(await arquivos(caminho)));
    else if (/\.tsx?$/.test(e.name)) saida.push(caminho);
  }
  return saida;
}

/** Import de valor — `import type` é apagado na compilação e não pesa nada. */
const IMPORT_DE_VALOR_DO_CORE = /^\s*import\s+(?!type\s)[^;]*?from\s+["']@mark\/(core|db|auth|cofre)["']/m;

describe("componentes de cliente não importam o servidor", () => {
  it("nenhum arquivo 'use client' importa valor de @mark/core, db, auth ou cofre", async () => {
    const todos = await arquivos(RAIZ);
    const infratores: string[] = [];

    for (const caminho of todos) {
      const conteudo = await readFile(caminho, "utf8");
      const ehCliente = /^\s*["']use client["']/.test(conteudo);
      if (!ehCliente) continue;

      if (IMPORT_DE_VALOR_DO_CORE.test(conteudo)) {
        infratores.push(caminho.replace(RAIZ, "apps/web/src"));
      }
    }

    expect(
      infratores,
      `Use "@mark/core/navegador" nestes componentes de cliente:\n${infratores.join("\n")}`,
    ).toEqual([]);
  });

  it("a varredura de fato encontra componentes de cliente", async () => {
    // Sem esta conferência, o teste acima passaria por não ter olhado nada — o
    // falso verde clássico de teste que varre diretório.
    const todos = await arquivos(RAIZ);
    let clientes = 0;
    for (const caminho of todos) {
      const conteudo = await readFile(caminho, "utf8");
      if (/^\s*["']use client["']/.test(conteudo)) clientes++;
    }
    expect(clientes).toBeGreaterThan(3);
  });
});

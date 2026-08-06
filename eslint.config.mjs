import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Regras do monorepo.
 *
 * A parte que importa são as fronteiras: `packages/core` não pode importar
 * React, Next nem banco, e `comoAdmin` — que ignora a RLS — não pode sair da
 * CLI de manutenção. As duas coisas se perdem por descuido, então ficam no
 * lint e não na disciplina.
 *
 * Cuidado ao mexer: `no-restricted-imports` não acumula entre blocos. Quando
 * dois blocos casam com o mesmo arquivo, o último substitui o primeiro por
 * inteiro — e a regra some sem erro nenhum. Por isso cada arquivo casa com
 * exatamente um bloco de fronteira, garantido pelos `ignores`.
 * `testes/fronteiras.test.ts` confere que as duas ainda disparam.
 */

const PROIBIDO_APLICACAO = {
  group: ["@mark/web", "@mark/web/*", "**/apps/*"],
  message: "Pacote não importa aplicação. A dependência vai no sentido contrário.",
};

const PROIBIDO_COMO_ADMIN = {
  name: "@mark/db",
  importNames: ["comoAdmin"],
  message: "comoAdmin ignora a RLS. Use comContexto. Só packages/db/src/cli pode chamá-la.",
};

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "apps/web/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": "off",
    },
  },

  // Fronteira 1 — pacotes e worker em geral.
  {
    files: ["packages/**/*.ts", "apps/worker/**/*.ts"],
    ignores: ["packages/core/**", "packages/db/src/cli/**", "packages/db/testes/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [PROIBIDO_COMO_ADMIN], patterns: [PROIBIDO_APLICACAO] },
      ],
    },
  },

  // Fronteira 2 — o núcleo de regra de negócio, mais estrita que as demais.
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            PROIBIDO_APLICACAO,
            {
              group: ["react", "react-*", "next", "next/*", "@mark/db", "@mark/auth"],
              message:
                "@mark/core é regra de negócio pura. Sem React, sem Next, sem banco — é o que permite reusá-la no worker, num script e numa API futura sem reescrever autorização.",
            },
          ],
        },
      ],
    },
  },
);

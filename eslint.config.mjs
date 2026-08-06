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
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**"] },
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

  {
    // Scripts Node avulsos: o TypeScript resolve os globais pelos tipos, mas o
    // .mjs não passa por ele.
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", Buffer: "readonly" },
    },
  },

  // Fronteira 1 — pacotes e aplicações.
  //
  // apps/web entrou aqui quando passou a importar @mark/*: é justamente onde
  // uma chamada a comoAdmin seria mais perigosa, porque é o código que atende
  // requisição de navegador.
  {
    files: ["packages/**/*.ts", "packages/**/*.tsx", "apps/**/*.ts", "apps/**/*.tsx"],
    ignores: ["packages/core/**", "packages/db/src/cli/**", "packages/db/testes/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [PROIBIDO_COMO_ADMIN], patterns: [PROIBIDO_APLICACAO] },
      ],
    },
  },

  // Fronteira 2 — o núcleo de regra de negócio.
  //
  // Pode falar com o banco: é TypeScript sobre Drizzle, e é aí que a
  // autorização mora. O que não pode é conhecer camada de apresentação nem
  // sessão — é isso que permite a mesma regra rodar na web, no worker, num
  // script e numa API futura sem reescrever autorização.
  //
  // @mark/auth fica de fora também por ser circular: auth importa core.
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [PROIBIDO_COMO_ADMIN],
          patterns: [
            PROIBIDO_APLICACAO,
            {
              group: ["react", "react-*", "next", "next/*", "@mark/auth"],
              message:
                "@mark/core não conhece apresentação nem sessão. Recebe Contexto por parâmetro; quem monta o Contexto é @mark/auth.",
            },
          ],
        },
      ],
    },
  },
);

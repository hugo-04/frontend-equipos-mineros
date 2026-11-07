import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "scripts/**",
    ".next/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",
    "src/shared/types/api.generated.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "react/no-danger": "error",
    },
  },
  {
    // Los componentes y páginas nunca llaman a fetch: lo hace la capa api/
    files: ["src/**/components/**/*.{ts,tsx}", "src/app/**/page.tsx", "src/app/**/layout.tsx"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Usa la capa api/ (shared/api o features/*/api)." },
      ],
    },
  },
]);

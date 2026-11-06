import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist", ".npm-cache", "qa"] },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["src/main.tsx"],
    rules: {
      // Load component modules before the shared/global styles, preserving the CSS cascade.
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^react(?:/|$)", "^react-dom(?:/|$)"],
            ["^\\./app/App$"],
            ["^\\u0000"],
          ],
        },
      ],
    },
  },
);

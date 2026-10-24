import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import globals from "globals";

export default defineConfig([
  globalIgnores(["build/", "node_modules/"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      // @vitejs/plugin-react compiles JSX with the automatic runtime (React 17's new JSX transform).
      react.configs.flat["jsx-runtime"],
      // lesson-id.jsx default-exports withOrientationChange(Component) (react-device-detect).
      reactRefresh.configs.vite({ extraHOCs: ["withOrientationChange"] }),
    ],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      // Classic hook rules only; the plugin's React Compiler rules don't apply to this React 17 app.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // The codebase doesn't use PropTypes; adding them everywhere is out of scope.
      "react/prop-types": "off",
      // Prose in JSX (terms, research copy) uses plain quotes/apostrophes throughout.
      "react/no-unescaped-entities": "off",
      // Default `React` imports are left over from the classic JSX runtime; unused callback
      // args and catch bindings document the call signature.
      "no-unused-vars": ["error", { varsIgnorePattern: "^React$", args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Context modules export their context + hook alongside the provider; HMR falls back to a reload.
    files: ["src/provider/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Node-side config files.
    files: ["*.mjs"],
    languageOptions: { globals: globals.node },
  },
]);

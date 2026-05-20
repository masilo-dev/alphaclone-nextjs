import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "error", // Keep this as error
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "import/no-anonymous-default-export": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react/display-name": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Service worker and PWA generated files
    "public/sw.js",
    "public/sw.js.map",
    "public/workbox-*.js",
    // PDF.js vendor bundle (third-party, not authored here)
    "public/pdfjs/**",
    // Other vendor/generated assets under public
    "public/vendor/**",
    // One-off migration/fix scripts
    "demo_data_fix.ts",
    "scripts/**",
    // Mobile sub-project has its own ESLint config
    "mobile/**",
  ]),
]);

export default eslintConfig;

import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next already globally ignores `.next/**`, `out/**`, `build/**`
// and `next-env.d.ts`; both presets below carry that list. Add an `ignores`
// entry only to extend it, or to negate one of its entries with `!<path>`.
const eslintConfig = defineConfig([...nextVitals, ...nextTs]);

export default eslintConfig;

import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next already globally ignores `.next/**`, `out/**`, `build/**`
// and `next-env.d.ts`. Both `core-web-vitals` and `typescript` carry that same
// list and both are spread in below, so the block that used to restate it here
// changed nothing. Add an `ignores` entry only to extend that list, or to
// negate one of its entries with `!<path>`.
const eslintConfig = defineConfig([...nextVitals, ...nextTs]);

export default eslintConfig;

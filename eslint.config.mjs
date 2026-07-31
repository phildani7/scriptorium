import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Generated output and vendored runtimes. These are render bundles,
    // screenshot staging areas and a copy of minified GSAP — nothing here is
    // authored, and linting it reports the same eight complaints about
    // someone else's minifier once per bundle, which buries the findings that
    // are about this repo's own code.
    ".render/**",
    ".render-tmp/**",
    ".smoke/**",
    "renders/**",
    "public/vendor/**",
    "public/preview/**",
    "public/__smoke/**",
  ]),
]);

export default eslintConfig;

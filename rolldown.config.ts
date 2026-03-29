import { defineConfig } from "rolldown";

const isProd =
  process.env.NODE_ENV === "production" || process.env.CI === "true";

export default defineConfig([
  {
    input: "src/extension.ts",
    external: ["vscode"],
    platform: "node",
    ...(isProd && { treeshake: true }),
    output: {
      file: "dist/extension.js",
      format: "cjs",
      sourcemap: !isProd,
      ...(isProd && { minify: true }),
    },
  },
]);

import { defineConfig } from "bunup";
import { copy } from "bunup/plugins";

export default defineConfig([
  {
    entry: "src/index.ts",
    format: "esm",
    target: "node",
    outDir: "dist",
    clean: true,
    plugins: [copy(["src/components"])],
  },
  {
    entry: "src/client.ts",
    format: "esm",
    target: "browser",
    outDir: "dist",
    outFile: "client.js",
  },
]);

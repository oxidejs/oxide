import { defineConfig } from "bunup";
import { copy } from "bunup/plugins";

export default defineConfig({
  entry: "src/index.ts",
  format: "esm",
  target: "node",
  outDir: "dist",
  clean: true,
  dts: true,
  plugins: [copy(["src/virtual.d.ts"])],
});

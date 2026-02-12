import { defineConfig } from "tsdown";
import svelte from "rollup-plugin-svelte";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts", "src/nitro.ts"],
  dts: true,
  platform: "node",
  plugins: [svelte({ preprocess: vitePreprocess(), compilerOptions: { experimental: { async: true } } })],
});

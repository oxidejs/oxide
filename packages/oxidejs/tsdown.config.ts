import { defineConfig } from "tsdown";
import svelte from "rollup-plugin-svelte";
import { sveltePreprocess } from "svelte-preprocess";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts", "src/nitro.ts"],
  dts: true,
  platform: "node",
  plugins: [svelte({ preprocess: sveltePreprocess() })],
});

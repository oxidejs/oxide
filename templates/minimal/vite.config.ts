import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { withOxide } from "oxidejs/nitro";
// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss(), nitro()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
      $assets: path.resolve("./src/assets"),
    },
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: ".oxide/client.ts",
        },
      },
    },
  },
  nitro: withOxide(),
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import { oxide } from "@oxidejs/framework";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: [
      {
        find: "$lib",
        replacement: fileURLToPath(new URL("./src/lib", import.meta.url)),
      },
    ],
  },
  nitro: {
    alias: {
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
    },
    noExternals: true,
  },
  environments: {
    client: { build: { rollupOptions: { input: "./src/client.ts" } } },
    ssr: { build: { rollupOptions: { input: "./src/server.ts" } } },
  },
  plugins: [
    tailwindcss(),
    svelte({ compilerOptions: { experimental: { async: true } } }),
    nitro(),
    oxide(),
  ],
});

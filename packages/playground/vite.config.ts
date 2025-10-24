import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import { oxide } from "@oxidejs/framework";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: [{ find: "$lib", replacement: resolve(__dirname, "src/lib") }],
  },
  plugins: [
    tailwindcss(),
    svelte({ compilerOptions: { experimental: { async: true } } }),
    nitro({
      services: { ssr: { entry: "./src/server.ts" } },
    }),
    oxide({
      pagesDir: "src/app",
      routersDir: "src/routers",
      dts: true,
    }),
  ],
});

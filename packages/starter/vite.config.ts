import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    nitro({
      services: { ssr: { entry: "./src/server.ts" } },
    }),
    tailwindcss(),
  ],
});

# Progressive Web App

PWA is a web application that can be installed on the user's device and can be used offline. It is a great way to provide a native-like experience to your web application.

## Installation

1. Install `vite-plugin-pwa`.

::: details Install with NPM {open}

```sh
npm i vite-plugin-pwa
```

:::
::: details Install with Bun

```sh
bun add vite-plugin-pwa
```

:::

2. Add it to `vite.config.ts`.

```ts{21-42} twoslash
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import { oxide } from "@oxidejs/framework";
import { VitePWA } from "vite-plugin-pwa"; // [!code ++]

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
    oxide(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      includeAssets: [
        /* Add icons here */
      ],
      manifest: {
        name: "Oxide",
        short_name: "Oxide",
        description: "My app description.",
        theme_color: "#000000",
        icons: [
          // ...
          {
            src: "512.png",
            sizes: "512x512",
            type: "image/png",
          },
          // ...
        ],
      },
    }),
  ],
});
```

3. Add head meta tags.

```svelte{7-15} twoslash
// src/app.svelte
<script lang="ts">
  import Router from '@oxidejs/framework/router.svelte';
  import './app.css';
</script>

<svelte:head>
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Oxide</title>
    <meta name="description" content="My app description." />
    <meta name="theme-color" content="#000000" />
    <link rel="mask-icon" href="/icon.svg" color="#ffffff" />
    <link rel="apple-touch-icon" href="/180.png" sizes="180x180" />
</svelte:head>

<Router />
```

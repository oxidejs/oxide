import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import { copyOrDownloadAsMarkdownButtons } from "vitepress-plugin-llms";
import taskLists from "markdown-it-task-lists";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/oxide",
  srcDir: "docs",
  title: "Oxide",
  description: "Highly adjustable Vite and Nitro based Svelte Web Framework.",
  head: [["link", { rel: "icon", href: "/logo-tiny.svg" }]],
  markdown: {
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
      md.use(taskLists);
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/logo-tiny.svg",
    search: {
      provider: "local",
    },
    editLink: {
      pattern: "https://github.com/oxidejs/oxide/edit/main/docs/:path",
    },
    footer: {
      message: "Made in Poland 🇵🇱🇪🇺",
      copyright: "Copyright © 2025 Oxide. Released under the MIT license.",
    },
    nav: [
      { text: "Home", link: "/" },
      { text: "Reference", link: "/reference" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Start here", link: "/start" },
          { text: "Project Structure", link: "/project-structure" },
          { text: "Routing", link: "/routing" },
          { text: "Navigation", link: "/navigation" },
          { text: "Data Loading", link: "/data-loading" },
          { text: "oRPC", link: "/orpc" },
          { text: "Styling", link: "/styling" },
          { text: "Deploy Your App", link: "/deploy" },
        ],
      },
      {
        text: "Recipes",
        items: [
          { text: "AI", link: "/ai" },
          { text: "Database", link: "/database" },
          { text: "Authentication", link: "/authentication" },
          { text: "KV Storage", link: "/kv" },
          { text: "Progressive Web App", link: "/pwa" },
          { text: "Desktop App", link: "/desktop" },
          { text: "Payments", link: "/payments" },
        ],
      },
      {
        text: "API reference",
        link: "/reference",
      },
      {
        text: "Roadmap",
        link: "/roadmap",
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/oxidejs/oxide" },
      { icon: "x", link: "https://x.com/oxidejs" },
      { icon: "discord", link: "https://discord.gg/WnVTMCTz74" },
    ],
  },
  vite: {
    plugins: [llmstxt()],
  },
});

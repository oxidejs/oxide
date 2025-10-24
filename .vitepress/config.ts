import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/oxide",
  srcDir: "docs",
  title: "Oxide",
  description: "Highly adjustable Vite and Nitro based Svelte Web Framework.",
  head: [["link", { rel: "icon", href: "/logo-tiny.svg" }]],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/logo-tiny.svg",
    search: {
      provider: "local",
    },
    editLink: {
      pattern: "https://github.com/oxidejs/oxide/edit/main/:path",
    },
    nav: [
      { text: "Home", link: "/" },
      { text: "Examples", link: "/markdown-examples" },
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
          { text: "Styling", link: "/styling" },
          { text: "API Routes", link: "/api-routes" },
          { text: "Deploy Your Apps", link: "/deploy" },
        ],
      },
      {
        text: "Recipes",
        items: [
          { text: "Drizzle ORM", link: "/drizzle" },
          { text: "Better Auth", link: "/better-auth" },
          { text: "AI Streaming", link: "/ai-streaming" },
        ],
      },
      {
        text: "API reference",
        link: "/reference",
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/oxidejs/oxide" },
      { icon: "x", link: "https://x.com/oxidejs" },
      { icon: "discord", link: "https://discord.gg/WnVTMCTz74" },
    ],
  },
});

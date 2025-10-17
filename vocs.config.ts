import { defineConfig } from "vocs";

export default defineConfig({
  title: "Oxide",
  basePath: "/oxide",
  description:
    "Oxide.js is a Svelte and TypeScript web framework for building full-stack applications. Use Svelte to build rich user interfaces, and Oxide will provide building blocks for the server side of your application.",
  editLink: {
    pattern: "https://github.com/oxidejs/oxide/edit/main/docs/:path",
    text: "Suggest changes to this page",
  },
  socials: [
    {
      icon: "github",
      link: "https://github.com/oxidejs/oxide",
    },
    {
      icon: "discord",
      link: "https://discord.gg/WnVTMCTz74",
    },
    {
      icon: "x",
      link: "https://x.com/oxidejs",
    },
  ],
  sidebar: [
    {
      text: "Getting Started",
      link: "/docs",
    },
  ],
  topNav: [
    {
      text: "Docs",
      link: "/docs",
    },
  ],
  theme: {
    variables: {
      fontFamily: {
        default: '"Geist Variable", sans-serif',
      },
    },
  },
});

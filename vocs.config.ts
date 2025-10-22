import { ModuleResolutionKind } from "typescript";
import { defineConfig } from "vocs";

export default defineConfig({
  title: "Oxide",
  basePath: "/oxide",
  logoUrl: "/logo-tiny.svg",
  iconUrl: "/logo-tiny.svg",
  description:
    "Oxide.js is a Svelte and TypeScript web framework for building full-stack applications. Use Svelte to build rich user interfaces, and Oxide will provide building blocks for the server side of your application.",
  editLink: {
    pattern: "https://github.com/oxidejs/oxide/edit/main/:path",
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
      items: [
        { text: "Start here", link: "/docs" },
        { text: "Project Structure", link: "/docs/project-structure" },
        { text: "Routing", link: "/docs/routing" },
        { text: "Navigation", link: "/docs/navigation" },
        { text: "Data Loading", link: "/docs/data-loading" },
        { text: "Styling", link: "/docs/styling" },
        { text: "API Routes", link: "/docs/api-routes" },
        { text: "Deploy Your Apps", link: "/docs/deploy" },
      ],
    },
    {
      text: "Extensions",
      items: [{ text: "ORPC", link: "/docs/orpc" }],
    },
    {
      text: "Recipes",
      items: [
        { text: "Drizzle ORM", link: "/docs/drizzle" },
        { text: "Better Auth", link: "/docs/better-auth" },
        { text: "AI Streaming", link: "/docs/ai-streaming" },
      ],
    },
    {
      text: "Reference",
      items: [
        { text: "@oxidejs/framework", link: "/docs/oxide-framework" },
        { text: "@oxidejs/orpc", link: "/docs/oxide-orpc" },
      ],
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
  twoslash: {
    compilerOptions: {
      moduleResolution: ModuleResolutionKind.Bundler,
    },
  },
});

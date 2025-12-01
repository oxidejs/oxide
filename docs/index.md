---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Oxide"
  text: "Modern Svelte Web Framework"
  tagline: "Full-stack, type-safe web framework built on Vite, Nitro, and Svelte 5."
  actions:
    - theme: brand
      text: Get Started
      link: /start
    - theme: alt
      text: View on GitHub
      link: https://github.com/oxidejs/oxide

features:
  - title: 🛡️ Type Safety First
    details: End-to-end type safety from database to UI with automatic type generation for routes and APIs.
  - title: 🚀 File System Router
    details: Convention-based routing with layouts, dynamic routes, and catch-all patterns. No configuration needed.
  - title: 🔗 Isomorphic oRPC
    details: Type-safe API layer with SSR optimization. Same code runs on server and client without HTTP overhead.
  - title: ⚡ Vite & Nitro Powered
    details: Built on battle-tested tools with instant HMR, optimized builds, and universal deployment.
  - title: 🎯 SSR by Default
    details: Server-side rendering with progressive enhancement. Opt into SPA mode where needed.
  - title: 📱 Developer Experience
    details: Hot reload, error boundaries, type generation, and comprehensive tooling for productive development.
---

## Quick Example

Create a full-stack application with just a few files:

```svelte
<!-- src/app/index.svelte -->
<script lang="ts">
  import { rpc } from '$oxide'

  const posts = await rpc.api.posts.list()
</script>

<h1>Latest Posts</h1>
{#each posts as post}
  <article>{post.title}</article>
{/each}
```

```typescript
// src/app/api/posts.ts
import { base } from "$lib/orpc";

export const router = {
  list: base.handler(async ({ context }) => {
    return await context.db.posts.findMany();
  }),
};
```

## Core Features

### 🗂️ File System Routing

Organize your app with intuitive file structure:

```
src/app/
├── index.svelte           → /
├── about.svelte          → /about
├── users/
│   ├── [id].svelte       → /users/:id
│   └── [id]/
│       └── settings.svelte → /users/:id/settings
└── api/
    ├── users.ts          → /api/users/*
    └── posts.ts          → /api/posts/*
```

### 🔌 Type-Safe APIs

Build APIs with full type safety and automatic client generation:

```typescript
// Define once
export const router = {
  getUser: base
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      return await context.db.users.findUnique({ where: { id: input.id } });
    }),
};

// Use everywhere with full types
const user = await rpc.api.users.getUser({ id: "123" });
```

### 🎨 Modern Svelte 5

Leverage the latest Svelte features with runes and enhanced reactivity:

```svelte
<script lang="ts">
  import { useRoute, rpc } from '$oxide'

  const route = useRoute()
  let posts = $state([])

  $effect(() => {
    const query = route.query.get('q') || ''
    rpc.api.posts.search({ query }).then(results => {
      posts = results
    })
  })
</script>
```

## Why Oxide?

- **Zero Configuration**: File system conventions eliminate boilerplate
- **Full-Stack Types**: Never lose type safety between frontend and backend
- **SSR Optimized**: Fast initial loads with progressive enhancement
- **Developer First**: Excellent tooling, error messages, and debugging experience
- **Production Ready**: Built for scale with proper error handling and performance optimization

## Get Started

Ready to build your next application? [Get started](/start) with Oxide in minutes.

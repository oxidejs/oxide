# @oxidejs/framework

A comprehensive filesystem-based router for Svelte applications with TypeScript support, zero-config routing, and powerful extensibility.

## Features

- 🗂️ **Filesystem-based routing** - Routes automatically generated from your file structure
- ⚡ **Zero configuration** - Works out of the box with sensible defaults
- 🔒 **TypeScript support** - Full type safety with auto-generated route types
- 🔥 **Hot Module Reloading** - Instant updates when adding/removing route files
- 🎯 **Dynamic routes** - Support for parameters, optional segments, and catch-all routes
- 🏗️ **Nested routing** - Full support for nested route structures
- 🔌 **Extensible hooks** - Customize route generation with powerful hook system
- 📦 **Lazy loading** - Automatic code splitting with async component imports
- 🎨 **Layout support** - Flexible layout system with route groups
- 🛡️ **Route guards** - Built-in authentication and authorization patterns

## Quick Start

### Installation

```bash
npm install @oxidejs/framework
# or
bun add @oxidejs/framework
```

### Basic Setup

1. **Configure Vite plugin**:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { oxide } from "@oxidejs/framework";

export default defineConfig({
  plugins: [
    svelte(),
    oxide({
      pagesDir: "src/pages",
      dts: "src/router-types.d.ts",
    }),
  ],
});
```

2. **Create your pages structure**:

```
src/
  pages/
    index.svelte          → /
    about.svelte          → /about
    contact.svelte        → /contact
    users/
      index.svelte        → /users
      [id].svelte         → /users/:id
      [id]/
        edit.svelte       → /users/:id/edit
```

3. **Setup your main app**:

```svelte
<!-- src/App.svelte -->
<script>
  import Router from '@oxidejs/framework/components/router.svelte';
</script>

<Router>
  <div slot="loading">Loading...</div>
  <div slot="fallback">
    <h1>404 - Page Not Found</h1>
  </div>
</Router>
```

4. **Use generated routes**:

```typescript
// src/main.ts
import App from "./App.svelte";

const app = new App({
  target: document.getElementById("app")!,
});

export default app;
```

## File-based Routing Conventions

### Static Routes

```
src/pages/about.svelte     → /about
src/pages/contact.svelte   → /contact
src/pages/blog/index.svelte → /blog
```

### Dynamic Routes

```
src/pages/users/[id].svelte           → /users/:id
src/pages/blog/[slug].svelte          → /blog/:slug
src/pages/posts/[year]/[month].svelte → /posts/:year/:month
```

### Optional Parameters

```
src/pages/[[lang]]/about.svelte → /:lang?/about
src/pages/shop/[[category]].svelte → /shop/:category?
```

### Catch-all Routes

```
src/pages/docs/[...path].svelte → /docs/*
src/pages/[...catchall].svelte  → /* (catch everything)
```

### Route Groups (Layout Routes)

```
src/pages/(admin)/dashboard.svelte → /dashboard
src/pages/(admin)/users.svelte     → /users
src/pages/(marketing)/landing.svelte → /landing
```

Route groups `(name)` don't affect the URL but can be used for shared layouts and organization.

### Index Routes

```
src/pages/index.svelte           → /
src/pages/users/index.svelte     → /users
src/pages/blog/index.svelte      → /blog
```

## Configuration

### Basic Configuration

```typescript
import { oxide, type FsRouterOptions } from "@oxidejs/framework";

const config: FsRouterOptions = {
  pagesDir: "src/pages", // Directory to scan for routes
  extensions: [".svelte"], // File extensions to include
  importMode: "async", // 'async' | 'sync'
  dts: "src/router-types.d.ts", // TypeScript definitions output
  routeGroups: true, // Enable (group) directories
  virtualId: "virtual:oxide-routes", // Virtual module ID
};

export default {
  plugins: [oxide(config)],
};
```

### Advanced Configuration with Hooks

```typescript
import { oxide, defaultHooks, compose } from "@oxidejs/framework";

const config: FsRouterOptions = {
  pagesDir: "src/routes",

  // Custom route name generation
  routeNameGenerator: (segments, filePath) => {
    return (
      segments
        .filter((seg) => seg !== "index")
        .join("-")
        .toLowerCase() || "home"
    );
  },

  // Extend individual routes
  extendRoute: compose([
    // Add metadata based on file location
    (route) => {
      if (route.fullPath.startsWith("/admin")) {
        route.meta.requiresAuth = true;
        route.meta.layout = "admin";
      }
      return route;
    },

    // Add SEO metadata
    (route) => {
      route.meta.seo = {
        title: route.name.replace(/-/g, " "),
        description: `${route.name} page description`,
      };
      return route;
    },
  ]),

  // Global route tree modifications
  beforeWriteRoutes: (tree) => {
    // Add global aliases, modify structure, etc.
  },
};
```

## Hook System

### Built-in Hooks

```typescript
import { defaultHooks, compose, when } from "@oxidejs/framework";

const config = {
  extendRoute: compose([
    // Add route aliases
    defaultHooks.alias([
      { match: "/home", alias: "/" },
      { match: /^\/admin/, alias: (path) => `/dashboard${path}` },
    ]),

    // Add route guards
    defaultHooks.guards({
      auth: {
        pattern: /^\/admin|^\/profile/,
        guard: ["authenticate", "authorize"],
      },
    }),

    // Add layout information
    defaultHooks.layout({
      layoutDir: "src/layouts",
      defaultLayout: "default",
    }),

    // Conditional hooks
    when(
      (route) => route.fullPath.startsWith("/api"),
      (route) => {
        route.meta.isAPI = true;
        return route;
      },
    ),
  ]),
};
```

### Custom Hooks

```typescript
// Custom hook to parse frontmatter from Svelte files
function createFrontmatterHook() {
  return (route, context) => {
    const filePath = join(
      context.root,
      context.options.pagesDir,
      route.filePath,
    );
    const content = readFileSync(filePath, "utf-8");

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const metadata = parseYAML(frontmatterMatch[1]);
      route.meta = { ...metadata, ...route.meta };
    }

    return route;
  };
}
```

## Runtime API

### Router Context

```svelte
<script>
  import { useRouter, useRoute, useNavigation } from '@oxidejs/framework';

  const router = useRouter();
  const { route, params, location } = useRoute();
  const { navigate, back, forward } = useNavigation();

  function goToUser(id) {
    navigate(`/users/${id}`);
  }

  function goToUserWithQuery(id) {
    router.navigate('/users/' + id, {
      query: { tab: 'profile' },
      hash: 'section1'
    });
  }
</script>

<button onclick={() => goToUser('123')}>
  Go to User 123
</button>

<p>Current route: {route?.name}</p>
<p>User ID: {params.id}</p>
```

### Programmatic Navigation

```typescript
import { createRouter } from "@oxidejs/framework";
import { routes } from "virtual:oxide-routes";

const router = createRouter(routes);

// Navigate to a route
router.navigate("/users/123");

// Navigate with options
router.navigate("/users/123", {
  replace: true,
  query: { tab: "settings" },
  hash: "profile",
});

// Generate paths from route names
const userPath = router.generatePath("users-id", { id: "123" });

// Navigation methods
router.push("/about");
router.replace("/login");
router.back();
router.forward();
```

### Type Safety

With TypeScript enabled, you get full type safety:

```typescript
// Auto-generated types in router-types.d.ts
declare module "virtual:oxide-routes" {
  export interface RouteNameMap {
    home: { params: {}; path: "/" };
    "users-id": { params: { id: string }; path: "/users/:id" };
    "blog-slug": { params: { slug: string }; path: "/blog/:slug" };
  }
}

// Type-safe navigation
router.navigate("users-id", { params: { id: "123" } }); // ✓ Valid
router.navigate("users-id", { params: { name: "John" } }); // ✗ Type error
```

## Advanced Features

### Route Metadata

Add metadata to routes using frontmatter or hooks:

```svelte
<!-- src/pages/admin/dashboard.svelte -->
<script context="module">
  // Route metadata (processed by hooks)
  export const metadata = {
    title: 'Admin Dashboard',
    requiresAuth: true,
    roles: ['admin'],
    layout: 'admin'
  };
</script>

<script>
  // Component code
</script>

<h1>Admin Dashboard</h1>
```

### Layouts

```typescript
// Hook to automatically assign layouts
defaultHooks.layout({
  layoutPattern: /\((.*?)\)/, // Extract from (admin) directories
  defaultLayout: "default",
});
```

```svelte
<!-- src/layouts/admin.svelte -->
<script>
  let { children } = $props();
</script>

<div class="admin-layout">
  <nav><!-- Admin navigation --></nav>
  <main>
    {@render children()}
  </main>
</div>
```

### Route Guards

```typescript
// Authentication guard
const authGuard = {
  beforeEnter: async (to, from) => {
    if (to.meta.requiresAuth && !isAuthenticated()) {
      router.navigate("/login");
      return false;
    }
    return true;
  },
};

const router = createRouter(routes, { guards: [authGuard] });
```

### Server-Side Rendering (SSR)

```typescript
// server.ts
import { OxideHandler } from "@oxidejs/framework";
import App from "./src/App.svelte";

const handler = new OxideHandler({
  app: App,
  routesDir: "src/pages",
});

// Handle requests
const { matched, response } = await handler.handle(request);
```

## Examples

### E-commerce Store Structure

```
src/pages/
  index.svelte                    → /
  (marketing)/
    about.svelte                  → /about
    contact.svelte                → /contact
  shop/
    index.svelte                  → /shop
    [category]/
      index.svelte                → /shop/:category
      [product].svelte            → /shop/:category/:product
  (account)/
    login.svelte                  → /login
    register.svelte               → /register
    profile.svelte                → /profile
  (admin)/
    dashboard.svelte              → /dashboard
    products/
      index.svelte                → /products
      [id].svelte                 → /products/:id
      create.svelte               → /products/create
  [...catchall].svelte            → /* (404 handler)
```

### Blog with Categories

```
src/pages/
  index.svelte                    → /
  blog/
    index.svelte                  → /blog
    [slug].svelte                 → /blog/:slug
    category/
      [name].svelte               → /blog/category/:name
    tag/
      [tag].svelte                → /blog/tag/:tag
    [...path].svelte              → /blog/* (catch remaining)
```

## Migration Guide

### From SvelteKit

1. Move `src/routes` to `src/pages`
2. Replace `+page.svelte` files with `.svelte` files
3. Update imports from `$app/stores` to `@oxidejs/framework`
4. Configure the Oxide plugin in Vite

### From Vue Router

The concepts are similar:

- File-based routing → Same concept
- Dynamic routes `[param]` → Same syntax
- Nested routes → Automatic from directory structure
- Route guards → Hook system
- Meta fields → Built-in meta support

## API Reference

### Plugin Options

| Option              | Type                    | Default                   | Description                   |
| ------------------- | ----------------------- | ------------------------- | ----------------------------- |
| `pagesDir`          | `string`                | `'src/pages'`             | Directory to scan for routes  |
| `extensions`        | `string[]`              | `['.svelte']`             | File extensions to include    |
| `importMode`        | `'async' \| 'sync'`     | `'async'`                 | How to import components      |
| `routeGroups`       | `boolean`               | `true`                    | Enable `(group)` directories  |
| `dts`               | `string`                | `'src/router-types.d.ts'` | TypeScript definitions output |
| `extendRoute`       | `ExtendRouteHook`       | `undefined`               | Hook to modify routes         |
| `beforeWriteRoutes` | `BeforeWriteRoutesHook` | `undefined`               | Hook for global changes       |

### Runtime Functions

- `createRouter(routes, options)` - Create router instance
- `useRouter()` - Get router from context
- `useRoute()` - Get current route info
- `useNavigation()` - Get navigation functions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

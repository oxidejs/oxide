# Oxide v1 Implementation Summary

This document summarizes the implementation of the Oxide v1 specification.

## ✅ Implemented Features

### 1. Configuration System (`src/config.ts`)

- **`trailingSlash`** option with three modes:
  - `'never'`: canonical URLs have no trailing slash (except `/`)
  - `'always'`: canonical URLs always have a trailing slash (except `/`)
  - `'ignore'`: no canonicalization based on trailing slash
- **`routesDir`** option for route discovery (default: `"src/routes"`)
- Global config accessible via `getConfig()` and `setConfig()`

### 2. File-System Routing

- Route discovery from `routesDir` via `scanRoutesDirectory()`
- Dynamic segments: `[id].svelte` → `:id`
- Catch-all segments: `[...rest].svelte` → `**:rest`
- Index routes: `index.svelte` → directory base path
- Special files:
  - `+layout.svelte`: wraps child routes (composable/nested)
  - `+error.svelte`: error boundaries (bubble to parent if needed)

### 3. Route Groups

- Parenthesized directories (e.g. `(marketing)`) are stripped from URLs
- Used for organization and composition only
- Layouts/errors inside route groups apply only to that group's subtree

### 4. URL Canonicalization

- **SSR**: 308 redirects to canonical URL when trailing slash doesn't match policy
- **SPA**: `replaceState` to canonical URL when navigating
- Implemented in both `nitro.ts` (server) and `client.ts` (browser)

### 5. Routing Props Contract

All routed components receive via `$props()`:

- **`params`**: Record<string, string | string[]>
  - Dynamic segments are strings
  - Catch-all segments are arrays (e.g. `{ rest: ["a", "b"] }`)
- **`url`**: OxideUrl (JSON-serializable)
  - `href`, `pathname`, `search`, `hash`, `origin`
  - `query`: Record<string, string> (last value wins for duplicate keys)

### 6. Context API (`src/context.ts`)

Provides Svelte context-based composables for non-routed components:

- **`useRouter()`**: returns Router instance
  - `push(href)`: navigate with history push
  - `replace(href)`: navigate with history replace
  - `go(delta)`: navigate history
  - `isReady()`: Promise that resolves when hydration is complete

- **`useRoute()`**: returns Readable<RouteState>
  - `params`: current route params
  - `url`: current URL (OxideUrl)
  - `matched`: matched route metadata
  - `canonical`: canonical URL

- **`usePayload()`**: returns Readable<T>
  - Current navigation payload data
  - Shared between SSR and client

**Usage:** Context functions work automatically via global router fallback. For proper Svelte context, wrap your app with `<OxideProvider>` (optional).

### 7. Client Router (`src/client.ts`)

- Built on `rou3` for route matching
- Priority-based matching: static > `[param]` > `[...rest]`
- Navigation cache with 5-minute TTL
- Abort controller for canceling in-flight navigations
- Automatic scroll behavior handling
- Error boundary support with fallback rendering
- Layout composition (nested layouts)
- Context API integration via stores

### 8. Server-Side Rendering (`src/nitro.ts`)

- Nitro-based handler (`OxideHandler` class)
  - Constructor accepts optional parameters:
    - `router`: RouteManifest (should be passed from virtual module `#oxide/router`)
    - `routesDir`: string (legacy, not typically used)
  - `trailingSlash` is auto-detected from `router.config.trailingSlash`
  - Handles both SSR rendering and navigation payload requests internally
- Route matching with catch-all support
- Navigation payload endpoint (`/__oxide/payload/**`) handled internally by OxideHandler
- Proper params parsing (catch-all as arrays)
- Layout rendering via recursive composition
- HTML generation with SSR data embedding
- Development mode detection (Vite client script injection)

### 9. Link Enhancement (`src/client-actions.ts`)

Svelte actions for progressive enhancement:

- **`link`** action for individual `<a>` elements
  - Intercepts same-origin clicks
  - Supports preloading (hover, viewport, intent modes)
  - Uses `router.replace()` for canonical redirects
  - Cleanup on destroy

- **`links`** action for containers
  - Automatic link discovery and enhancement
  - MutationObserver for dynamic links
  - Delegation-based event handling

- **`navigate(href, options)`**: programmatic navigation
- **`preloadRoute(href)`**: explicit route preloading

### 10. Rendering Components

- **`LayoutRenderer.svelte`**: recursive layout composition
  - Passes `params` and `url` to all layouts and route components
  - Uses Svelte 5 snippets for children
  - Supports async components via `routeBody` prop for pre-rendered HTML
- **`ErrorRenderer.svelte`**: error boundary rendering
  - Custom error component support
  - Fallback UI with retry/home buttons
  - Receives `error`, `params`, `url`, `retry` props

- **`OxideProvider.svelte`**: optional context provider
  - Sets up Svelte context for `useRouter()`, `useRoute()`, `usePayload()`
  - Not required - context API falls back to global router
  - Use when you want proper Svelte context instead of global fallback

### 11. Route Utilities (`src/route-utils.ts`)

- `scanRoutesDirectory()`: filesystem scanning
- `filePathToUrl()`: converts file paths to URL patterns
- `parseRouteParams()`: converts rou3 params with catch-all as arrays
- `generateRouteManifestArrays()`: manifest code generation
- Route priority calculation

### 12. Build Integration (`src/with-oxide.ts`)

- `withOxide(options)` function returns NitroConfig
- Generates `.oxide/client.ts` entry point for client-side hydration
- Virtual module for SSR:
  - `#oxide/router` - Route manifest with all routes, layouts, errors, and config
    - Contains compiled Svelte components and route metadata
    - Imported by `src/renderer.ts` and passed to OxideHandler
- Route manifest generation on build/dev via hooks
- Client/server code splitting
- Users control `src/renderer.ts` for full customization (can add other handlers/middleware)
- Users control `src/error.ts` for error handling customization
- Payload endpoint handling is automatic (handled by OxideHandler, no separate file needed)

## 📝 Key Architectural Decisions

1. **No loaders**: Data fetching via direct `await` in components (SSR captures results)
2. **JSON-only payloads**: Hydration and navigation payloads must be JSON-serializable
3. **Explicit props contract**: Routed components use `$props()`, context API is optional
4. **Priority matching**: Deterministic route resolution (static > param > catch-all)
5. **308 redirects**: Permanent redirects for canonical URLs (SEO-friendly)
6. **Readable stores**: Context API uses Svelte stores for reactivity
7. **Action-based enhancement**: Links are opt-in progressive enhancement

## 🔧 Integration Points

### Nitro

- Custom renderer handler
- Virtual modules for route manifest
- Server handlers for payload endpoints
- Route rules for caching headers

### Vite

- Client entry point generation
- Asset manifest for production builds
- CSS link injection

### Svelte 5

- Runes (`$props()`, `$derived`)
- Snippets for layout children
- Context API (`setContext`/`getContext`)
- SSR rendering (`render()` from `svelte/server`)
- Hydration (`hydrate()` from `svelte`)

## 🚀 Usage Example

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { nitro } from "nitro/vite";
import { withOxide } from "oxidejs/nitro";

export default defineConfig({
  plugins: [svelte(), nitro()],
  nitro: withOxide({
    routesDir: "src/routes",
    trailingSlash: "never",
  }),
});
```

```typescript
// src/renderer.ts
import { type H3Event, HTTPError } from "nitro/h3";
import { OxideHandler } from "oxidejs/nitro";
import router from "#oxide/router";

const oxideHandler = new OxideHandler({
  router,
});

async function renderer(event: H3Event) {
  const { matched, response } = await oxideHandler.handle(event);
  if (matched) {
    return response;
  }
  throw HTTPError.status(404);
}

export default renderer;
```

```svelte
<!-- src/routes/users/[id].svelte -->
<script lang="ts">
  let { params, url } = $props();
  const user = await fetch(`/api/users/${params.id}`).then(r => r.json());
</script>

<h1>{user.name}</h1>
<p>Visiting: {url.pathname}</p>
```

```svelte
<!-- Non-routed component -->
<script lang="ts">
  import { useRoute, useRouter } from "oxidejs";

  const route = useRoute();
  const router = useRouter();
</script>

<nav>
  <a href="/" use:link>Home</a>
  <p>Current: {$route.url.pathname}</p>
</nav>
```

```svelte
<!-- Optional: Wrap app with OxideProvider for proper Svelte context -->
<script lang="ts">
  import OxideProvider from "oxidejs/components/OxideProvider.svelte";
</script>

<OxideProvider>
  {#snippet children()}
    <!-- Your app components here -->
  {/snippet}
</OxideProvider>
```

## ⚠️ Known Limitations (v1 Scope)

- No optional params (`[[id]]` not supported - use catch-all instead)
- No static site generation (waiting on Nitro prerendering)
- No form actions or server functions
- JSON-only payloads (no streaming, no Promises in data)

## 🔧 Build System Compatibility

### Rollup vs Rolldown

The virtual module `#oxide/router` uses **absolute file paths** for importing route components. This ensures compatibility with both Rolldown (Vite's default) and Rollup. Relative paths in virtual modules can fail with Rollup because virtual modules don't have a physical file location to resolve relative paths from.

If you encounter "Failed to load url" errors after switching bundlers, ensure you're using the latest version of oxidejs which generates absolute paths for all route imports.

### Top-level await in route components

Oxide supports using top-level await in route components (the await-first data model). However, Svelte's SSR renderer cannot handle top-level await during server-side rendering - it throws an `await_invalid` error.

To work around this limitation:

1. During SSR, if a component has top-level await, Oxide renders a placeholder `<div id="oxide-async-root"></div>`
2. The layout (if any) still renders fully around this placeholder
3. On the client, the component hydrates and executes its async work
4. The page then displays the full content with resolved data

This allows you to use patterns like:
```svelte
<script lang="ts">
  const data = await fetch('/api/data').then(r => r.json());
</script>

<p>{data.name}</p>
```

The layout renders server-side for SEO, while the async content loads client-side after hydration.

**Note:** For full SSR with data, consider using `{#await}` blocks in the template instead of top-level await:

```svelte
<script lang="ts">
  const dataPromise = fetch('/api/data').then(r => r.json());
</script>

{#await dataPromise then data}
  <p>{data.name}</p>
{/await}
```

## 📦 Export Structure

Oxide strictly separates client and server exports to maintain browser compatibility:

### Main entry (`oxidejs`) - Browser-safe only

**Types:**

- `Route`, `Layout`, `ErrorBoundary`, `RouteManifest`, `NavigationPayload`, `OxideUrl`, `OxideConfig`
- `RouteState`, `Router` (from context)

**Functions:**

- Actions: `link`, `links`, `navigate`, `preloadRoute`, `isExternalUrl`, `isSameOriginUrl`, `normalizeUrl`
- Context: `useRouter()`, `useRoute()`, `usePayload()`, `parseUrl()`
- Config: `setConfig()`, `getConfig()`
- Utils: `parseRouteParams()`

### Components (Browser-safe)

- `oxidejs/components/LayoutRenderer.svelte` - Layout composition renderer
- `oxidejs/components/ErrorRenderer.svelte` - Error boundary renderer
- `oxidejs/components/OxideProvider.svelte` - Optional context provider

### Client entry (`oxidejs/client`) - Browser-safe

- `initializeOxideRouter(manifest)` - Initialize the router with route manifest
- `getOxideRouter()` - Get the global router instance
- `useRouter()`, `useRoute()`, `usePayload()` - Re-exported context composables

### Nitro plugin (`oxidejs/nitro`) - Server-only

**⚠️ Do NOT import from this in browser code!**

- `OxideHandler` class - Server-side request handler
  - Constructor signature: `new OxideHandler(options?: { routesDir?, router? })`
  - All parameters are optional but `router` should be provided from `#oxide/router`
  - `trailingSlash` setting is auto-detected from `router.config.trailingSlash`
  - Handles both SSR rendering and payload endpoint requests
- `withOxide(options)` - Nitro config generator
  - Returns NitroConfig with hooks, renderer, errorHandler, routeRules, and virtual modules
- Types: `OxideConfig`, `RouteManifest`
- Route utilities: `scanRoutesDirectory()`, `generateRouteManifestArrays()`, `generateImportStatements()`, `filePathToUrl()`, `getRoutePriority()`, `normalizeRoutesDirPath()`
- Shared utils: `parseRouteParams()`, `parseUrl()`
- Config utils: `getConfig()`, `normalizePathWithTrailingSlash()`, `shouldRedirectForTrailingSlash()`, `getCanonicalUrl()`

### File Organization

- `src/index.ts` - Browser-safe exports only
- `src/client.ts` - Client router implementation + context re-exports
- `src/nitro.ts` - Server-side handler + all server utilities
- `src/shared-utils.ts` - Browser-safe utilities used by both client and server
- `src/config.ts` - Browser-safe configuration (uses in-memory state)
- `src/context.ts` - Browser-safe Svelte context API
- `src/client-actions.ts` - Browser-safe link enhancement actions
- `src/route-utils.ts` - Server-only (uses node:fs, node:path)
- `src/with-oxide.ts` - Server-only (uses node:fs, node:path)

### Context API Behavior

The context API (`useRouter`, `useRoute`, `usePayload`) works in two modes:

1. **Global fallback (default)**: Functions access the router via `window.__OXIDE_ROUTER__`
   - Works immediately after `initializeOxideRouter()`
   - No wrapper component needed
   - Simpler for most use cases

2. **Svelte context (optional)**: Use `<OxideProvider>` to set proper Svelte context
   - Follows Svelte best practices
   - Required if you want to avoid global state
   - Wrap your app root with the provider component

### Payload Handler (Automatic)

Oxide automatically handles navigation payload requests:

- **No `src/payload.ts` needed** - payload handling is built into OxideHandler
- OxideHandler detects payload requests via:
  - `X-Oxide-Navigation` header
  - `/__oxide/payload/**` path prefix
- Returns JSON payload for client-side navigation
- Users maintain full control over `src/renderer.ts` for customization (can add middleware, other handlers, etc.)
- Users maintain control over `src/error.ts` for error handling customization

## 🧹 Cleanup & Code Quality

### Svelte 5 Compatibility

- All components use proper Svelte 5 runes mode
- Removed deprecated `<svelte:component>` usage (components are dynamic by default in runes mode)
- Used `{@const}` for component assignments instead
- **Fixed `hydratable` support**: Modified `LayoutRenderer.svelte` to accept a `routeBody` prop for pre-rendered HTML
  - Modified SSR rendering to pre-render route components first, then wrap in layouts
  - Prevents "await_invalid" errors during SSR when using top-level await with `hydratable`

### TypeScript

- Strict browser/server separation to avoid bundling node modules in client code
- Shared utilities extracted to `shared-utils.ts` for code reusable in both environments
- Unused imports and variables removed (`getConfig`, `ErrorBoundary`, `getErrorBoundariesForRoute`)
- Clean code with no debug logs in production paths
- JSDoc comments added for internal APIs

### Error Handling

- Console warnings preserved for production debugging (helps identify missing build assets)
- Graceful fallbacks for missing manifests or assets
- Proper error boundaries with retry functionality

### Known TypeScript Warnings

The following are configuration-level issues, not code issues:

- Missing h3 type declarations in dev environment (resolved by project tsconfig and dependencies)
- `nitropack` vs `nitro` type imports (resolved by package resolution)

### Dependencies

- `dedent` - For template literal formatting
- `rou3` - For route matching (priority-based, params, wildcards)

## ✨ Next Steps

To test the implementation:

1. Run `bun install` in the monorepo
2. Build oxidejs: `cd packages/oxidejs && bun run build`
3. Test in playground: `cd apps/playground && bun run dev`
4. Create test routes in `apps/playground/src/routes/`
5. Verify canonicalization, params, context API, and link enhancement

### Production Build Testing

```bash
cd apps/playground
bun run build
bun run preview
```

Verify that:

- Client scripts load from `/assets/client-*.js`
- CSS loads from `/assets/client-*.css`
- No 404 errors in console
- Context API works (`useRouter`, `useRoute`, `usePayload`)
- Navigation works with proper canonicalization

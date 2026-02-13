# Oxide Implementation

This document describes the current implementation of Oxide, a Svelte meta-framework on Nitro.

## Architecture Overview

Oxide consists of three main parts:

1. **Server-side rendering (SSR)** - [`nitro.ts`](src/nitro.ts)
2. **Client-side hydration & routing** - [`client.ts`](src/client.ts)
3. **Build-time route generation** - [`with-oxide.ts`](src/with-oxide.ts)

## Core Components

### 1. Route Discovery (`route-utils.ts`)

Routes are discovered at build time by scanning the `src/routes` directory:

```typescript
// File patterns
*.svelte           -> Page routes
index.svelte       -> Index routes (maps to directory)
[id].svelte        -> Dynamic segments (:id)
[...rest].svelte   -> Catch-all routes (**:rest)
+layout.svelte     -> Layout wrappers
+error.svelte      -> Error boundaries
(maneting)/        -> Route groups (stripped from URL)
```

Route priority (highest first):

1. Static segments (priority: 100)
2. Dynamic params (priority: 50)
3. Catch-all (priority: 1)

### 2. Server-Side Rendering (`nitro.ts`)

The `OxideHandler` class handles incoming requests:

```typescript
class OxideHandler {
  handle(event: H3Event) -> { matched: boolean; response: Response }
}
```

Request flow:

1. Check for navigation payload requests (`/__oxide/payload/*`)
2. Handle trailing slash redirects (308 Permanent Redirect)
3. Match route using rou3
4. Fall back to catch-all routes if no match
5. Render 404 if no route found
6. Render matched route with layouts

Layout rendering:

- Layouts are matched by segment prefix
- Nested layouts compose from root to leaf
- Layouts receive same props as routes (`params`, `url`)

### 3. Client Router (`client.ts`)

The `OxideClientRouter` manages SPA navigation after hydration:

```typescript
class OxideClientRouter {
  push(href: string): Promise<void>;
  replace(href: string): Promise<void>;
  go(delta: number): void;
  get route(): Readable<RouteState>;
  get payload(): Readable<any>;
}
```

Navigation flow:

1. Intercept link clicks via `use:link` action
2. Fetch navigation payload from `/__oxide/payload/*`
3. Render new route with hydration data
4. Update browser history
5. Handle scroll behavior

### 4. Link Enhancement (`client-actions.ts`)

The `link` action upgrades anchor tags for SPA navigation:

```svelte
<a href="/about" use:link>About</a>
```

Features:

- Same-origin detection
- Modifier key exclusion (Ctrl, Alt, Shift, Meta)
- Preloading (hover, viewport, intent)
- External link detection

### 5. Context API (`context.ts`)

Router context for non-routed components:

```typescript
const router = useRouter(); // Navigation methods
const route = useRoute(); // Current route state
const payload = usePayload(); // Navigation payload
```

## Configuration

Configuration is set via `withOxide()` in `vite.config.ts`:

```typescript
withOxide({
  routesDir: "src/routes", // Route discovery directory
  trailingSlash: "never", // "never" | "always" | "ignore"
});
```

Trailing slash behavior:

- `"never"`: Redirect `/about/` to `/about` (308)
- `"always"`: Redirect `/about` to `/about/` (308)
- `"ignore"`: No redirects, both URLs work

## Route Manifest

Generated at build time in `.oxide/server.ts` and `.oxide/client.ts`:

```typescript
interface RouteManifest {
  routes: Route[];
  layouts: Layout[];
  errors: ErrorBoundary[];
  importRoute(handler: string): Promise<{ default: Component }>;
  LayoutRenderer: Component;
  ErrorRenderer: Component;
  config: { trailingSlash: "never" | "always" | "ignore" };
}
```

## Data Flow

### SSR Initial Load

```
1. Request -> Nitro -> OxideHandler
2. Match route -> Load component
3. Render component (await top-level awaits)
4. Render layouts (outer to inner)
5. Generate HTML with hydration data
6. Send response
```

### Client Navigation

```
1. Click link -> use:link action
2. Fetch /__oxide/payload/new-path
3. Parse payload (params, url, data)
4. Dynamically import route component
5. Mount/hydrate new route
6. Update history state
```

## Error Handling

### SSR Errors

1. **Route not found**: Render root `+error.svelte` or fallback HTML
2. **Render error**: Render nearest error boundary
3. **Server error**: Return 500 with error page

### Client Errors

1. **Navigation failure**: Show error boundary with retry option
2. **Payload fetch failure**: Fall back to full page load
3. **Component load failure**: Show nearest error boundary

## Type Definitions

### Core Types

```typescript
// URL representation (JSON-serializable)
interface OxideUrl {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  query: Record<string, string>;
}

// Route definition
interface Route {
  path: string; // URL pattern (/users/:id)
  handler: string; // Component path (src/routes/users/[id].svelte)
  priority: number; // Matching priority (100, 50, 1)
}

// Layout definition
interface Layout {
  handler: string; // Component path
  level: number; // Nesting level (0 = root)
  segment: string; // Path segment this layout covers
}

// Error boundary definition
interface ErrorBoundary {
  handler: string;
  level: number;
  segment: string;
}

// Navigation payload (client-side)
interface NavigationPayload {
  url: OxideUrl;
  params: Record<string, string | string[]>;
  data?: Record<string, any>;
  timestamp: number;
}
```

## File Structure

```
src/
├── client.ts           # Client router implementation
├── client-actions.ts   # Link actions & navigation helpers
├── config.ts           # Configuration & trailing slash logic
├── context.ts          # Svelte context API (useRouter, etc.)
├── framework.d.ts      # Global type declarations
├── index.ts            # Public API exports
├── nitro.ts            # SSR handler & route rendering
├── preload.ts          # Link preloading utilities
├── route-utils.ts      # Route discovery & manifest generation
├── shared-utils.ts     # Shared utilities (parseRouteParams)
├── types.ts            # TypeScript interfaces
└── with-oxide.ts       # Nitro configuration plugin
```

## Build Process

1. **Dev/Build initialization**:
   - `withOxide()` registers Nitro hooks
   - `dev:prepare` / `build:before` generate entry files

2. **Entry file generation**:
   - `.oxide/client.ts` - Client hydration entry
   - `.oxide/server.ts` - SSR route manifest

3. **Route scanning**:
   - Scan `src/routes` recursively
   - Identify pages, layouts, errors
   - Generate import statements
   - Build route manifest arrays

## Implementation Notes

### Route Matching

Uses [rou3](https://github.com/unjs/rou3) for pattern matching:

- Static: `/about`
- Dynamic: `/users/:id`
- Catch-all: `/docs/**:rest`

### Component Rendering

Uses Svelte 5's `render()` from `svelte/server`:

- Awaits thenable result for async components
- Extracts `body` and `head` output
- Supports top-level await in components

### State Management

No external state library - uses:

- Svelte 5 runes (`$props`, `$state`)
- Svelte stores for router state
- Svelte context for dependency injection

### Performance

- Route components lazy-loaded
- Navigation payload caching (5 min TTL)
- Link preloading on hover/viewport
- Intersection Observer for viewport preloading

## Deferred Features (v2+)

Per SPECIFICATION.md, these are intentionally not implemented:

- Streaming SSR
- Optional params (`[[id]]`)
- Param matchers/validation
- Layout persistence semantics
- Scroll/focus management details
- Payload caching rules
- Serialization constraints

## Type Compatibility

### `withOxide()` Return Type

The `withOxide()` function intentionally does not declare an explicit return type (`NitroConfig`). This avoids type incompatibility issues when the `nitro` package exists in multiple `node_modules` locations (e.g., in a monorepo setup).

Instead, the function returns a plain object that is structurally compatible with `NitroConfig`, allowing TypeScript's structural typing to work correctly across package boundaries.

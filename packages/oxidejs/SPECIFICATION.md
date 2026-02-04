## Oxide v1: scope

Oxide v1 is a thin Svelte meta-framework on Nitro that provides a hybrid SSR→SPA pages router (SSR on first load, client-side navigation after hydration).
API routes are _not_ part of this router; they remain Nitro-owned.

## File-system routing (pages)

Routes are discovered from `src/routes/` and matched using rou3-style patterns (params and wildcards).

### Route files

- **Page route**: any `*.svelte` file becomes a route.
- **Index route**: `index.svelte` maps to the directory base path.
- **Dynamic segment**: `[id].svelte` maps to `:id` (e.g. `users/[id].svelte` → `/users/:id`).
- **Catch-all**: `[...rest].svelte` maps to a named wildcard (e.g. `/docs/**:rest`).

### Special files (composition)

- `+layout.svelte`: wraps child routes; layouts can be nested and compose from root to leaf.
- `+error.svelte`: nearest error boundary handles errors from its subtree; errors bubble to parent boundaries if needed.

### Route groups

- Any directory named `(group)` is ignored for URL generation (organizational and composition-only).
- Layouts/errors inside a group apply only to that group’s subtree.

## URL semantics & matching

- **Canonical URL**: no trailing slash; `/about/` normalizes to `/about` (router may emit a redirect rule for canonicalization).
- **Priority**: static segments > `[param]` > `[...rest]` (most specific wins, deterministic).
- **No optional params (v1)**: patterns like `[[id]]` are intentionally not supported; use a catch-all instead.

## Rendering & data contract (no loaders)

Initial navigation is SSR via Nitro’s renderer: the router matches the URL, loads the layout/error chain, renders HTML, and ships hydration.
After hydration, subsequent navigations are handled client-side (History API + dynamic imports) without full page reloads.

### Await-first data model (v1)

- There are **no** loader files (`+page.ts`, `load()`, etc. are out of scope).
- Data is authored directly in Svelte components (including `+layout.svelte` / `+error.svelte`) using Svelte’s async/await patterns and await blocks (the framework captures required results during SSR).
- **Hydration payload**: SSR must embed a JSON-only payload that allows the client to hydrate without refetching the awaited results for the current route (v1: JSON only; non-JSON values are a developer error).

### Client navigation payload

- On client-side route changes, the router fetches a navigation payload (JSON) from the server for the target URL, then mounts the next route using that payload to satisfy awaited data.
- Payloads are cached by normalized URL to support instant navigations after preloading.

## Client router & link enhancement

Oxide does not intercept anchors by default; SPA behavior is opt-in via Svelte actions. (“Actions” attach behavior to DOM nodes and support `update()`/`destroy()` lifecycles.)

### `use:link` (single anchor opt-in)

- Usage: `<a href="/docs" use:link>Docs</a>`
- Intercepts only when safe: primary click, no modifiers, same-origin within `base`, not `download`, `target` is empty/`_self`.
- Supports navigation options: `replaceState`, `noscroll`, `keepfocus`.
- Default preloading when present: **proximity** (IntersectionObserver) + **hover** + **touchstart**.

### `use:links` (parent opt-in / delegated)

- Usage: `<nav use:links> ... <a href="/x">...</a> ... </nav>`
- Enhances descendant anchors using event delegation (click/hover/touchstart) plus optional IntersectionObserver to preload visible links.
- Per-anchor opt-outs inside an enhanced subtree:
  - `data-oxide-reload`: never intercept (force full navigation).
  - `data-oxide-preload="off"`: disable hover/proximity/touch preloading for that anchor.

### Preloading + code splitting

Each route/layout/error component is code-split into its own chunk and loaded on demand; preloaded routes are cached so navigations can be instant.
Preloading loads **code** (route chunk + layout/error chain chunks) and **data** (navigation payload JSON).

### View transitions, scroll, hooks

- Optional View Transitions API integration (CSS-driven; fallback to instant updates).
- Scroll behavior modes: `auto` (restore on back/forward), `preserve`, `top`, with per-navigation overrides.
- Lifecycle hooks: navigation start/end callbacks for loading indicators.

## Build artifacts & Nitro integration

The build step generates a route manifest (route tree, chunk importers, layout/error chains, metadata) and a runtime module consumed by both SSR and the client router.  
Route metadata can emit Nitro `routeRules` (redirects/headers/caching) using rou3-pattern-compatible keys, since Nitro v3 documents that `routeRules` patterns follow rou3.

## V2 backlog (explicitly deferred)

- Optional params and richer param matchers.
- Pluggable serializers (e.g. SuperJSON) beyond JSON-only payloads.
- Smarter partial layout reuse across navigations (beyond natural component persistence).
- Prerender/SSG integration once Nitro-side prerequisites are in place.

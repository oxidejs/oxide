## Oxide v1: scope

Oxide v1 is a thin Svelte meta-framework on Nitro that provides a hybrid SSR→SPA pages router (SSR on first load, client-side navigation after hydration).

API routes are **not** part of this router; they remain Nitro-owned.

Oxide additionally provides optional in-app router access via Svelte’s Context API (`setContext`/`getContext`) for non-routed components, without changing the routed-props contract.

## Configuration (v1)

Oxide must be configurable via a top-level config object (exact location/loader is implementation-defined for v1).

- `routesDir`: string, default `"src/routes"`. Controls where Oxide discovers page routes.
- `trailingSlash`: `'never' | 'always' | 'ignore'`, default `'never'`.
  - `'never'`: canonical URLs have no trailing slash (except `/`).
  - `'always'`: canonical URLs always have a trailing slash (except `/`).
  - `'ignore'`: Oxide does not canonicalize based on trailing slash.

## File-system routing (pages)

Routes are discovered from `routesDir` and matched using rou3-style patterns (params and wildcards).

### Route files

- **Page route**: any `*.svelte` file becomes a route.
- **Index route**: `index.svelte` maps to the directory base path.
- **Dynamic segment**: `[id].svelte` maps to `:id` (e.g. `users/[id].svelte` → `/users/:id`).
- **Catch-all**: `[...rest].svelte` maps to a named wildcard (e.g. `/docs/**:rest`).

### Special files (composition)

- `+layout.svelte`: wraps child routes; layouts can be nested and compose from root to leaf.
- `+error.svelte`: nearest error boundary handles errors from its subtree; errors bubble to parent boundaries if needed.

### Route groups (final)

- Any directory whose name is wrapped in parentheses (e.g. `(marketing)`) is ignored for URL generation (organizational and composition-only).
- If multiple parenthesized segments appear in a path, **all are stripped** when computing the URL (e.g. `routes/(marketing)/(docs)/foo.svelte` → `/foo`).
- A directory literally named `group` is a normal URL segment (e.g. `routes/group/foo.svelte` → `/group/foo`).
- Layouts/errors inside a route group apply only to that group’s subtree.

## URL semantics & matching

- **Canonical URL**: determined by `trailingSlash` config.
- **Priority**: static segments > `[param]` > `[...rest]` (most specific wins, deterministic).
- **No optional params (v1)**: patterns like `[[id]]` are intentionally not supported; use a catch-all instead.

### Canonicalization behavior

Canonical form is determined by `trailingSlash`.

If an incoming URL is non-canonical under the current `trailingSlash` policy:

- SSR: the router MUST redirect to the canonical URL using HTTP status **308**.
- SPA: the router MUST perform a client-side `replaceState` (or `router.replace`) to the canonical URL.

If `trailingSlash` is `'ignore'`, Oxide MUST NOT redirect/replace solely to change trailing slash.

## Routing props contract

All routed Svelte components (`+layout.svelte`, page `*.svelte`, and `+error.svelte`) receive a standard set of props from the router, accessible via Svelte’s `$props()` rune.

### `params`

- `params` is a plain JSON object produced by the URL matcher.
- Example: `routes/users/[id].svelte` matched at `/users/123` yields `params = { id: "123" }`.
- Example: `routes/docs/[...rest].svelte` matched at `/docs/a/b` yields `params = { rest: ["a","b"] }` (v1 recommendation: catch-all is an array of path segments for JSON safety).

### `url`

- `url` is a JSON-serializable description of the current URL (not a `URL` instance in v1).
- Suggested shape: `{ href, pathname, search, hash, origin, query }`, where `query` is a string-string map (last value wins) to keep JSON-only guarantees.

### Component usage example

```svelte
<!-- routes/users/[id].svelte -->
<script>
  let { params } = $props();
  const user = await fetch(`/api/users/${params.id}`).then(r => r.json());
</script>

<h1>{user.name}</h1>
```

## Rendering & data contract (no loaders)

Initial navigation is SSR via Nitro’s renderer: the router matches the URL, loads the layout/error chain, renders HTML, and ships hydration.

After hydration, subsequent navigations are handled client-side (History API + dynamic imports) without full page reloads.

### Await-first data model (v1)

- There are **no** loader files (`+page.ts`, `load()`, etc. are out of scope).
- Data is authored directly in Svelte components (including `+layout.svelte` / `+error.svelte`) using Svelte’s async/await patterns and await blocks (the framework captures required results during SSR).
- **Hydration payload**: SSR must embed a JSON-only payload that allows the client to hydrate without refetching the awaited results for the current route (v1: JSON only; non-JSON values are a developer error).

### Client navigation payload

- On client-side route changes, the router fetches a navigation payload (JSON) from the server for the target URL, then mounts the next route using that payload to satisfy awaited data.
- Payload caching is allowed; cache keying is implementation-defined (it may or may not normalize trailing slashes, especially when `trailingSlash: 'ignore'`).

## Client router, context, and link enhancement

Oxide does not intercept anchors by default; SPA behavior is opt-in via Svelte actions (actions attach behavior to DOM nodes and support `update()`/`destroy()` lifecycles).

### Router context API

Oxide provides optional composables for imperative navigation and reactive route state by installing router values into Svelte context.

- `useRouter()` returns the router instance (navigation methods, optional hooks, readiness).
- `useRoute()` returns a readable store of the current route state (at least `{ params, url }`; may include `matched` and `canonical` for advanced cases).
- `usePayload()` returns a readable store of the current navigation payload (JSON), enabling non-routed components to read the same data used to satisfy awaited results.

These are intended for components that are not directly routed (e.g. nav bars, breadcrumbs, shared widgets), while routed components should primarily use `$props()` for `params`/`url` to keep the contract explicit.

### Link enhancement action

Oxide provides a Svelte action (e.g. `use:oxideLink`) that upgrades an `<a href="...">` into SPA navigation when safe:

- Same-origin, unmodified left click (no modifier keys), and `target` is absent or `_self`.
- Uses router `push()` for normal navigation and `replace()` for canonicalization redirects when applicable.
- Must clean up listeners in `destroy()`; may respond to param changes in `update()` if the action takes options.

### Router surface (minimal)

The client router MUST provide at least:

- `push(href)` / `replace(href)` / `go(delta)`
- `route`: readable store of current `{ url, params, ... }`
- `payload`: readable store of current navigation payload (JSON)
- `isReady()`: resolves when initial hydration route state is established (client)

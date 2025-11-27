# Oxide

This is a monorepo for Oxide, a Svelte Web framework with SSR support, built on top of Vite and Nitro. It also serves as a file system router for Svelte.

## General rules

- Read the damn docs in docs/ before doing anything.
- Do not run commands yourself. Tell me what should I run.
- Use Bun runtime for development.

## Project Structure

- packages/framework/ - Core of the framework.
- packages/starter/ - A starter template for Oxide projects.
- docs/ - Documentation of the project.

## Code Standards

- Use strict TypeScript (also ensure your <script> tags in .svelte files have lang="ts").
- Use Tailwind for styling, no plain CSS.
- Always use Svelte 5 runes for state management.
- Avoid adding comments or keep them concise and relevant.
- Prioritize code readability and maintainability.
- IMPORTANT: DO NOT STUB OR MOCK ANYTHING IN THE CODEBASE.
- Avoid else statements, prefer early returns and pattern matching.

## Features specification

### FS Router

Refer to `docs/routing.md`. Requirements:

- If user adds a Svelte (.svelte) file under `src/app` or its nested directories and the file name doesn't have a corresponding folder with the same name, FS Router should consider this file a view route and render it under the pathname that equals the name of the file and its folder parents relative to `src/app`.
- If the Svelte file has a corresponding folder that hosts other Svelte files, consider this file a layout for the view routes nested in the folder with the same name.
- Only take alphanumeric names for the routes and directories and `(`, `)`, `[`, `]`. View routes may also take `.`.
- Allow user to define route directories and route groups. Route directory is just an alphanumeric folder in `src/app` or its children. The name of the directory is appended to the pathname relatively to `src/app`. Route group is a folder with an alphanumeric name, surrounded with parentheses. Its name is not appended to the pathname.
- Pathnames: `foo.svelte` in `src/app` directory (`src/app/foo.svelte`) should produce a view route with `/foo` pathname. `baz.svelte` in `bar` directory (`src/app/bar/baz.svelte`) should produce a view route under `/bar/baz` pathname. `baz.svelte` in a `(bar)` directory (`src/app/(bar)/baz.svelte`) should produce a view route under `/baz` pathname.
- Allow user to define a dynamic pathname segments with an alphanumeric name surrounded by square brackets. `[uuid].svelte` file created under `src/app/bar` directory should allow for any pathname like `/bar/123` and `/bar/234` and render the view route defined with it. Dynamic path should also be valid for directory names, so `src/app/users/[userId]/invoices/[invoiceId].svelte` is a valid view route path and pathname like `/users/1/invoices/5` is valid and renders the view.
- If user creates a `src/app/foo` directory, `src/app/foo.svelte` file, and `src/app/foo/bar.svelte` view route, treat the `src/app/foo.svelte` file as a layout that should have {@render children?.()} slot inside. IMPORTANT: Do not render `src/app/foo` as a view route.
- Allow user to define catch-all routes with names like `[...rest].svelte` so having only `src/app/[...rest].svelte` catch-all route will make it render any pathname that user requests. This is a common pattern for 404 routes.
- When building the app, generate type definitions under `.oxide/types.d.ts`. It should include definitions for all the routes found under `src/app` and all oRPC routers definitions.
- Define an `$oxide` Vite virtual module that's the global helper for working with the framework. `$oxide` should export:
  - `useRouter` function that allows consuming the router context. User should be able to `const router = useRouter()` and the router should have `push` method that takes a valid router pathname (see also `href` function in `$oxide`, it should use the same href validation), `replace`, `back`, `formward` methods, similar to History API, but with strong typing.
  - `href` function that takes template literal in surrounded by "`". If user passes correct pathname to the href function, it returns the string, otherwise it throws an exception of invalid URL. It should have a strict type safety, so IDE shows diagnostic if the URL is not correct.
  - `useRoute` function that allows consuming current route's context. It should return `{ location, params }`. `location` is a valid `Location` object. `params` are parsed from the route definition and pathname. If the route file is `src/app/bar/[id].svelte` and the pathname is `/bar/1`, then `params` is an object `{ id: "1" }`.

### View routes

Refer to `docs/data-loading.md`, `docs/navigation.md`.

- View route is a valid, non-layout, `.svelte` file as described in FS Router. It uses Svelte for templating.
- Data loading: Oxide relies on async Svelte features that allow the global `await` keyword to fetch the data in given Svelte component. Oxide is a Server Side Rendering first framework, where you can also opt-out and create Single Page App. By default, if user does an action with global `await`, it happens server side.

### oRPC integration

Refer to `docs/orpc.md`.

- Besides the standard FS Router functions as described above, user should also be able to define oRPC routers in `src/app` directory (also nested under directories). oRPC routers, unlike view routes and layouts are created as TypeScript files with `.ts` extension.
- Pathnames: oRPC routers by their nature should function as catch-all routes. Meaning a router defined under `src/app/foo.ts` can have procedures defined at top level and nested procedures. For example `{ bar, baz: { quux } }`. In this case there are 2 procedures, available under `/foo/bar` and `/foo/baz/quux` pathnames.
- There is a new object exported from `$oxide` virtual module - `rpc` which is a client for the oRPC routers user defined. For the above pathnames example, it should export client with methods: `rpc.foo.bar` and `rpc.foo.baz.quux` that perform HTTP requests and return value defined in procedures. The `rpc` client is optimized for SSR and isomorphic, which means on the server side it doesn't perform extra HTTP request, but it executes procedure logic directly and returns the desired value. On client side it performs HTTP request.

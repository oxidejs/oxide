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

#### Basic Route Resolution

- If user adds a Svelte (.svelte) file under `src/app` or its nested directories and the file name doesn't have a corresponding folder with the same name, FS Router should consider this file a view route and render it under the pathname that equals the name of the file and its folder parents relative to `src/app`.
- If the Svelte file has a corresponding folder that hosts other Svelte files, consider this file a layout for the view routes nested in the folder with the same name.
- Special handling for `index.svelte` files: `src/app/index.svelte` renders at `/`, `src/app/foo/index.svelte` renders at `/foo`.

#### File and Directory Naming

- Only accept alphanumeric names (a-z, A-Z, 0-9), underscores, hyphens, and special route characters `(`, `)`, `[`, `]` for routes and directories.
- View routes may also contain dots (`.`) for file extensions or special naming conventions.

#### Route Types

- **Route directories**: Alphanumeric folders in `src/app` or its children. The directory name is appended to the pathname relative to `src/app`.
- **Route groups**: Folders with alphanumeric names surrounded by parentheses `(groupName)`. Their name is NOT appended to the pathname but provides organization.
- **Dynamic routes**: Segments with names surrounded by square brackets `[param]` match any value at that position.
- **Catch-all routes**: Segments named like `[...rest]` (`[...something]` surrounding) match any number of path segments.

#### Route Examples

- `src/app/foo.svelte` → `/foo`
- `src/app/bar/baz.svelte` → `/bar/baz`
- `src/app/(auth)/login.svelte` → `/login`
- `src/app/users/[userId].svelte` → `/users/:userId`
- `src/app/users/[userId]/invoices/[invoiceId].svelte` → `/users/:userId/invoices/:invoiceId`
- `src/app/[...rest].svelte` → catch-all for unmatched routes (404)

#### Layout System

- If user creates `src/app/foo` directory, `src/app/foo.svelte` file, and `src/app/foo/bar.svelte` view route, treat `src/app/foo.svelte` as a layout with `{@render children?.()}` slot.
- Layout files are NOT rendered as view routes themselves.
- Layouts automatically wrap all nested routes within their directory.

#### Route Priority (highest to lowest)

1. Exact static routes (`/users`)
2. Dynamic routes (`/users/[id]`)
3. Catch-all routes (`/[...rest]`)

#### Type Generation and Virtual Module

- When building the app, generate type definitions under `.oxide/types.d.ts` including:
  - All route definitions found under `src/app`
  - All oRPC router definitions
  - Parameter types for dynamic routes
- Define `$oxide` Vite virtual module that exports:
  - `useRouter()`: Returns router with `push(path)`, `replace(path)`, `back()`, `forward()` methods with type-safe path validation
  - `href`: Tagged template literal function for type-safe URL construction: `href\`/users/${id}\``
  - `useRoute()`: Returns `{ location: Location, params: Record<string, string>, query: URLSearchParams }`
  - `rpc`: Isomorphic oRPC client (see oRPC section)

#### Error Handling

- Unmatched routes should render catch-all route if defined, otherwise built-in 404 page
- Route parameter validation errors should be handled gracefully
- Support for custom error boundaries at layout level

### View Routes

Refer to `docs/data-loading.md`, `docs/navigation.md`.

#### Basic Definition

- View route is a valid, non-layout `.svelte` file as described in FS Router
- Uses Svelte 5 with strict TypeScript for templating and logic
- Each view route corresponds to a URL pathname in the application

#### Data Loading

- Leverage async Svelte components with top-level `await` for data fetching
- SSR-first approach: `await` operations execute server-side by default
- Isomorphic data loading: same code works on server and client
- Support for SPA mode opt-out where `await` operations execute client-side
- Integration with oRPC client for optimized server communication

#### Component Structure

- Must use `<script lang="ts">` for TypeScript support
- Support Svelte 5 runes for reactive state management
- Access to framework utilities via `$oxide` imports
- Automatic type inference for route parameters via `useRoute()`

#### Rendering Modes

- **SSR (default)**: Components rendered server-side, hydrated on client
- **SPA**: Components rendered entirely client-side
- **Static**: Pre-rendered at build time (where applicable)

#### Error Handling

- Support for error boundaries to catch and handle component errors
- Automatic error page rendering for uncaught exceptions
- Graceful degradation for data loading failures

### oRPC Integration

Refer to `docs/orpc.md`.

#### Router Definition

- Define oRPC routers as TypeScript files with `.ts` extension in `src/app` directory
- Routers can be nested under directories following same structure as view routes
- Each router file exports a default router object with procedures
- Support for nested procedure definitions within router objects

#### URL Mapping

- oRPC routers function as API endpoints under their file system path
- Router at `src/app/api/users.ts` creates endpoints under `/api/users/*`
- Nested procedures create nested endpoints: `{ find, create: { batch } }` → `/api/users/find`, `/api/users/create/batch`
- HTTP method mapping: GET for queries, POST for mutations (following oRPC conventions)

#### Type-Safe Client

- `$oxide` virtual module exports `rpc` client with full type safety
- Client methods mirror the router structure: `rpc.api.users.find(params)`
- Automatic request/response type inference from router definitions
- Support for input validation and output serialization

#### Isomorphic Optimization

- **Server-side**: Direct procedure execution without HTTP overhead
- **Client-side**: HTTP requests to actual endpoints
- Automatic detection of execution context
- Shared validation and serialization logic

#### Advanced Features

- Support for streaming responses and Server-Sent Events
- Middleware system for authentication, logging, and validation
- OpenAPI specification generation from router definitions
- Integration with Svelte's reactive system for real-time updates
- Error handling with proper HTTP status codes and type-safe error responses

#### Authentication & Middleware

- Context system for passing authentication state
- Middleware chain execution for procedures
- Support for procedure-level and router-level guards
- Integration with session management systems

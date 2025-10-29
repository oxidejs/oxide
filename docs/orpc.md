# oRPC

[oRPC](https://orpc.unnoq.com/) (OpenAPI Remote Procedure Call) combines RPC (Remote Procedure Call) with OpenAPI, allowing you to define and call remote (or local) procedures through a type-safe API while adhering to the OpenAPI specification.

Instead of offering classic API Routes like other JS Web Frameworks, Oxide is offering a new, type-safe and very efficient way to define an API.

## Why oRPC?

- End-to-End Type Safety
- First-Class OpenAPI standard support
- Contract-First Development possibility
- SSE & Streaming support
- Oxide exclusive: We built an isomorphic, SSR optimized oRPC client into the framework so data loading is optimized and we reduce the count of the HTTP request you make to your app.

## Defining procedures

```ts twoslash
// src/routers/example.ts
import { base, type } from "$lib/orpc";

export const router = {
  ping: base.handler(async () => "pong"),
  greet: base
    .input(type<{ name: string }>())
    .handler(async ({ input }) => `Hello, ${input.name}!`),
};
```

## Usage in Svelte

```svelte twoslash
// src/app/index.svelte
<script lang="ts">
    import { rpc } from "$oxide"

    let name = $state("")
    let result = $state("")
    const ping = await rpc.example.ping()

    async function greet() {
        await rpc.example.greet({ name })
    }
</script>

<p>{ping}</p>

<input bind:value={name} />
<button onclick={greet}>Greet</button>

<p>{result}</p>
```

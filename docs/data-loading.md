# Data Loading

The UI data loading leverages the async Svelte global `await` feature.

## With Fetch API

The easiest way to load the data into your view is to just use Fetch API, but if you are planning to fetch the data from your own API in your application, consider using [oRPC approach](/orpc).

```svelte twoslash
// src/app/pokemon/[name].svelte
<script lang="ts">
  import { useRoute } from '$oxide'

  const route = useRoute()

  const req = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${route.params.name}`
  )
  const pokemon = await req.json()
</script>

<div>{pokemon.name}</div>
```

> Tip: Use [ofetch](https://github.com/unjs/ofetch) to skip the `await req.json()` part.

## With oRPC

Combining async Svelte components with the `rpc` client is a great way to load data from the server, because the oRPC client is SSR optimized, so you don't make extra back HTTP requests.

```svelte twoslash
// src/app/pokemon/[name].svelte
<script lang="ts">
  import { rpc, useRoute } from '$oxide'

  const route = useRoute()

  const pokemon = await rpc.pokemon.find({
    name: route.params.name
  })
</script>

<div>{pokemon.name}</div>
```

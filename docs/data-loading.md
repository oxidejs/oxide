# Data Loading

## With Fetch API

```svelte twoslash
// src/app/pokemon/[name].svelte
<script lang="ts" module>
  import { LoaderContext } from '@oxidejs/framework'

  export async function load({ url }: LoaderContext) {
    const req = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${url.params.name}`
    )
    const data = await req.json()
    return { pokemon: data }
  }
</script>

<script lang="ts">
  let { data } = $props()
</script>

<div>{data.pokemon.name}</div>
```

## With ORPC

```svelte twoslash
// src/app/pokemon/[name].svelte
<script lang="ts" module>
  import { client } from '$orpc'

  export async function load({ url }: LoaderContext) {
    return {
      pokemon: await client.pokemon({
        name: url.params.name
      })
    }
  }
</script>

<script lang="ts">
  let { data } = $props()
</script>

<div>{data.pokemon.name}</div>
```

## Redirects

If there's some conditional logic that should prevent user from viewing specific route, you can early return a `Response` with HTTP 302 status code. We've prepared a helper utility `redirect` so it's easier.

```svelte twoslash
// src/app/dashboard.svelte
<script lang="ts" module>
  import { redirect } from '$oxide'
  import { auth } from '$lib/auth'

  export async function load({ request }: LoaderContext) {
    const authSession = await auth.api.getSession({
      headers: request.headers
    })
    if (!authSession?.user) {
      return redirect('/login')
    }
    return {
      user: authSession.user
    }
  }
</script>

<script lang="ts">
  let { data } = $props()
</script>

<div>Authenticated only</div>
<div>Email: {data.user.email}</div>
```

## Static Generation

```svelte twoslash
// src/app/pokemon/[name].svelte
<script lang="ts" module>
  import { LoaderContext } from '@oxidejs/framework'

  export async function generateStaticParams() {
    const req = await fetch('https://pokeapi.co/api/v2/pokemon')
    const data = await req.json()
    return data.results.map((pokemon) => ({
      name: pokemon.name
    }))
  }

  export async function load({ params }: LoaderContext) {
    const req = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${params.name}`
    )
    const data = await req.json()
    return { pokemon: data }
  }
</script>

<script lang="ts">
  let { data } = $props()
</script>

<div>{data.pokemon.name}</div>
```

# Data Loading

Oxide makes data loading simple with global `await` and type-safe oRPC integration.

## Global Await

Use `await` directly in your components for both server and client:

```svelte
<!-- src/app/posts/index.svelte -->
<script lang="ts">
  import { rpc } from '$oxide'

  const posts = await rpc.api.posts.list()
</script>

<h1>Posts</h1>
{#each posts as post}
  <article>{post.title}</article>
{/each}
```

## Dynamic Routes

Access route parameters with `useRoute()`:

```svelte
<!-- src/app/users/[id].svelte -->
<script lang="ts">
  import { rpc, useRoute } from '$oxide'

  const route = useRoute()
  const userId = $derived(route.params.id)
  const user = await rpc.api.users.byId({ id: userId })
</script>

<h1>{user.name}</h1>
```

## Parallel Loading

Load multiple data sources at once:

```svelte
<script lang="ts">
  import { rpc, useRoute } from '$oxide'

  const route = useRoute()
  const userId = $derived(route.params.id)

  const [user, posts] = await Promise.all([
    rpc.api.users.byId({ id: userId }),
    rpc.api.posts.byUser({ userId: userId })
  ])
</script>
```

## Client-Side Updates

Use `$effect` for reactive data loading (never make it async):

```svelte
<script lang="ts">
  import { rpc } from '$oxide'

  let searchQuery = $state('')
  let results = $state([])

  $effect(() => {
    if (searchQuery) {
      rpc.api.search.query({ q: searchQuery })
        .then(data => results = data)
    } else {
      results = []
    }
  })
</script>

<input bind:value={searchQuery} />
{#each results as result}
  <div>{result.title}</div>
{/each}
```

## Error Handling

Handle errors with try-catch:

```svelte
<script lang="ts">
  import { rpc, useRoute } from '$oxide'

  const route = useRoute()
  const userId = $derived(route.params.id)
  let user = $state(null)
  let error = $state(null)

  try {
    user = await rpc.api.users.byId({ id: userId })
  } catch (err) {
    error = err
  }
</script>

{#if error}
  <div>Error: {error.message}</div>
{:else if user}
  <h1>{user.name}</h1>
{:else}
  <div>Loading...</div>
{/if}
```

## External APIs

Use `fetch` or `ofetch` for external APIs:

```svelte
<script lang="ts">
  import { useRoute } from '$oxide'

  const route = useRoute()
  const userId = $derived(route.params.id)

  const response = await fetch(`https://api.example.com/users/${userId}`)
  const user = await response.json()
</script>
```

## Key Rules

- Use global `await` for initial data loading
- Never use `async` in `onMount` or `$effect`
- Use `$effect` with `.then()` for reactive updates
- Access database through `context.db` in oRPC handlers
- Handle errors with try-catch blocks

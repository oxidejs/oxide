# Navigation

Use type-safe navigation with `href` and `useRouter()`.

## Type-Safe Links

Use `href` for compile-time route validation:

```svelte
<script lang="ts">
  import { href } from '$oxide'
</script>

<a href={href`/`}>Home</a>
<a href={href`/about`}>About</a>
<a href={href`/users/${userId}`}>User Profile</a>
```

## Query Parameters

Add query params with URLSearchParams:

```svelte
<script lang="ts">
  import { href } from '$oxide'

  const params = new URLSearchParams({
    q: 'search term',
    page: '2'
  })
</script>

<a href={href`/search?${params}`}>Search Results</a>
```

## Programmatic Navigation

Use `useRouter()` to navigate programmatically:

```svelte
<script lang="ts">
  import { useRouter, href } from '$oxide'

  const router = useRouter()

  function goToDashboard() {
    router.push(href`/dashboard`)
  }

  function goBack() {
    router.back()
  }
</script>

<button onclick={goToDashboard}>Go to Dashboard</button>
<button onclick={goBack}>Go Back</button>
```

## Current Route Info

Get current route data with `useRoute()`:

```svelte
<script lang="ts">
  import { useRoute } from '$oxide'

  const route = useRoute()

  // Route parameters
  const userId = $derived(route.params.id)

  // Query parameters
  const page = $derived(route.query.get('page'))

  // Current path
  const currentPath = $derived(route.location.pathname)
</script>

<p>Current user: {userId}</p>
<p>Page: {page || '1'}</p>
```

## Reactive Navigation

Update based on route changes:

```svelte
<script lang="ts">
  import { useRoute, rpc } from '$oxide'

  const route = useRoute()
  let searchResults = $state([])

  $effect(() => {
    const query = route.query.get('q')
    if (query) {
      rpc.api.search.query({ q: query })
        .then(results => searchResults = results)
    }
  })
</script>
```

## Navigation Events

Listen to navigation changes:

```svelte
<script lang="ts">
  import { useRouter } from '$oxide'
  import { onMount } from 'svelte'

  const router = useRouter()
  let isNavigating = $state(false)

  onMount(() => {
    return router.subscribe((event) => {
      isNavigating = event.type === 'navigate'
    })
  })
</script>

{#if isNavigating}
  <div class="loading-bar"></div>
{/if}
```

## Key Points

- Use `href` for type-safe links
- Use `useRouter()` for programmatic navigation
- Access route data with `useRoute()`
- Never use `async` in navigation event handlers
- All navigation is type-checked at compile time

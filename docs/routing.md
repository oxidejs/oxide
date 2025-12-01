# Routing

Oxide uses file system routing. Create `.svelte` files in `src/app` and they become routes.

## Basic Routes

```
src/app/
├── index.svelte     → /
├── about.svelte     → /about
├── contact.svelte   → /contact
└── blog/
    └── index.svelte → /blog
```

## Dynamic Routes

Use `[param]` for dynamic segments:

```
src/app/
├── users/
│   └── [id].svelte          → /users/123
├── blog/
│   └── [slug].svelte        → /blog/my-post
└── shop/
    └── [category]/
        └── [product].svelte → /shop/electronics/phone
```

Access parameters with `useRoute()`:

```svelte
<script lang="ts">
  import { useRoute } from '$oxide'

  const route = useRoute()
  const userId = $derived(route.params.id)
</script>
```

## Catch-All Routes

Use `[...param]` to match multiple segments:

```
src/app/
└── docs/
    └── [...path].svelte → /docs/guide/getting-started
```

## Route Groups

Use `(group)` to organize without affecting URLs:

```
src/app/
├── (auth)/
│   ├── login.svelte    → /login
│   └── register.svelte → /register
└── (dashboard)/
    ├── stats.svelte    → /stats
    └── users.svelte    → /users
```

## Layouts

Create layouts by matching folder and file names:

```
src/app/
├── dashboard.svelte        ← Layout
└── dashboard/
    ├── index.svelte       → /dashboard
    └── analytics.svelte   → /dashboard/analytics
```

Layout files need a `children` slot:

```svelte
<!-- dashboard.svelte -->
<script lang="ts">
  const { children } = $props()
</script>

<nav>Dashboard Nav</nav>
{@render children?.()}
```

## Navigation

Use `href` for type-safe links:

```svelte
<script lang="ts">
  import { href } from '$oxide'
</script>

<a href={href`/users/${userId}`}>User Profile</a>
```

Use `useRouter()` for programmatic navigation:

```svelte
<script lang="ts">
  import { useRouter, href } from '$oxide'

  const router = useRouter()

  function navigate() {
    router.push(href`/dashboard`)
  }
</script>
```

## 404 Pages

Use catch-all routes for 404 handling:

```
src/app/
└── [...notFound].svelte → catches all unmatched routes
```

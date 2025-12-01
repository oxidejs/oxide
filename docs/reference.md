# API Reference

Quick reference for Oxide's core APIs.

## $oxide Module

Import framework utilities:

```typescript
import { useRouter, useRoute, href, rpc } from "$oxide";
```

### useRouter()

Navigate programmatically:

```typescript
const router = useRouter();

router.push(href`/dashboard`); // Navigate to route
router.replace(href`/login`); // Replace current route
router.back(); // Go back
router.forward(); // Go forward
```

### useRoute()

Get current route info:

```typescript
const route = useRoute();

route.params.id; // Route parameters
route.query.get("page"); // Query parameters
route.location.pathname; // Current path
```

### href

Type-safe URL construction:

```typescript
href`/users/${userId}`; // Dynamic routes
href`/search?q=${query}`; // With query params
href`/posts/${slug}#comments`; // With hash
```

### rpc

Type-safe API client:

```typescript
// Calls your oRPC routes
const users = await rpc.api.users.list();
const user = await rpc.api.users.byId({ id: "123" });

// With error handling
try {
  await rpc.api.users.create({ name, email });
} catch (error) {
  if (error.code === "CONFLICT") {
    console.log("User already exists");
  }
}
```

## oRPC Setup

### Base Procedure

Set up in `src/lib/orpc/index.ts`:

```typescript
import { os } from "@orpc/server";
import { z } from "zod";

export const base = os.context(createContext).errors({
  NOT_FOUND: { message: "Not found" },
  UNAUTHORIZED: { message: "Unauthorized" },
  FORBIDDEN: { message: "Forbidden" },
  CONFLICT: {
    data: z.object({ field: z.string() }),
  },
});

export const protectedBase = base.use(authMiddleware);
```

### Context Creation

Set up request context in `src/lib/orpc/context.ts`:

```typescript
export function createContext({ req }: { req: Request }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (token) {
    return verifyToken(token).then((user) => ({ user, req, db }));
  }

  return Promise.resolve({ user: null, req, db });
}
```

### Router Creation

Create API routes in `src/app/api/`:

```typescript
// src/app/api/users.ts
export const router = {
  list: base.handler(({ context }) => {
    return context.db.users.findMany();
  }),

  byId: base
    .input(z.object({ id: z.string() }))
    .handler(({ input, context, errors }) => {
      return context.db.users
        .findUnique({ where: { id: input.id } })
        .then((user) => {
          if (!user) throw errors.NOT_FOUND();
          return user;
        });
    }),

  create: protectedBase
    .input(
      z.object({
        name: z.string(),
        email: z.string().email(),
      }),
    )
    .handler(({ input, context, errors }) => {
      return context.db.users.create({ data: input }).catch((error) => {
        if (error.code === "P2002") {
          throw errors.CONFLICT({ data: { field: "email" } });
        }
        throw error;
      });
    }),
};
```

## Middleware

Create reusable middleware:

```typescript
// src/lib/orpc/middleware.ts
export const authMiddleware = base.middleware().use(({ ctx, next, errors }) => {
  if (!ctx.user) {
    throw errors.UNAUTHORIZED();
  }
  return next();
});

export const loggerMiddleware = base.middleware().use(({ next, path }) => {
  console.log(`[API] ${path}`);
  return next();
});
```

## File System Routes

Routes are created from file structure:

```
src/app/
├── index.svelte          → /
├── about.svelte          → /about
├── users/
│   ├── index.svelte      → /users
│   └── [id].svelte       → /users/123
├── blog/
│   └── [slug].svelte     → /blog/my-post
├── (auth)/
│   ├── login.svelte      → /login
│   └── register.svelte   → /register
└── [...catch].svelte     → 404 handler
```

## Error Handling

### In oRPC Handlers

```typescript
.handler(({ input, context, errors }) => {
  // Validation error
  if (!input.email) {
    throw errors.BAD_REQUEST()
  }

  // Not found
  if (!resource) {
    throw errors.NOT_FOUND()
  }

  // Authorization
  if (ctx.user.id !== resource.ownerId) {
    throw errors.FORBIDDEN()
  }

  // Conflict (duplicate)
  if (duplicate) {
    throw errors.CONFLICT({
      data: { field: 'email' }
    })
  }
})
```

### In Components

```svelte
<script lang="ts">
  try {
    const user = await rpc.api.users.byId({ id })
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      // Handle not found
    } else if (error.code === 'UNAUTHORIZED') {
      // Redirect to login
    }
  }
</script>
```

## Environment Variables

### Server-side (private)

```bash
# .env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
STRIPE_SECRET_KEY=sk_...
```

```typescript
// Access in oRPC handlers
import { env } from "$env/dynamic/private";
const dbUrl = env.DATABASE_URL;
```

### Client-side (public)

```bash
# .env
PUBLIC_API_URL=https://api.example.com
PUBLIC_STRIPE_KEY=pk_...
```

```typescript
// Access in components
import { env } from "$env/dynamic/public";
const apiUrl = env.PUBLIC_API_URL;
```

## Type Generation

Oxide generates types in `.oxide/types.d.ts`:

```typescript
// Auto-generated route types
type Routes = "/" | "/about" | `/users/${string}`;

// Auto-generated API types
interface API {
  users: {
    list(): Promise<User[]>;
    byId(params: { id: string }): Promise<User>;
    create(params: { name: string; email: string }): Promise<User>;
  };
}
```

## Build Commands

```bash
# Development
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Type checking
bun run check

# Linting
bun run lint
```

## Key Rules

- Use global `await` for initial data loading
- Never use `async` in `onMount` or `$effect`
- Access database through `context.db` in handlers
- Use `errors.NOT_FOUND()` for type-safe errors
- Import shared code with `$lib` alias
- All navigation is type-checked at compile time

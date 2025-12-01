# oRPC

oRPC provides type-safe APIs with full end-to-end type safety. Define your API once, use it everywhere with complete type checking.

## Setup

Create your base procedure in `$lib/orpc`:

```typescript
// src/lib/orpc/index.ts
import { os } from "@orpc/server";
import { z } from "zod";
import { createContext } from "./context";

export const base = os.context(createContext).errors({
  NOT_FOUND: {
    message: "Resource not found",
  },
  UNAUTHORIZED: {
    message: "Authentication required",
  },
  FORBIDDEN: {
    message: "Access forbidden",
  },
  CONFLICT: {
    data: z.object({
      field: z.string(),
    }),
  },
});

export const protectedBase = base.use(authMiddleware);
```

## Context Setup

Include your database and user session:

```typescript
// src/lib/orpc/context.ts
import { db } from "$lib/db";

export function createContext({ req }: { req: Request }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (token) {
    return verifyToken(token).then((user) => ({ user, req, db }));
  }

  return Promise.resolve({ user: null, req, db });
}
```

## Creating Routes

Define API routes as TypeScript files in `src/app`:

```typescript
// src/app/api/users.ts
import { base, protectedBase } from "$lib/orpc";
import { z } from "zod";

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
          if (!user) {
            throw errors.NOT_FOUND();
          }
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
          throw errors.CONFLICT({
            message: "Email already exists",
            data: { field: "email" },
          });
        }
        throw error;
      });
    }),
};
```

## Using in Components

The oRPC client is available as `rpc` from `$oxide`:

```svelte
<script lang="ts">
  import { rpc } from '$oxide'

  const users = await rpc.api.users.list()

  async function createUser() {
    try {
      await rpc.api.users.create({
        name: 'John',
        email: 'john@example.com'
      })
    } catch (error) {
      if (error.code === 'CONFLICT') {
        console.log('Email already exists')
      }
    }
  }
</script>

{#each users as user}
  <div>{user.name}</div>
{/each}
```

## Nested Routes

Organize complex APIs with nested objects:

```typescript
// src/app/api/users.ts
export const router = {
  list: base.handler(({ context }) => context.db.users.findMany()),

  profile: {
    get: base
      .input(z.object({ userId: z.string() }))
      .handler(({ input, context }) => {
        return context.db.profiles.findUnique({
          where: { userId: input.userId },
        });
      }),

    update: protectedBase
      .input(
        z.object({
          userId: z.string(),
          bio: z.string(),
        }),
      )
      .handler(({ input, ctx, context, errors }) => {
        if (ctx.user.id !== input.userId) {
          throw errors.FORBIDDEN();
        }

        return context.db.profiles.update({
          where: { userId: input.userId },
          data: { bio: input.bio },
        });
      }),
  },
};
```

This creates endpoints:

- `/api/users/list`
- `/api/users/profile/get`
- `/api/users/profile/update`

## Middleware

Create reusable middleware for auth and logging:

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

## Error Handling

Handle errors with type-safe error objects:

```typescript
// In handlers
.handler(({ input, context, errors }) => {
  if (!input.id) {
    throw errors.NOT_FOUND()
  }

  if (unauthorized) {
    throw errors.UNAUTHORIZED()
  }

  if (duplicate) {
    throw errors.CONFLICT({
      data: { field: 'email' }
    })
  }
})
```

```svelte
<!-- In components -->
<script lang="ts">
  try {
    await rpc.api.users.create(data)
  } catch (error) {
    if (error.code === 'CONFLICT') {
      console.log('Duplicate:', error.data.field)
    }
  }
</script>
```

## Key Benefits

- **Type Safety**: Full end-to-end types from server to client
- **Simple Setup**: Just export a `router` object
- **Auto Routes**: File system creates API endpoints
- **Error Handling**: Type-safe errors with `errors.NOT_FOUND()`
- **SSR Optimized**: No HTTP requests on server-side
- **Database Access**: Always use `context.db` in handlers

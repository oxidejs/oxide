# KV Storage

Key Value Storage is a data storage that allows you to store and retrieve data globally.

## With unstorage

### Installation

1. Install `unstorage`.

::: details Install with NPM {open}

```sh
npm i unstorage
```

:::
::: details Install with Bun

```sh
bun add unstorage
```

:::

2. Setup the oRPC context and the KV storage.

```ts twoslash
// src/lib/kv.ts
import { createStorage } from "unstorage";

export const kv = createStorage();
```

```ts twoslash
// src/lib/orpc.ts
import { os } from "@orpc/server";
import type { Storage } from "unstorage"; // [!code ++]

export const base = os
  .$context<{ headers: Headers }>() // [!code --]
  .$context<{ headers: Headers; kv: Storage }>() // [!code ++]
  .response({
    OK: {},
    CREATED: {},
  })
  .errors({
    BAD_REQUEST: {},
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
    SERVICE_UNAVAILABLE: {},
  });

export { type } from "@orpc/server";
```

```ts twoslash
// src/server.ts
import { RPCHandler } from "@orpc/server/fetch";
import { router } from "$oxide";
import { kv } from "$lib/kv";

const orpcHandler = new RPCHandler(router);

export default {
  async fetch(request: Request) {
    // ...
    const orpcResult = await orpcHandler.handle(request, {
      prefix: "/rpc",
      context: { headers: request.headers }, // [!code --]
      context: { headers: request.headers, kv }, // [!code ++]
    });
    // ...
  },
};
```

### Usage

```ts twoslash
// src/routers/example.ts
import { base, type } from "$lib/orpc";

export const router = {
  set: base
    .input(type<{ foo: string }>())
    .handler(async ({ context, input }) => {
      await context.kv.setItem("foo", input.foo);
    }),
};
```

import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import App from "./app.svelte";
import { OxideHandler } from "@oxidejs/framework";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import { router } from "$oxide";
import { kv } from "$lib/kv";

const orpcHandler = new RPCHandler(router, {
  plugins: [new ResponseHeadersPlugin()],
});

const oxideHandler = new OxideHandler({
  app: App,
});

export default {
  async fetch(request: Request) {
    const oxideResult = await oxideHandler.handle(request);
    if (oxideResult.matched) {
      return oxideResult.response;
    }
    const orpcResult = await orpcHandler.handle(request, {
      prefix: "/rpc",
      context: { kv, headers: request.headers },
    });
    if (orpcResult.matched) {
      return orpcResult.response;
    }
    return new Response("Not Found", { status: 404 });
  },
};

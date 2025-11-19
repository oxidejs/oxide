import { RPCHandler } from "@orpc/server/fetch";
import App from "./app.svelte";
import { OxideHandler } from "@oxidejs/framework";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import { router } from "$oxide";
import { kv } from "$lib/kv";
import { db } from "$lib/db";
import { auth } from "$lib/auth";

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
      context: { kv, headers: request.headers, db },
    });
    if (orpcResult.matched) {
      return orpcResult.response;
    }
    console.log(">>>REQ", request);
    const authResult = await auth.handler(request);
    if (authResult.ok) {
      return authResult;
    }
    return new Response("Not Found", { status: 404 });
  },
};

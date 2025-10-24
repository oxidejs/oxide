import { RPCHandler } from "@orpc/server/fetch";
import App from "./app.svelte";
import { OxideHandler } from "@oxidejs/framework";
import { router } from "$oxide";

const orpcHandler = new RPCHandler(router);

const oxideHandler = new OxideHandler({
  app: App,
});

export default {
  async fetch(request: Request) {
    const orpcResult = await orpcHandler.handle(request, {
      prefix: "/rpc",
      context: {}, // Provide initial context if needed
    });
    if (orpcResult.matched) {
      return orpcResult.response;
    }
    const oxideResult = await oxideHandler.handle(request);
    if (oxideResult.matched) {
      return oxideResult.response;
    }
    return new Response("Not Found", { status: 404 });
  },
};

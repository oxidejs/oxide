import App from "./app.svelte";
import { RPCHandler } from "@orpc/server/fetch";
import { OxideHandler } from "@oxidejs/framework";
import { router } from "$oxide";

const orpcHandler = new RPCHandler(router);

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
      context: { headers: request.headers },
    });
    if (orpcResult.matched) {
      return orpcResult.response;
    }
    return new Response("Not Found", { status: 404 });
  },
};

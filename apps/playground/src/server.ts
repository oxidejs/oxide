import { router as orpcRouter } from "$lib/routers";
import { router } from "$oxide/server";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { HTTPError } from "nitro/h3";
import { OxideHandler } from "oxidejs/nitro";

const oxideHandler = new OxideHandler({ router });

const orpcHandler = new RPCHandler(orpcRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function fetch(request: Request) {
  const orpcResult = await orpcHandler.handle(request, {
    prefix: "/rpc",
    context: { headers: request.headers },
  });
  if (orpcResult.matched) {
    return orpcResult.response;
  }
  const oxideResult = await oxideHandler.handle(request);
  if (oxideResult.matched) {
    return oxideResult.response;
  }
  throw HTTPError.status(404);
}

export default {
  fetch,
};

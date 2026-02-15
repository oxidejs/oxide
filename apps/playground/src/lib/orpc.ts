import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { useRequest } from "oxidejs/nitro?server";

import { router } from "./routers";

declare global {
  var $client: RouterClient<typeof router> | undefined;
}

const link = new RPCLink({
  url: () => `${window.location.origin}/rpc`,
});

export const client: RouterClient<typeof router> = import.meta.env.SSR
  ? createRouterClient(router, {
      context: () => {
        return {
          headers: useRequest().headers,
        };
      },
    })
  : createORPCClient(link);

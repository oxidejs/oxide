import { os } from "@orpc/server";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";
import type { Storage } from "unstorage";

interface ORPCContext extends ResponseHeadersPluginContext {
  headers: Headers;
  kv: Storage;
}

export const base = os.$context<ORPCContext>().errors({
  BAD_REQUEST: {},
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  TOO_MANY_REQUESTS: {},
  INTERNAL_SERVER_ERROR: {},
  SERVICE_UNAVAILABLE: {},
});

export { type } from "@orpc/server";

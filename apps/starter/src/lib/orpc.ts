import { os } from "@orpc/server";

export const base = os.$context<{ headers: Headers }>().errors({
  BAD_REQUEST: {},
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  TOO_MANY_REQUESTS: {},
  INTERNAL_SERVER_ERROR: {},
  SERVICE_UNAVAILABLE: {},
});

export { type } from "@orpc/server";

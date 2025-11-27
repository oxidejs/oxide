import { os } from "@orpc/server";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";
import type { Storage } from "unstorage";
import type { Database } from "./db";
import type { Session, User } from "better-auth";

interface ORPCContext extends ResponseHeadersPluginContext {
  headers: Headers;
  kv: Storage;
  db: Database;
  user: User | undefined;
  session: Session | undefined;
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

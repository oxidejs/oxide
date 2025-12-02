// Browser-safe exports for client-side use
// This module contains only what's needed in the browser to avoid Node.js dependencies

export {
  ROUTER_CONTEXT_KEY,
  useRouter,
  useRoute,
  href,
  setRouterContext,
} from "./shared/router-utils.js";
export type {
  Location,
  RouteParams,
  Router as RouterInterface,
  Route,
  RouterContext,
} from "./shared/router-utils.js";

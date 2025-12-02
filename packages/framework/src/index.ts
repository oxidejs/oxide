export { OxidePlugin as oxide } from "./plugin";
export { OxideHandler } from "./handler";
export { default as Router } from "./components/router.svelte";
export type {
  FsRouterOptions,
  RouteNode,
  RouteRecord,
  PluginContext,
} from "./types";

// Virtual module types and utilities
export type {
  Location,
  RouteParams,
  Route,
  Router as RouterInterface,
  RouterContext,
} from "./virtual";
export {
  useRouter,
  useRoute,
  href,
  setRouterContext,
  ROUTER_CONTEXT_KEY,
} from "./virtual";

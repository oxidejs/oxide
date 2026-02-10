export type {
  LinkOptions,
  NavigationOptions,
  ScrollOptions,
  Route,
  Layout,
  ErrorBoundary,
  RouteManifest,
  NavigationPayload,
  OxideUrl,
} from "./types.js";

export {
  link,
  links,
  navigate,
  preloadRoute,
  isExternalUrl,
  isSameOriginUrl,
  normalizeUrl,
} from "./client-actions.js";

export type { OxideUrl as OxideUrlType, RouteState, Router } from "./context.js";

export { useRouter, useRoute, usePayload, parseUrl } from "./context.js";

export type { OxideConfig } from "./config.js";

export { setConfig, getConfig } from "./config.js";

export { parseRouteParams } from "./shared-utils.js";

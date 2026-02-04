// Main browser-friendly entry point for oxidejs
// This module only contains client-side code and actions

export type {
  LinkOptions,
  NavigationOptions,
  ScrollOptions,
  Route,
  Layout,
  ErrorBoundary,
  RouteManifest,
  NavigationPayload,
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

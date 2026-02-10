export interface OxideUrl {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  query: Record<string, string>;
}

export type Route = {
  path: string;
  handler: string;
  priority: number;
  load?: () => Promise<any>;
};

export type Layout = {
  handler: string;
  level: number;
  segment: string;
};

export type ErrorBoundary = {
  handler: string;
  level: number;
  segment: string;
};

export type RouteWithLayouts = {
  route: Route;
  layouts: Layout[];
  errorBoundaries: ErrorBoundary[];
};

export interface NavigationPayload {
  url: OxideUrl;
  params: Record<string, string | string[]>;
  data?: Record<string, any>;
  timestamp: number;
}

export interface LinkOptions {
  replaceState?: boolean;
  noscroll?: boolean;
  keepfocus?: boolean;
  preload?: boolean | "hover" | "viewport" | "intent";
}

export interface ScrollOptions {
  behavior?: "auto" | "preserve" | "top";
  left?: number;
  top?: number;
}

export interface NavigationOptions extends LinkOptions {
  scroll?: ScrollOptions;
  pushState?: boolean;
}

export interface RouteManifest {
  routes?: Route[];
  layouts?: Layout[];
  errors?: ErrorBoundary[];
  importRoute?(handler: string): Promise<{ default: any }>;
  importRouteAssets?(handler: string): Promise<any>;
  LayoutRenderer?: any;
  ErrorRenderer?: any;
}

export interface PreloadCache {
  [url: string]: {
    payload: NavigationPayload;
    timestamp: number;
    expiry?: number;
  };
}

export interface NavigationState {
  url: OxideUrl;
  params: Record<string, string | string[]>;
  loading: boolean;
  error?: Error;
}

export interface ViewTransitionOptions {
  enabled?: boolean;
  name?: string;
  duration?: number;
  easing?: string;
}

export interface OxideConfig {
  routesDir?: string;
  trailingSlash?: "never" | "always" | "ignore";
  base?: string;
  preload?: {
    default?: boolean | "hover" | "viewport" | "intent";
    rootMargin?: string;
    enableHoverPreload?: boolean;
    enableViewportPreload?: boolean;
    respectDataSaver?: boolean;
  };
  scrollBehavior?: ScrollOptions;
  viewTransitions?: ViewTransitionOptions;
}

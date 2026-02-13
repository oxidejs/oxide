import type { Route, Layout, ErrorBoundary, RouteManifest } from "./types.js";

declare global {
  interface Window {
    __OXIDE_ROUTES_MANIFEST__?: RouteManifest;
    __OXIDE_ROUTER__?: {
      push: (href: string) => Promise<void>;
      replace: (href: string) => Promise<void>;
      go: (delta: number) => void;
      route: { subscribe: (cb: (value: any) => void) => () => void };
      payload: { subscribe: (cb: (value: any) => void) => () => void };
    };
    __OXIDE_SSR_DATA__?: Record<string, any>;
  }
}

export {};

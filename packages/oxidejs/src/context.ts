import { getContext } from "svelte";
import { readable, type Readable } from "svelte/store";
import type { Route } from "./types.js";

/**
 * Context key for the Oxide router instance.
 * Used by OxideProvider component to set Svelte context.
 * @internal
 */
export const ROUTER_CONTEXT_KEY = Symbol("oxide-router");

/**
 * Context key for the current route state.
 * Used by OxideProvider component to set Svelte context.
 * @internal
 */
export const ROUTE_CONTEXT_KEY = Symbol("oxide-route");

/**
 * Context key for the navigation payload.
 * Used by OxideProvider component to set Svelte context.
 * @internal
 */
export const PAYLOAD_CONTEXT_KEY = Symbol("oxide-payload");

export interface OxideUrl {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  query: Record<string, string>;
}

export interface RouteState {
  params: Record<string, string | string[]>;
  url: OxideUrl;
  matched?: Route;
  canonical?: string;
}

export interface Router {
  push(href: string): Promise<void>;
  replace(href: string): Promise<void>;
  go(delta: number): void;
  isReady(): Promise<void>;
}

export function useRouter(): Router {
  const router = getContext<Router>(ROUTER_CONTEXT_KEY);

  if (!router) {
    if (typeof window !== "undefined" && (window as any).__OXIDE_ROUTER__) {
      return (window as any).__OXIDE_ROUTER__;
    }
    throw new Error(
      "useRouter() must be called within a component tree that has router context, or after router initialization",
    );
  }

  return router;
}

export function useRoute(): Readable<RouteState> {
  const route = getContext<Readable<RouteState>>(ROUTE_CONTEXT_KEY);

  if (!route) {
    if (typeof window !== "undefined" && (window as any).__OXIDE_ROUTER__) {
      return (window as any).__OXIDE_ROUTER__.route;
    }
    throw new Error(
      "useRoute() must be called within a component tree that has route context, or after router initialization",
    );
  }

  return route;
}

export function usePayload<T = any>(): Readable<T> {
  const payload = getContext<Readable<T>>(PAYLOAD_CONTEXT_KEY);

  if (!payload) {
    if (typeof window !== "undefined" && (window as any).__OXIDE_ROUTER__) {
      return (window as any).__OXIDE_ROUTER__.payload;
    }
    throw new Error(
      "usePayload() must be called within a component tree that has payload context, or after router initialization",
    );
  }

  return payload;
}

export function parseUrl(urlString: string): OxideUrl {
  const url = new URL(
    urlString,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );

  const query: Record<string, string> = {};
  const params = new URLSearchParams(url.search);
  params.forEach((value, key) => {
    query[key] = value;
  });

  return {
    href: url.href,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    query,
  };
}

export function createRouteStore(initialRoute: RouteState): {
  store: Readable<RouteState>;
  update: (route: RouteState) => void;
} {
  let currentRoute = initialRoute;
  const subscribers = new Set<(value: RouteState) => void>();

  const store = readable(currentRoute, (set) => {
    const notify = (value: RouteState): void => set(value);
    subscribers.add(notify);

    return () => {
      subscribers.delete(notify);
    };
  });

  return {
    store,
    update: (route: RouteState) => {
      currentRoute = route;
      subscribers.forEach((notify) => notify(currentRoute));
    },
  };
}

export function createPayloadStore<T = any>(
  initialPayload: T,
): {
  store: Readable<T>;
  update: (payload: T) => void;
} {
  let currentPayload = initialPayload;
  const subscribers = new Set<(value: T) => void>();

  const store = readable(currentPayload, (set) => {
    const notify = (value: T): void => set(value);
    subscribers.add(notify);

    return () => {
      subscribers.delete(notify);
    };
  });

  return {
    store,
    update: (payload: T) => {
      currentPayload = payload;
      subscribers.forEach((notify) => notify(currentPayload));
    },
  };
}

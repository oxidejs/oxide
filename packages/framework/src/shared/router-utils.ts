import { getContext, setContext } from "svelte";

export interface Location {
  pathname: string;
  search: string;
  hash: string;
}

export interface RouteParams {
  [key: string]: string;
}

export interface RouterContext {
  navigate: (path: string, options?: { replace?: boolean }) => void;
  location: () => Location;
  params: () => RouteParams;
}

export interface Router {
  push: (path: string) => void;
  replace: (path: string) => void;
  back: () => void;
  forward: () => void;
}

export interface Route {
  location: Location;
  params: RouteParams;
  query: URLSearchParams;
}

// Declare window for SSR compatibility
const window =
  typeof globalThis !== "undefined" && "window" in globalThis
    ? globalThis.window
    : undefined;

// Single shared Symbol instance
export const ROUTER_CONTEXT_KEY: symbol = Symbol("router");

export function useRouter(): Router {
  const context = getContext<RouterContext>(ROUTER_CONTEXT_KEY);

  if (!context) {
    throw new Error("useRouter() can only be called within a Router component");
  }

  return {
    push(path: string) {
      context.navigate(path);
    },
    replace(path: string) {
      context.navigate(path, { replace: true });
    },
    back() {
      if (window && window.history) {
        window.history.back();
      }
    },
    forward() {
      if (window && window.history) {
        window.history.forward();
      }
    },
  };
}

export function useRoute(): Route {
  const context = getContext<RouterContext>(ROUTER_CONTEXT_KEY);

  if (!context) {
    throw new Error("useRoute() can only be called within a Router component");
  }

  const location = context.location();
  const params = context.params();
  const query = new URLSearchParams(location.search);

  return {
    location,
    params,
    query,
  };
}

export function href(strings: TemplateStringsArray, ...values: any[]): string {
  let result = strings[0] ?? "";

  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    if (value instanceof URLSearchParams) {
      result += value.toString();
    } else if (Array.isArray(value)) {
      result += value.join("/");
    } else {
      result += encodeURIComponent(String(value));
    }

    result += strings[i + 1] ?? "";
  }

  return result;
}

export function setRouterContext(context: RouterContext): void {
  setContext(ROUTER_CONTEXT_KEY, context);
}

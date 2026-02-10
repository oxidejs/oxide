import { addRoute, createRouter, findRoute } from "rou3";
import { mount, hydrate } from "svelte";
import type {
  Route,
  Layout,
  ErrorBoundary,
  RouteManifest,
  NavigationPayload,
  NavigationOptions,
  ScrollOptions,
  OxideUrl,
} from "./types.js";
import { setGlobalNavigate, setGlobalPreloader } from "./client-actions.js";
import { parseRouteParams } from "./shared-utils.js";
import { parseUrl, createRouteStore, createPayloadStore, type Router } from "./context.js";
import {
  getConfig,
  normalizePathWithTrailingSlash,
  shouldRedirectForTrailingSlash,
  getCanonicalUrl,
} from "./config.js";

const APP_ELEMENT_ID = "app";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

interface NavigationCache {
  [url: string]: {
    payload: NavigationPayload;
    timestamp: number;
  };
}

interface RouterState {
  currentRoute?: Route;
  currentParams: Record<string, string | string[]>;
  currentUrl: OxideUrl;
  loading: boolean;
  error?: Error;
}

class OxideClientRouter implements Router {
  private router = createRouter();
  private routes: Route[] = [];
  private layouts: Layout[] = [];
  private errors: ErrorBoundary[] = [];
  private routeManifest: RouteManifest = {} as RouteManifest;
  private navigationCache: NavigationCache = {};
  private state: RouterState = {
    currentParams: {},
    currentUrl: parseUrl(typeof window !== "undefined" ? window.location.href : "/"),
    loading: false,
  };
  private mounted = false;
  private abortController?: AbortController;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private routeStore: ReturnType<typeof createRouteStore>;
  private payloadStore: ReturnType<typeof createPayloadStore>;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.routeStore = createRouteStore({
      params: {},
      url: this.state.currentUrl,
    });

    this.payloadStore = createPayloadStore<any>({});
  }

  async initialize(routesManifest?: RouteManifest) {
    try {
      this.routeManifest = routesManifest || (window as any).__OXIDE_ROUTES_MANIFEST__ || {};
      this.routes = this.routeManifest?.routes || [];
      this.layouts = this.routeManifest?.layouts || [];
      this.errors = this.routeManifest?.errors || [];

      const sortedRoutes = [...this.routes].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.path.length - b.path.length;
      });

      for (const route of sortedRoutes) {
        addRoute(this.router, "GET", route.path, route);
      }

      setGlobalNavigate(this.push.bind(this));
      setGlobalPreloader(this.preloadRoute.bind(this));

      this.setupNavigationListeners();
      await this.mountInitialComponent();
      this.resolveReady();
    } catch (error) {
      this.resolveReady();
      throw error;
    }
  }

  private setupNavigationListeners() {
    window.addEventListener("popstate", () => {
      const url = window.location.pathname + window.location.search + window.location.hash;
      this.navigateTo(url, { pushState: false, scroll: { behavior: "auto" } });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.handleError(new Error(event.reason || "Navigation error"));
    });
  }

  async push(href: string): Promise<void> {
    return this.navigateTo(href, { pushState: true });
  }

  async replace(href: string): Promise<void> {
    return this.navigateTo(href, { replaceState: true });
  }

  go(delta: number): void {
    window.history.go(delta);
  }

  isReady(): Promise<void> {
    return this.readyPromise;
  }

  get route() {
    return this.routeStore.store;
  }

  get payload() {
    return this.payloadStore.store;
  }

  private async navigateTo(path: string, options: NavigationOptions = {}): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();

    const config = getConfig();
    const url = new URL(path, window.location.origin);
    const pathname = url.pathname;
    const search = url.search;
    const hash = url.hash;

    const canonicalPath = normalizePathWithTrailingSlash(pathname, config.trailingSlash || "never");
    const canonicalUrl = canonicalPath + search + hash;
    const needsCanonicalRedirect = shouldRedirectForTrailingSlash(
      pathname,
      config.trailingSlash || "never",
    );

    if (needsCanonicalRedirect && !options.replaceState) {
      window.history.replaceState({ path: canonicalUrl }, "", canonicalUrl);
      return this.navigateTo(canonicalUrl, { ...options, replaceState: true });
    }

    const normalizedPath = canonicalPath;
    const fullPath = normalizedPath + search + hash;

    if (
      window.location.pathname + window.location.search + window.location.hash === fullPath &&
      options.pushState !== false &&
      !options.replaceState
    ) {
      return;
    }

    this.setState({ loading: true, error: undefined });

    try {
      const match = findRoute(this.router, "GET", normalizedPath);

      if (!match?.data) {
        throw new Error(`Route not found: ${normalizedPath}`);
      }

      const route = match.data as Route;
      const params = parseRouteParams(route.path, match);
      const oxideUrl = parseUrl(fullPath);

      let payload = this.getCachedPayload(fullPath);

      if (!payload) {
        payload = await this.fetchNavigationPayload(fullPath, this.abortController.signal);
        this.cachePayload(fullPath, payload);
      }

      await this.renderRoute(route, params, oxideUrl, payload);

      if (options.replaceState) {
        window.history.replaceState({ path: fullPath }, "", fullPath);
      } else if (options.pushState !== false) {
        window.history.pushState({ path: fullPath }, "", fullPath);
      }

      this.handleScrollBehavior(options.scroll);

      this.setState({
        currentRoute: route,
        currentParams: params,
        currentUrl: oxideUrl,
        loading: false,
      });

      this.routeStore.update({
        params,
        url: oxideUrl,
        matched: route,
        canonical: canonicalUrl,
      });

      this.payloadStore.update(payload.data || {});
    } catch (error: any) {
      if (error.name === "AbortError") {
        return;
      }

      this.setState({ loading: false, error });
      this.handleError(error);
    }
  }

  private async fetchNavigationPayload(
    path: string,
    signal: AbortSignal,
  ): Promise<NavigationPayload> {
    const url = new URL(`/__oxide/payload${path}`, window.location.origin);

    const response = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: "application/json",
        "X-Oxide-Navigation": "true",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch navigation payload: ${response.status}`);
    }

    const payload = await response.json();
    return {
      url: parseUrl(path),
      params: payload.params || {},
      data: payload.data || {},
      timestamp: Date.now(),
    };
  }

  private getCachedPayload(path: string): NavigationPayload | null {
    const cached = this.navigationCache[path];
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_MAX_AGE_MS) {
      delete this.navigationCache[path];
      return null;
    }

    return cached.payload;
  }

  private cachePayload(path: string, payload: NavigationPayload): void {
    this.navigationCache[path] = {
      payload,
      timestamp: Date.now(),
    };
  }

  private async mountInitialComponent(): Promise<void> {
    const path = window.location.pathname + window.location.search + window.location.hash;
    const pathname = window.location.pathname;
    const config = getConfig();

    const canonicalPath = normalizePathWithTrailingSlash(pathname, config.trailingSlash || "never");
    const needsCanonicalRedirect = shouldRedirectForTrailingSlash(
      pathname,
      config.trailingSlash || "never",
    );

    if (needsCanonicalRedirect) {
      const canonicalUrl = getCanonicalUrl(
        pathname,
        window.location.search,
        window.location.hash,
        config.trailingSlash || "never",
      );
      window.history.replaceState({ path: canonicalUrl }, "", canonicalUrl);
      return this.mountInitialComponent();
    }

    const match = findRoute(this.router, "GET", canonicalPath);

    if (!match?.data) {
      this.handleError(new Error(`Route not found: ${path}`));
      return;
    }

    const route = match.data as Route;
    const params = parseRouteParams(route.path, match);
    const oxideUrl = parseUrl(path);

    const ssrData = (window as any).__OXIDE_SSR_DATA__;
    const payload: NavigationPayload = {
      url: oxideUrl,
      params,
      data: ssrData || {},
      timestamp: Date.now(),
    };

    this.cachePayload(path, payload);

    this.setState({
      currentRoute: route,
      currentParams: params,
      currentUrl: oxideUrl,
      loading: false,
    });

    this.routeStore.update({
      params,
      url: oxideUrl,
      matched: route,
      canonical: path,
    });

    this.payloadStore.update(payload.data || {});

    await this.renderRoute(route, params, oxideUrl, payload, true);
    this.mounted = true;
  }

  private async renderRoute(
    route: Route,
    params: Record<string, string | string[]>,
    url: OxideUrl,
    payload: NavigationPayload,
    isHydration = false,
  ): Promise<void> {
    const appElement = document.getElementById(APP_ELEMENT_ID);

    if (!appElement) {
      throw new Error(`App element with id "${APP_ELEMENT_ID}" not found`);
    }

    const componentModule = await this.routeManifest.importRoute?.(route.handler);
    const Component = componentModule?.default;

    if (!Component) {
      throw new Error(`Component not found for route: ${route.handler}`);
    }

    const routeLayouts = this.getLayoutsForRoute(route);

    const layoutComponents = await Promise.all(
      routeLayouts.map(async (layout) => {
        const layoutModule = await this.routeManifest.importRoute?.(layout.handler);
        return layoutModule?.default;
      }),
    );

    if (layoutComponents.length > 0) {
      const LayoutRenderer = this.routeManifest.LayoutRenderer;

      if (!LayoutRenderer) {
        throw new Error("LayoutRenderer not found in route manifest");
      }

      const mountFn = isHydration && this.mounted === false ? hydrate : mount;

      mountFn(LayoutRenderer, {
        target: appElement,
        props: {
          routeComponent: Component,
          layoutComponents,
          params,
          url,
        },
      });
    } else {
      const mountFn = isHydration && this.mounted === false ? hydrate : mount;

      mountFn(Component, {
        target: appElement,
        props: { params, url },
      });
    }

    if (!isHydration && this.mounted) {
      appElement.innerHTML = "";

      if (layoutComponents.length > 0) {
        const LayoutRenderer = this.routeManifest.LayoutRenderer;

        mount(LayoutRenderer, {
          target: appElement,
          props: {
            routeComponent: Component,
            layoutComponents,
            params,
            url,
          },
        });
      } else {
        mount(Component, {
          target: appElement,
          props: { params, url },
        });
      }
    }
  }

  private handleError(error: Error): void {
    const appElement = document.getElementById(APP_ELEMENT_ID);
    if (!appElement) return;

    const currentPath = window.location.pathname;
    const errorBoundaries = this.getErrorBoundariesForRoute({ path: currentPath } as Route);

    const nearestError =
      errorBoundaries.length > 0 ? errorBoundaries[errorBoundaries.length - 1] : null;

    if (nearestError) {
      this.routeManifest.importRoute?.(nearestError.handler).then((errorModule) => {
        const ErrorComponent = errorModule?.default;
        const ErrorRenderer = this.routeManifest.ErrorRenderer;

        mount(ErrorRenderer || ErrorComponent, {
          target: appElement,
          props: {
            error,
            errorComponent: ErrorComponent,
            params: this.state.currentParams,
            retry: () => {
              const path = window.location.pathname + window.location.search + window.location.hash;
              this.navigateTo(path, { pushState: false });
            },
          },
        });
      });
    } else {
      this.renderFallbackError(error);
    }
  }

  private renderFallbackError(error: Error): void {
    const appElement = document.getElementById(APP_ELEMENT_ID);
    if (!appElement) return;

    appElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ef4444;">
        <h1>Error</h1>
        <p>${error.message}</p>
        <button onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }

  private getLayoutsForRoute(route: Route): Layout[] {
    const routePath = this.getRoutePath(route);
    const routeSegments = routePath.split("/").filter(Boolean);

    return this.layouts
      .filter((layout) => {
        const layoutPath = layout.segment;
        const layoutSegments = layoutPath.split("/").filter(Boolean);

        return routeSegments.slice(0, layoutSegments.length).join("/") === layoutSegments.join("/");
      })
      .sort((a, b) => a.level - b.level);
  }

  private getErrorBoundariesForRoute(route: Route): ErrorBoundary[] {
    const routePath = this.getRoutePath(route);
    const routeSegments = routePath.split("/").filter(Boolean);

    return this.errors
      .filter((error) => {
        const errorPath = error.segment;
        const errorSegments = errorPath.split("/").filter(Boolean);

        return routeSegments.slice(0, errorSegments.length).join("/") === errorSegments.join("/");
      })
      .sort((a, b) => a.level - b.level);
  }

  private getRoutePath(route: Route): string {
    return route.handler;
  }

  private handleScrollBehavior(scroll?: ScrollOptions): void {
    if (!scroll) return;

    if (scroll.behavior === "preserve") {
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({
        top: scroll.top || 0,
        left: scroll.left || 0,
        behavior: scroll.behavior === "auto" ? "auto" : "smooth",
      });
    });
  }

  private setState(newState: Partial<RouterState>): void {
    this.state = { ...this.state, ...newState };

    window.dispatchEvent(
      new CustomEvent("oxide:navigation", {
        detail: this.state,
      }),
    );
  }

  async preloadRoute(path: string): Promise<void> {
    const normalizedPath = normalizePathWithTrailingSlash(
      new URL(path, window.location.origin).pathname,
      getConfig().trailingSlash || "never",
    );
    const match = findRoute(this.router, "GET", normalizedPath);

    if (!match?.data) return;

    const route = match.data as Route;

    const componentPromise = this.routeManifest.importRoute?.(route.handler);

    const layouts = this.getLayoutsForRoute(route);
    const layoutPromises = layouts.map((layout) =>
      this.routeManifest.importRoute?.(layout.handler),
    );

    let payloadPromise: Promise<NavigationPayload> | null = null;
    const fullPath = path;

    if (!this.getCachedPayload(fullPath)) {
      payloadPromise = this.fetchNavigationPayload(fullPath, new AbortController().signal);
    }

    await Promise.all([
      componentPromise,
      ...layoutPromises,
      payloadPromise?.then((payload) => {
        if (payload) {
          this.cachePayload(fullPath, payload);
        }
      }),
    ]);
  }

  getCurrentRoute(): Route | undefined {
    return this.state.currentRoute;
  }

  getCurrentParams(): Record<string, string | string[]> {
    return this.state.currentParams;
  }

  getCurrentUrl(): OxideUrl {
    return this.state.currentUrl;
  }

  getState(): RouterState {
    return { ...this.state };
  }

  getRoutes(): Route[] {
    return this.routes;
  }

  getLayouts(): Layout[] {
    return this.layouts;
  }

  getErrors(): ErrorBoundary[] {
    return this.errors;
  }

  isLoading(): boolean {
    return this.state.loading;
  }

  clearCache(): void {
    this.navigationCache = {};
  }
}

let oxideRouter: OxideClientRouter | undefined;

export async function initializeOxideRouter(
  routesManifest?: RouteManifest,
): Promise<OxideClientRouter> {
  if (oxideRouter) {
    return oxideRouter;
  }

  oxideRouter = new OxideClientRouter();
  await oxideRouter.initialize(routesManifest);

  // Make router globally accessible for context API fallback
  if (typeof window !== "undefined") {
    (window as any).__OXIDE_ROUTER__ = oxideRouter;
  }

  return oxideRouter;
}

export function getOxideRouter(): OxideClientRouter | undefined {
  return oxideRouter;
}

export { useRouter, useRoute, usePayload } from "./context.js";

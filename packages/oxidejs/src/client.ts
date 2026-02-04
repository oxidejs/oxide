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
} from "./types.js";
import { setGlobalNavigate, setGlobalPreloader } from "./client-actions.js";
import LayoutRenderer from "../components/LayoutRenderer.svelte";
import ErrorRenderer from "../components/ErrorRenderer.svelte";

interface NavigationCache {
  [url: string]: {
    payload: NavigationPayload;
    timestamp: number;
  };
}

interface RouterState {
  currentRoute?: Route;
  currentParams: Record<string, string>;
  loading: boolean;
  error?: Error;
}

class OxideClientRouter {
  private router = createRouter();
  private routes: Route[] = [];
  private layouts: Layout[] = [];
  private errors: ErrorBoundary[] = [];
  private routeManifest: RouteManifest = {} as RouteManifest;
  private navigationCache: NavigationCache = {};
  private state: RouterState = {
    currentParams: {},
    loading: false,
  };
  private mounted = false;
  private abortController?: AbortController;

  async initialize(routesManifest?: RouteManifest) {
    try {
      this.routeManifest = routesManifest || (window as any).__OXIDE_ROUTES_MANIFEST__ || {};
      this.routes = this.routeManifest?.routes || [];
      this.layouts = this.routeManifest?.layouts || [];
      this.errors = this.routeManifest?.errors || [];

      // Set up router with proper priority ordering
      const sortedRoutes = [...this.routes].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.path.length - b.path.length;
      });

      for (const route of sortedRoutes) {
        addRoute(this.router, "GET", route.path, route);
      }

      // Set global navigation functions
      setGlobalNavigate(this.navigateTo.bind(this));
      setGlobalPreloader(this.preloadRoute.bind(this));

      this.setupNavigationListeners();
      await this.mountInitialComponent();
    } catch (error) {
      console.error("Failed to initialize Oxide router:", error);
    }
  }

  private setupNavigationListeners() {
    window.addEventListener("popstate", (_event) => {
      const url = window.location.pathname + window.location.search + window.location.hash;
      this.navigateTo(url, {
        pushState: false,
        scroll: { behavior: "auto" },
      } as NavigationOptions);
    });

    // Handle unhandled promise rejections as navigation errors
    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled navigation error:", event.reason);
      this.handleError(new Error(event.reason || "Navigation error"));
    });
  }

  async navigateTo(path: string, options: NavigationOptions = {}): Promise<void> {
    // Cancel any ongoing navigation
    this.abortController?.abort();
    this.abortController = new AbortController();

    const normalizedPath = this.normalizePath(path);

    // Check if we're already on this path
    if (
      window.location.pathname + window.location.search + window.location.hash === normalizedPath &&
      options.pushState !== false
    ) {
      return;
    }

    this.setState({ loading: true, error: undefined });

    try {
      console.log("🔧 Client: Trying to match route:", normalizedPath);
      console.log(
        "🔧 Client: Available routes:",
        this.routes.map((r) => r.path),
      );
      const match = findRoute(this.router, "GET", normalizedPath);
      console.log("🔧 Client: Route match result:", match);

      if (!match?.data) {
        throw new Error(`Route not found: ${normalizedPath}`);
      }

      const route = match.data as Route;
      const params = match.params || {};

      // Try to get cached payload first
      let payload = this.getCachedPayload(normalizedPath);

      if (!payload) {
        // Fetch navigation payload from server
        payload = await this.fetchNavigationPayload(normalizedPath, this.abortController.signal);
        this.cachePayload(normalizedPath, payload);
      }

      // Load and render the route
      await this.renderRoute(route, params, payload);

      // Update browser history
      if (options.pushState !== false) {
        window.history.pushState({ path: normalizedPath }, "", normalizedPath);
      }

      // Handle scroll behavior
      this.handleScrollBehavior(options.scroll);

      // Update state
      this.setState({
        currentRoute: route,
        currentParams: params,
        loading: false,
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        return; // Navigation was cancelled
      }

      console.error("Navigation failed:", error);
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
      url: path,
      params: payload.params || {},
      data: payload.data || {},
      timestamp: Date.now(),
    };
  }

  private getCachedPayload(path: string): NavigationPayload | null {
    const cached = this.navigationCache[path];
    if (!cached) return null;

    // Cache expires after 5 minutes
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - cached.timestamp > maxAge) {
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

  private async mountInitialComponent() {
    const path = window.location.pathname + window.location.search + window.location.hash;
    const normalizedPath = this.normalizePath(path);
    const match = findRoute(this.router, "GET", normalizedPath);

    if (!match?.data) {
      console.warn("Initial route not found:", normalizedPath);
      return;
    }

    const route = match.data as Route;
    const params = match.params || {};

    try {
      // For SSR hydration, we don't need to fetch payload - it should be embedded
      const payload: NavigationPayload = {
        url: normalizedPath,
        params,
        data: (window as any).__OXIDE_SSR_DATA__ || {},
        timestamp: Date.now(),
      };

      await this.renderRoute(route, params, payload, true);

      this.setState({
        currentRoute: route,
        currentParams: params,
        loading: false,
      });

      this.mounted = true;
    } catch (error) {
      console.error("Failed to mount initial component:", error);
      this.handleError(error as Error);
    }
  }

  private async renderRoute(
    route: Route,
    params: Record<string, string>,
    payload: NavigationPayload,
    isInitial = false,
  ) {
    const appElement = document.getElementById("app");
    if (!appElement) {
      throw new Error("App element not found");
    }

    try {
      // Load the route component
      const componentModule = await this.routeManifest?.importRoute?.(route.handler);
      const Component = componentModule?.default;

      if (!Component) {
        throw new Error(`No default export found in ${route.handler}`);
      }

      // Get layouts for this route
      const routeLayouts = this.getLayoutsForRoute(route.handler);

      // Load layout components
      const layoutComponents = await Promise.all(
        routeLayouts.map(async (layout) => {
          try {
            const layoutModule = await this.routeManifest?.importRoute?.(layout.handler);
            return layoutModule?.default;
          } catch (error) {
            console.warn(`Failed to load layout: ${layout.handler}`, error);
            return null;
          }
        }),
      );

      const props = {
        params,
        data: payload.data || {},
      };

      let component;

      if (isInitial && this.mounted === false) {
        // First load - hydrate the server-rendered content
        if (layoutComponents.some((l) => l)) {
          component = hydrate(LayoutRenderer, {
            target: appElement,
            props: {
              routeComponent: Component,
              layoutComponents: layoutComponents.filter((l) => l),
              params,
            },
          });
        } else {
          component = hydrate(Component, {
            target: appElement,
            props: { params },
          });
        }
      } else {
        // Client-side navigation - clear and mount fresh
        if ((appElement as any)._oxideComponent) {
          appElement.innerHTML = "";
        }

        if (layoutComponents.some((l) => l)) {
          component = mount(LayoutRenderer, {
            target: appElement,
            props: {
              routeComponent: Component,
              layoutComponents: layoutComponents.filter((l) => l),
              params,
            },
          });
        } else {
          component = mount(Component, {
            target: appElement,
            props: { params },
          });
        }
      }

      // Store component reference
      (appElement as any)._oxideComponent = component;
    } catch (error) {
      console.error("Component rendering error:", error);
      throw error;
    }
  }

  private handleError(error: Error) {
    const appElement = document.getElementById("app");
    if (!appElement) return;

    // Find the nearest error boundary
    const currentPath = this.state.currentRoute?.handler || "";
    const errorBoundaries = this.getErrorBoundariesForRoute(currentPath);

    if (errorBoundaries.length > 0) {
      // Use the nearest (highest level) error boundary
      const nearestError = errorBoundaries[errorBoundaries.length - 1];
      if (!nearestError) return this.renderFallbackError(error);

      this.routeManifest
        ?.importRoute?.(nearestError.handler)
        .then((errorModule) => {
          const ErrorComponent = errorModule?.default;
          if (ErrorComponent) {
            const ErrorRenderer = this.routeManifest.ErrorRenderer;
            if (ErrorRenderer) {
              const component = mount(ErrorRenderer, {
                target: appElement,
                props: {
                  error,
                  errorComponent: ErrorComponent,
                  params: this.state.currentParams,
                  retry: () => window.location.reload(),
                },
              });
              (appElement as any)._oxideComponent = component;
            } else {
              this.renderFallbackError(error);
            }
          } else {
            this.renderFallbackError(error);
          }
        })
        .catch(() => {
          this.renderFallbackError(error);
        });
    } else {
      this.renderFallbackError(error);
    }
  }

  private renderFallbackError(error: Error) {
    const appElement = document.getElementById("app");
    if (!appElement) return;

    appElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ef4444; border: 1px solid #ef4444; border-radius: 8px; margin: 1rem; background: #fef2f2;">
        <h1 style="margin: 0 0 1rem 0; font-size: 1.5rem;">Something went wrong</h1>
        <p style="margin: 0 0 1rem 0; color: #7f1d1d;">
          ${error.message || "An unexpected error occurred"}
        </p>
        <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">
          Try Again
        </button>
        <button onclick="window.location.href = '/'" style="padding: 0.5rem 1rem; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Go Home
        </button>
      </div>
    `;
  }

  private getLayoutsForRoute(routeHandler: string): Layout[] {
    const routePath = this.getRoutePath(routeHandler);
    const routeSegments = routePath.split("/").filter(Boolean);

    return this.layouts
      .filter((layout) => {
        const layoutPath = this.getRoutePath(layout.handler);
        const layoutSegments = layoutPath.split("/").filter(Boolean);

        // Layout applies if route path starts with layout path
        if (layoutSegments.length === 0) return true; // Root layout
        if (layoutSegments.length > routeSegments.length) return false;

        return layoutSegments.every((segment, index) => segment === routeSegments[index]);
      })
      .sort((a, b) => a.level - b.level);
  }

  private getErrorBoundariesForRoute(routeHandler: string): ErrorBoundary[] {
    const routePath = this.getRoutePath(routeHandler);
    const routeSegments = routePath.split("/").filter(Boolean);

    return this.errors
      .filter((error) => {
        const errorPath = this.getRoutePath(error.handler);
        const errorSegments = errorPath.split("/").filter(Boolean);

        // Error boundary applies if route path starts with error path
        if (errorSegments.length === 0) return true; // Root error boundary
        if (errorSegments.length > routeSegments.length) return false;

        return errorSegments.every((segment, index) => segment === routeSegments[index]);
      })
      .sort((a, b) => a.level - b.level);
  }

  private getRoutePath(handler: string): string {
    // Extract path from handler: "src/routes/about/+layout.svelte" -> "about"
    const match = handler.match(/src\/routes\/(.+)\/[^/]+$/);
    return match?.[1] ?? "";
  }

  private normalizePath(path: string): string {
    try {
      const url = new URL(path, window.location.origin);
      let pathname = url.pathname;

      // Remove trailing slash except for root
      if (pathname !== "/" && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }

      return pathname + url.search + url.hash;
    } catch {
      return path;
    }
  }

  private handleScrollBehavior(scroll?: ScrollOptions) {
    if (!scroll || scroll.behavior === "preserve") {
      return;
    }

    if (scroll.behavior === "top" || !scroll.behavior) {
      window.scrollTo({
        top: scroll.top || 0,
        left: scroll.left || 0,
        behavior: "smooth",
      });
    }

    // "auto" behavior is handled by the browser for back/forward navigation
  }

  private setState(newState: Partial<RouterState>) {
    this.state = { ...this.state, ...newState };

    // Emit custom event for state changes
    window.dispatchEvent(
      new CustomEvent("oxide:navigation", {
        detail: this.state,
      }),
    );
  }

  async preloadRoute(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    const match = findRoute(this.router, "GET", normalizedPath);

    if (!match?.data) return;

    const route = match.data as Route;

    try {
      // Preload component
      const componentPromise = this.routeManifest?.importRoute?.(route.handler);

      // Preload layouts
      const layouts = this.getLayoutsForRoute(route.handler);
      const layoutPromises = layouts.map((layout) =>
        this.routeManifest?.importRoute?.(layout.handler),
      );

      // Preload navigation payload
      let payloadPromise: Promise<NavigationPayload> | null = null;
      if (!this.getCachedPayload(normalizedPath)) {
        payloadPromise = this.fetchNavigationPayload(normalizedPath, new AbortController().signal)
          .then((payload) => {
            this.cachePayload(normalizedPath, payload);
            return payload;
          })
          .catch(() => {
            // Ignore preload payload errors
            return {
              url: normalizedPath,
              params: {},
              data: {},
              timestamp: Date.now(),
            };
          });
      }

      // Wait for all preloads
      await Promise.all([componentPromise, ...layoutPromises, payloadPromise].filter(Boolean));
    } catch (error) {
      console.warn("Failed to preload route:", normalizedPath, error);
    }
  }

  // Public API
  getCurrentRoute(): Route | undefined {
    return this.state.currentRoute;
  }

  getCurrentParams(): Record<string, string> {
    return this.state.currentParams;
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

// Global router instance
let oxideRouter: OxideClientRouter;

export async function initializeOxideRouter(
  routesManifest?: RouteManifest,
): Promise<OxideClientRouter> {
  if (oxideRouter) {
    console.warn("Oxide router already initialized");
    return oxideRouter;
  }

  oxideRouter = new OxideClientRouter();
  await oxideRouter.initialize(routesManifest);
  return oxideRouter;
}

export function getOxideRouter(): OxideClientRouter | undefined {
  return oxideRouter;
}

// Make router available globally for debugging
if (typeof window !== "undefined") {
  (window as any).__OXIDE_ROUTER__ = () => oxideRouter;
}

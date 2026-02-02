import { addRoute, createRouter, findRoute } from "rou3";
import { mount, hydrate } from "svelte";
import type { Route, Layout, RouteManifest } from "./types.js";

class OxideClientRouter {
  private router = createRouter();
  private routes: Route[] = [];
  private layouts: Layout[] = [];
  private routeManifest: RouteManifest;
  private currentRoute?: Route;
  private mounted = false;

  async initialize(routesManifest?: RouteManifest) {
    try {
      // Use provided routes manifest or fallback to window global
      this.routeManifest = routesManifest || (window as any).__OXIDE_ROUTES_MANIFEST__ || {};
      this.routes = this.routeManifest?.routes || [];
      this.layouts = this.routeManifest?.layouts || [];

      // Set up router
      for (const route of this.routes) {
        addRoute(this.router, "GET", route.path, route);
      }

      // Set up navigation listeners
      this.setupNavigationListeners();

      // Mount initial component
      await this.mountInitialComponent();
    } catch (error) {
      console.error("Failed to initialize Oxide router:", error);
    }
  }

  private setupNavigationListeners() {
    // Intercept link clicks
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (
        !link ||
        !link.href ||
        link.target === "_blank" ||
        link.download ||
        link.rel === "external" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.defaultPrevented
      ) {
        return;
      }

      const url = new URL(link.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      this.navigateTo(url.pathname + url.search + url.hash);
    });

    // Handle browser back/forward
    window.addEventListener("popstate", () => {
      this.navigateTo(window.location.pathname + window.location.search + window.location.hash, {
        pushState: false,
      });
    });
  }

  async navigateTo(path: string, options: { pushState?: boolean } = { pushState: true }) {
    const match = findRoute(this.router, "GET", path);

    if (!match?.data) {
      console.warn("Route not found:", path);
      return;
    }

    const route = match.data as Route;

    try {
      // Load the route component
      const componentModule = await this.routeManifest?.importRoute?.(route.handler);
      const Component = componentModule.default;

      if (!Component) {
        throw new Error(`No default export found in ${route.handler}`);
      }

      // Get layouts for this route
      const routeLayouts = this.getLayoutsForRoute(route.handler);

      // Mount the new component with layouts
      await this.mountComponentWithLayouts(Component, routeLayouts, match.params || {});

      // Update browser history
      if (options.pushState) {
        window.history.pushState({}, "", path);
      }

      this.currentRoute = route;
    } catch (error) {
      console.error("Failed to navigate to route:", path, error);
      this.showError(error);
    }
  }

  private async mountInitialComponent() {
    const path = window.location.pathname + window.location.search + window.location.hash;
    const match = findRoute(this.router, "GET", path);

    if (!match?.data) {
      console.warn("Initial route not found:", path);
      return;
    }

    const route = match.data as Route;

    try {
      const componentModule = await this.routeManifest?.importRoute?.(route.handler);
      const Component = componentModule.default;

      if (!Component) {
        throw new Error(`No default export found in ${route.handler}`);
      }

      // Get layouts for this route
      const routeLayouts = this.getLayoutsForRoute(route.handler);
      await this.mountComponentWithLayouts(Component, routeLayouts, match.params || {});
      this.currentRoute = route;
      this.mounted = true;
    } catch (error) {
      console.error("Failed to mount initial component:", error);
      this.showError(error);
    }
  }

  private getLayoutsForRoute(routeHandler: string) {
    const routeLayouts: Layout[] = [];
    const routeDir = routeHandler.replace(/\/[^/]+\.svelte$/, "");

    for (const layout of this.layouts) {
      const layoutDir = layout.handler.replace(/\/\+layout\.svelte$/, "");

      // Check if the route is in this layout's directory or subdirectory
      if (routeDir.startsWith(layoutDir) || layoutDir === "src/routes") {
        routeLayouts.push(layout);
      }
    }

    return routeLayouts.sort((a, b) => a.level - b.level);
  }

  private async mountComponentWithLayouts(Component: any, layouts: Layout[], params: any) {
    const appElement = document.getElementById("app");
    if (!appElement) {
      throw new Error("App element not found");
    }

    try {
      let component;

      // Load layout components
      const layoutComponents = [];
      for (const layout of layouts) {
        try {
          const layoutModule = await this.routeManifest?.importRoute?.(layout.handler);
          if (layoutModule?.default) {
            layoutComponents.push(layoutModule.default);
          }
        } catch (error) {
          console.warn(`Failed to load layout: ${layout.handler}`, error);
        }
      }

      if (!this.mounted) {
        // First load - hydrate the server-rendered content
        if (layoutComponents.length > 0) {
          const LayoutRenderer = this.routeManifest.LayoutRenderer;
          component = hydrate(LayoutRenderer, {
            target: appElement,
            props: {
              routeComponent: Component,
              layoutComponents,
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

        if (layoutComponents.length > 0) {
          const LayoutRenderer = this.routeManifest.LayoutRenderer;
          component = mount(LayoutRenderer, {
            target: appElement,
            props: {
              routeComponent: Component,
              layoutComponents,
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
      console.error("Component mounting error:", error);
      throw error;
    }
  }

  private showError(error: any) {
    const appElement = document.getElementById("app");
    if (!appElement) return;

    appElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ef4444;">
        <h1>Navigation Error</h1>
        <p>Failed to load page: ${error.message}</p>
        <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  }

  // Preloading methods for future enhancement
  async preloadRoute(path: string) {
    const match = findRoute(this.router, "GET", path);
    if (!match?.data) return;

    const route = match.data as Route;
    try {
      // Preload the component
      await this.routeManifest?.importRoute?.(route.handler);

      // Preload assets if available
      try {
        await this.routeManifest?.importRouteAssets?.(route.handler);
      } catch {
        // Assets import might not exist, that's okay
      }
    } catch (error) {
      console.warn("Failed to preload route:", path, error);
    }
  }

  // Public API
  getCurrentRoute() {
    return this.currentRoute;
  }

  getRoutes() {
    return this.routes;
  }

  getLayouts() {
    return this.layouts;
  }
}

// Global router instance
let oxideRouter: OxideClientRouter;

export async function initializeOxideRouter(routesManifest?: RouteManifest) {
  if (oxideRouter) {
    console.warn("Oxide router already initialized");
    return oxideRouter;
  }

  oxideRouter = new OxideClientRouter();
  await oxideRouter.initialize(routesManifest);
  return oxideRouter;
}

export function getOxideRouter() {
  return oxideRouter;
}

// Make router available globally for debugging
if (typeof window !== "undefined") {
  (window as any).__OXIDE_ROUTER__ = () => oxideRouter;
}

import { createRouter, addRoute, findRoute } from "rou3";
import { mount, hydrate } from "svelte";
import LayoutRenderer from "./LayoutRenderer.svelte";

declare global {
  interface Window {
    __ROUTES__: Array<{ path: string; handler: string }>;
    __LAYOUTS__: Array<{ handler: string; level: number }>;
  }
}

class ClientRouter {
  private router: ReturnType<typeof createRouter>;
  private routes: Array<{ path: string; handler: string }>;
  private layouts: Array<{ handler: string; level: number }>;
  private currentComponent: any = null;

  constructor(
    routes: Array<{ path: string; handler: string }>,
    layouts: Array<{ handler: string; level: number }>,
  ) {
    this.routes = routes;
    this.layouts = layouts;
    this.router = createRouter();

    for (const route of routes) {
      addRoute(this.router, "GET", route.path, route);
    }

    this.setupEventListeners();
    this.mountInitialComponent();
    this.enhanceLinks();
  }

  private setupEventListeners(): void {
    window.addEventListener("popstate", () => {
      this.navigate(window.location.pathname);
    });
  }

  private enhanceLinks(): void {
    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach((anchor) => {
      const element = anchor as HTMLAnchorElement;
      if (element.origin === window.location.origin && !element.target && !element.download) {
        element.addEventListener("click", this.handleLinkClick.bind(this));
      }
    });
  }

  private handleLinkClick(event: MouseEvent): void {
    const anchor = event.currentTarget as HTMLAnchorElement;

    if (
      anchor.href &&
      anchor.origin === window.location.origin &&
      !anchor.target &&
      !anchor.download &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.button === 0
    ) {
      event.preventDefault();
      const pathname = new URL(anchor.href).pathname;
      history.pushState({}, "", anchor.href);
      this.navigate(pathname);
    }
  }

  private async navigate(pathname: string): Promise<void> {
    const appContainer = document.getElementById("app");
    if (!appContainer) return;

    try {
      const match = findRoute(this.router, "GET", pathname);
      if (match?.data) {
        const route = match.data as { path: string; handler: string };
        const importPath = `/src/routes/${route.handler}`;
        const module = await import(importPath);
        const Component = module.default;

        if (Component) {
          if (this.currentComponent) {
            this.currentComponent.$destroy?.();
            this.currentComponent = null;
          }

          appContainer.innerHTML = "";
          const layouts = await this.loadLayoutsForRoute(route.handler);
          this.currentComponent = mount(LayoutRenderer, {
            target: appContainer,
            props: {
              routeComponent: Component,
              layoutComponents: layouts,
              params: match.params || {},
            },
          });
          this.enhanceLinks();
        }
      }
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }

  private async loadLayoutsForRoute(routeHandler: string) {
    const routeLayouts = [];

    for (const layout of this.layouts) {
      const layoutPath = layout.handler.replace(/\\/g, "/");
      const routePath = routeHandler.replace(/\\/g, "/");

      // Check if layout applies to this route
      const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf("/") + 1);
      const routeDir = routePath.substring(0, routePath.lastIndexOf("/") + 1);

      if (routeDir.startsWith(layoutDir) || layoutDir === "") {
        const layoutModule = await import(`/src/routes/${layout.handler}`);
        routeLayouts.push(layoutModule.default);
      }
    }

    return routeLayouts;
  }

  private async mountInitialComponent(): Promise<void> {
    const appContainer = document.getElementById("app");
    if (!appContainer) return;

    const currentPath = window.location.pathname;
    const match = findRoute(this.router, "GET", currentPath);

    if (match?.data) {
      try {
        const route = match.data as { path: string; handler: string };
        const importPath = `/src/routes/${route.handler}`;
        const module = await import(importPath);
        const Component = module.default;

        if (Component) {
          const layouts = await this.loadLayoutsForRoute(route.handler);
          this.currentComponent = hydrate(LayoutRenderer, {
            target: appContainer,
            props: {
              routeComponent: Component,
              layoutComponents: layouts,
              params: match.params || {},
            },
          });
        }
      } catch (error) {
        console.error("Failed to mount initial component:", error);
      }
    }
  }
}

const routes = window.__ROUTES__ ?? [];
const layouts = window.__LAYOUTS__ ?? [];
new ClientRouter(routes, layouts);

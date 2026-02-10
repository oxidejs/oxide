import type { Route } from "./types";

interface PreloadOptions {
  rootMargin?: string;
  enableHoverPreload?: boolean;
  enableViewportPreload?: boolean;
  idleTimeout?: number;
  respectDataSaver?: boolean;
  debug?: boolean;
}

const defaultOptions: PreloadOptions = {
  rootMargin: "200px",
  enableHoverPreload: true,
  enableViewportPreload: true,
  idleTimeout: 100,
  respectDataSaver: true,
  debug: false,
};

interface NavigatorConnection {
  saveData?: boolean;
  effectiveType?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NavigatorConnection;
}

export class LinkPreloader {
  private observer: IntersectionObserver | null = null;
  private preloadedRoutes = new Set<string>();
  private routes: Route[] = [];
  private options: PreloadOptions;

  constructor(routes: Route[], options: Partial<PreloadOptions> = {}) {
    this.routes = routes;
    this.options = { ...defaultOptions, ...options };
    this.setupIntersectionObserver();
  }

  private shouldPreload(): boolean {
    if (typeof window === "undefined") return false;

    if (this.options.respectDataSaver) {
      const nav = navigator as NavigatorWithConnection;
      const connection = nav.connection;
      if (connection?.saveData || connection?.effectiveType === "slow-2g") {
        if (this.options.debug) {
          console.log("Preload skipped: Data saver enabled or slow connection");
        }
        return false;
      }
    }

    return true;
  }

  private async preloadRoute(pathname: string): Promise<void> {
    if (this.preloadedRoutes.has(pathname) || !this.shouldPreload()) {
      return;
    }

    const route = this.routes.find((r) => {
      // Simple path matching - could be enhanced with proper route matching
      if (r.path.includes(":") || r.path.includes("*")) {
        const pattern = r.path.replace(/:([^/]+)/g, "([^/]+)").replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(pathname);
      }
      return r.path === pathname;
    });

    if (!route) return;

    this.preloadedRoutes.add(pathname);

    const schedulePreload = (): void => {
      try {
        // Use dynamic import to preload the component
        import(`/src/routes/${route.handler}`)
          .then(() => {
            if (this.options.debug) {
              console.log(`✓ Preloaded: ${pathname}`);
            }
          })
          .catch(() => {});
      } catch {
        // Silently fail preload
      }
    };

    // Schedule preload during idle time
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        (
          window as Window & {
            requestIdleCallback: (callback: () => void, options?: { timeout?: number }) => number;
          }
        ).requestIdleCallback(schedulePreload, {
          timeout: this.options.idleTimeout,
        });
      } else {
        setTimeout(schedulePreload, 0);
      }
    }
  }

  private setupIntersectionObserver(): void {
    if (typeof window === "undefined" || !this.options.enableViewportPreload) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement;
            if (link.href && link.origin === window.location.origin) {
              const pathname = new URL(link.href).pathname;
              if (this.options.debug) {
                console.log(`🔍 Link in viewport: ${pathname}`);
              }
              this.preloadRoute(pathname);
            }
          }
        });
      },
      {
        rootMargin: this.options.rootMargin,
        threshold: 0,
      },
    );
  }

  observeLink(link: HTMLAnchorElement): (() => void) | undefined {
    if (!link.href || link.origin !== window.location.origin) {
      return;
    }

    // Viewport-based preloading
    if (this.observer && this.options.enableViewportPreload) {
      this.observer.observe(link);
    }

    // Intent-based preloading (hover/focus)
    if (this.options.enableHoverPreload) {
      const handleIntent = (): void => {
        const pathname = new URL(link.href).pathname;
        if (this.options.debug) {
          console.log(`👆 User intent detected: ${pathname}`);
        }
        this.preloadRoute(pathname);
      };

      const handleMouseEnter = (): void => handleIntent();
      const handleFocus = (): void => handleIntent();

      link.addEventListener("mouseenter", handleMouseEnter);
      link.addEventListener("focus", handleFocus);

      // Return cleanup function
      return (): void => {
        link.removeEventListener("mouseenter", handleMouseEnter);
        link.removeEventListener("focus", handleFocus);
        this.observer?.unobserve(link);
      };
    }

    return (): void => {
      this.observer?.unobserve(link);
    };
  }

  updateRoutes(routes: Route[]): void {
    this.routes = routes;
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.preloadedRoutes.clear();
  }
}

export type { PreloadOptions };

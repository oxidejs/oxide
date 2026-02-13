import type { H3Event } from "h3";
import { addRoute, createRouter, findRoute } from "rou3";
import { render } from "svelte/server";
import dedent from "dedent";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { Route, Layout, NavigationPayload, RouteManifest, OxideUrl } from "./types.js";
import { parseRouteParams } from "./shared-utils.js";
import { parseUrl } from "./context.js";
import {
  normalizePathWithTrailingSlash,
  shouldRedirectForTrailingSlash,
  getCanonicalUrl,
} from "./config.js";

const PAYLOAD_ROUTE_PREFIX = "/__oxide/payload";
const VITE_CLIENT_SCRIPT = '<script type="module" src="/@vite/client"></script>';
const DEFAULT_TITLE = "<title>Oxide</title>";

export class OxideHandler {
  private isDev: boolean;
  private router?: RouteManifest;

  private trailingSlash: "never" | "always" | "ignore" = "never";

  constructor(
    options: {
      routesDir?: string;
      router?: RouteManifest;
    } = {},
  ) {
    this.isDev = this.detectDevMode();
    this.router = options.router;

    if (this.router?.config?.trailingSlash) {
      this.trailingSlash = this.router.config.trailingSlash;
    }

    if (this.router?.routes) {
      const sortedRoutes = [...this.router.routes].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.path.length - b.path.length;
      });

      for (const route of sortedRoutes) {
        addRoute(this.routerInstance, "GET", route.path, route);
      }
    }
  }

  private routerInstance = createRouter();

  async handle(event: H3Event): Promise<{ matched: boolean; response: Response }> {
    const url = new URL(event?.req?.url ?? "/", "http://localhost");
    const { pathname, search, hash } = url;

    try {
      if (!this.router) {
        return this.createErrorResponse("No routes manifest provided", 500);
      }

      if (this.isNavigationRequest(event) || pathname.startsWith(PAYLOAD_ROUTE_PREFIX)) {
        return this.handleNavigationPayload(this.extractPayloadPath(pathname), url);
      }

      const redirectResponse = this.handleTrailingSlashRedirect(pathname, search, hash);
      if (redirectResponse) return redirectResponse;

      const match = this.findMatchingRoute(pathname);
      if (!match) return this.renderNotFound(pathname);

      const oxideUrl = parseUrl(pathname + search + hash);
      return this.renderRoute(match.route, match.params, oxideUrl);
    } catch (error: any) {
      return this.handleServerError(error);
    }
  }

  private handleTrailingSlashRedirect(
    pathname: string,
    search: string,
    hash: string,
  ): { matched: boolean; response: Response } | null {
    if (!shouldRedirectForTrailingSlash(pathname, this.trailingSlash)) {
      return null;
    }

    const canonicalUrl = getCanonicalUrl(pathname, search, hash, this.trailingSlash);
    return {
      matched: true,
      response: new Response(null, {
        status: 308,
        headers: { Location: canonicalUrl },
      }),
    };
  }

  private findMatchingRoute(
    pathname: string,
  ): { route: Route; params: Record<string, string | string[]> } | null {
    const normalizedPath = normalizePathWithTrailingSlash(pathname, this.trailingSlash);
    const match = findRoute(this.routerInstance, "GET", normalizedPath);

    if (match?.data) {
      return {
        route: match.data as Route,
        params: parseRouteParams((match.data as Route).path, match),
      };
    }

    const catchAllMatch = this.router?.routes?.find(
      (route) => route.path.includes("**:") && this.matchesCatchAll(route.path, normalizedPath),
    );

    if (catchAllMatch) {
      return {
        route: catchAllMatch,
        params: parseRouteParams(catchAllMatch.path, {
          params: this.extractCatchAllParams(catchAllMatch.path, normalizedPath),
        }),
      };
    }

    return null;
  }

  private async handleNavigationPayload(
    pathname: string,
    fullUrl: URL,
  ): Promise<{ matched: boolean; response: Response }> {
    try {
      const normalizedPath = normalizePathWithTrailingSlash(pathname, this.trailingSlash);
      const match = findRoute(this.routerInstance, "GET", normalizedPath);

      if (!match?.data) {
        const catchAllMatch = this.router?.routes?.find(
          (route) => route.path.includes("**:") && this.matchesCatchAll(route.path, normalizedPath),
        );

        if (catchAllMatch) {
          const params = parseRouteParams(catchAllMatch.path, {
            params: this.extractCatchAllParams(catchAllMatch.path, normalizedPath),
          });
          const oxideUrl = parseUrl(pathname + fullUrl.search + fullUrl.hash);
          const payload: NavigationPayload = {
            url: oxideUrl,
            params,
            data: await this.loadRouteData(catchAllMatch, params),
            timestamp: Date.now(),
          };

          return {
            matched: true,
            response: new Response(JSON.stringify(payload), {
              headers: { "content-type": "application/json" },
            }),
          };
        }

        return {
          matched: true,
          response: new Response(JSON.stringify({ error: "Route not found" }), {
            headers: { "content-type": "application/json" },
            status: 404,
          }),
        };
      }

      const route = match.data as Route;
      const params = parseRouteParams(route.path, match);
      const oxideUrl = parseUrl(pathname + fullUrl.search + fullUrl.hash);

      const payload: NavigationPayload = {
        url: oxideUrl,
        params,
        data: await this.loadRouteData(route, params),
        timestamp: Date.now(),
      };

      return {
        matched: true,
        response: new Response(JSON.stringify(payload), {
          headers: { "content-type": "application/json" },
        }),
      };
    } catch (error: any) {
      return {
        matched: true,
        response: new Response(JSON.stringify({ error: error.message }), {
          headers: { "content-type": "application/json" },
          status: 500,
        }),
      };
    }
  }

  private async renderRoute(
    route: Route,
    params: Record<string, string | string[]>,
    url: OxideUrl,
  ): Promise<{ matched: boolean; response: Response }> {
    try {
      const routeLayouts = this.getLayoutsForRoute(route);
      const routeData = await this.loadRouteData(route, params);

      const componentModule = await this.router?.importRoute?.(route.handler);
      const Component = componentModule?.default;

      if (!Component) {
        return this.createErrorResponse(`Component not found: ${route.handler}`, 500);
      }

      let body = "";
      let head = "";

      if (routeLayouts.length > 0) {
        const result = await this.renderWithLayouts(Component, routeLayouts, params, url);
        body = result.body;
        head = result.head;
      } else {
        const result = await this.renderComponent(Component, params, url);
        body = result.body;
        head = result.head;
      }

      const response = this.generateHtml(body, head, { params, url, data: routeData });

      return {
        matched: true,
        response: new Response(response, {
          headers: { "content-type": "text/html" },
        }),
      };
    } catch (error: any) {
      return this.handleServerError(error);
    }
  }

  private async renderNotFound(
    _pathname?: string,
  ): Promise<{ matched: boolean; response: Response }> {
    const rootError = this.router?.errors?.find((e) => e.level === 0);

    if (rootError && this.router?.importRoute) {
      try {
        const errorModule = await this.router.importRoute(rootError.handler);
        const ErrorComponent = errorModule?.default;

        if (ErrorComponent) {
          const error = new Error("Page not found");
          (error as any).status = 404;

          const result = await this.renderComponent(ErrorComponent, {}, parseUrl("/"));

          const response = this.generateHtml(result.body, result.head, {});

          return {
            matched: true,
            response: new Response(response, {
              headers: { "content-type": "text/html" },
              status: 404,
            }),
          };
        }
      } catch {
        // Fall through to default 404
      }
    }

    const body = dedent`
      <div style="padding: 2rem; text-align: center;">
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go home</a>
      </div>
    `;

    const response = this.generateHtml(body, "", {});

    return {
      matched: true,
      response: new Response(response, {
        headers: { "content-type": "text/html" },
        status: 404,
      }),
    };
  }

  private async handleServerError(error: Error): Promise<{ matched: boolean; response: Response }> {
    const rootErrors = this.router?.errors?.filter((e) => e.level === 0) || [];

    if (rootErrors.length > 0) {
      const body = `<div>Error: ${error.message}</div>`;
      const response = this.generateHtml(body, "", {});

      return {
        matched: true,
        response: new Response(response, {
          headers: { "content-type": "text/html" },
          status: 500,
        }),
      };
    }

    return this.createErrorResponse(error.message, 500);
  }

  private createErrorResponse(
    message: string,
    status: number,
  ): { matched: boolean; response: Response } {
    const isDev = this.isDev;

    const body = dedent`
      <div style="padding: 2rem; text-align: center; color: #ef4444;">
        <h1>Error ${status}</h1>
        <p>${message}</p>
        ${isDev ? `<pre style="text-align: left; background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow-x: auto;">${message}</pre>` : ""}
      </div>
    `;

    const response = this.generateHtml(body, "", {});

    return {
      matched: true,
      response: new Response(response, {
        headers: { "content-type": "text/html" },
        status,
      }),
    };
  }

  private async loadRouteData(
    route: Route,
    _params: Record<string, string | string[]>,
  ): Promise<Record<string, any>> {
    if (!route.load) {
      return {};
    }

    try {
      return {
        route: {
          path: route.path,
          handler: route.handler,
        },
      };
    } catch {
      return {};
    }
  }

  private getLayoutsForRoute(route: Route): Layout[] {
    if (!this.router?.layouts) return [];

    const routePath = route.handler;
    const routeSegments = routePath.split("/").filter(Boolean);

    return this.router.layouts
      .filter((layout) => {
        const layoutPath = layout.segment;
        const layoutSegments = layoutPath.split("/").filter(Boolean);

        if (layoutSegments.length === 0) return true;
        if (layoutSegments.length > routeSegments.length) return false;

        return layoutSegments.every((segment, index) => segment === routeSegments[index]);
      })
      .sort((a, b) => a.level - b.level);
  }

  private async renderWithLayouts(
    Component: any,
    layouts: Layout[],
    params: Record<string, string | string[]>,
    url: OxideUrl,
  ): Promise<{ body: string; head: string }> {
    const layoutComponents = [];

    for (const layout of layouts) {
      const layoutModule = await this.router?.importRoute?.(layout.handler);
      if (layoutModule?.default) {
        layoutComponents.push(layoutModule.default);
      }
    }

    // If no layouts, just render the route component directly
    if (layoutComponents.length === 0) {
      return this.renderComponent(Component, params, url);
    }

    const LayoutRenderer = this.router?.LayoutRenderer;

    if (!LayoutRenderer) {
      return this.renderComponent(Component, params, url);
    }

    // Render LayoutRenderer with routeComponent (not routeBody) to ensure
    // proper hydration structure. The route component's async work (including
    // hydratable) is captured in the head during this render.
    const result = await render(LayoutRenderer, {
      props: {
        layoutComponents,
        routeComponent: Component,
        params,
        url,
      },
    });

    return { body: result.body, head: result.head };
  }

  private async renderComponent(
    Component: any,
    params: Record<string, string | string[]>,
    url: OxideUrl,
  ): Promise<{ body: string; head: string }> {
    // With Svelte 5.39.3+ and experimental.async enabled,
    // render() returns a thenable that needs to be awaited for async components
    const result = render(Component, { props: { params, url } });

    // Svelte 5.39.0+ returns a thenable - await it to get the actual result
    // This allows async components with top-level await to resolve during SSR
    const rendered = await result;

    return {
      body: rendered.body || "",
      head: rendered.head || "",
    };
  }

  private detectDevMode(): boolean {
    return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  }

  private isNavigationRequest(event: H3Event): boolean {
    const headers = event.req?.headers || {};
    return (headers as any)["x-oxide-navigation"] === "true";
  }

  private extractPayloadPath(pathname: string): string {
    if (pathname.startsWith(PAYLOAD_ROUTE_PREFIX)) {
      return pathname.replace(PAYLOAD_ROUTE_PREFIX, "");
    }
    return pathname;
  }

  private matchesCatchAll(routePattern: string, pathname: string): boolean {
    const pattern = routePattern.replace(/\*\*:[^/]+/g, "(.*)");
    const regex = new RegExp(`^${pattern}`);
    return regex.test(pathname);
  }

  private extractCatchAllParams(routePattern: string, pathname: string): Record<string, string[]> {
    const params: Record<string, string[]> = {};
    const routeParts = routePattern.split("/");
    const pathParts = pathname.split("/");

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];

      if (!routePart) continue;

      if (routePart.startsWith("**:")) {
        const paramName = routePart.slice(3);
        const remainingSegments = pathParts.slice(i).filter(Boolean);
        params[paramName] = remainingSegments;
        break;
      } else if (routePart.startsWith(":")) {
        const paramName = routePart.slice(1);
        params[paramName] = [pathParts[i] || ""];
      }
    }

    return params;
  }

  private generateHtml(
    body: string,
    head: string,
    ssrData: { params?: Record<string, string | string[]>; url?: OxideUrl; data?: any },
  ): string {
    const viteClient = this.isDev ? VITE_CLIENT_SCRIPT : "";
    const cssImport = this.isDev ? "" : this.getCssLinks();
    const clientScript = this.isDev
      ? '<script type="module" src="/.oxide/client.ts"></script>'
      : this.getClientScript();

    const ssrDataScript = `<script>
      window.__OXIDE_SSR_DATA__ = ${JSON.stringify(ssrData.data || {})};
    </script>`;

    return dedent`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${head || DEFAULT_TITLE}
        ${viteClient}
        ${cssImport}
      </head>
      <body>
        <div id="app">${body}</div>
        ${ssrDataScript}
        ${clientScript}
      </body>
      </html>
    `;
  }

  private getClientScript(): string {
    try {
      let publicDir: string;

      if (this.isDev) {
        publicDir = path.join(process.cwd(), "public");
      } else {
        // Production: cwd is usually .output
        // Public assets are in .output/public
        const cwd = process.cwd();
        if (cwd.endsWith(".output")) {
          publicDir = path.join(cwd, "public");
        } else if (cwd.includes(".output")) {
          // If we're deeper, find .output and append public
          const outputIndex = cwd.lastIndexOf(".output");
          const outputDir = cwd.substring(0, outputIndex + 7); // 7 = ".output".length
          publicDir = path.join(outputDir, "public");
        } else {
          publicDir = path.join(cwd, ".output", "public");
        }
      }

      if (!existsSync(publicDir)) {
        if (this.isDev) {
          return '<script type="module" src="/.oxide/client.ts"></script>';
        }
        console.warn("[Oxide] Public directory not found:", publicDir);
        return '<script type="module" src="/.oxide/client.ts"></script>';
      }

      // Check manifest.json first (most reliable)
      const manifestPath = path.join(publicDir, ".vite", "manifest.json");
      if (existsSync(manifestPath)) {
        const fs = require("node:fs");
        const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        const clientEntry = manifestContent[".oxide/client.ts"];

        if (clientEntry?.file) {
          return `<script type="module" src="/${clientEntry.file}"></script>`;
        }
      }

      // Fallback: scan assets directory
      const assetsDir = path.join(publicDir, "assets");
      if (existsSync(assetsDir)) {
        const files = readdirSync(assetsDir);
        const clientFile = files.find(
          (f: string) => (f.startsWith("client") || f.includes("client")) && f.endsWith(".js"),
        );
        if (clientFile) {
          return `<script type="module" src="/assets/${clientFile}"></script>`;
        }
      }

      // Development fallback
      if (this.isDev) {
        return '<script type="module" src="/.oxide/client.ts"></script>';
      }

      console.warn("[Oxide] Could not find client script in production build");
      return '<script type="module" src="/.oxide/client.ts"></script>';
    } catch (error) {
      console.error("[Oxide] Error finding client script:", error);
      return '<script type="module" src="/.oxide/client.ts"></script>';
    }
  }

  private getCssLinks(): string {
    try {
      const cssFiles: string[] = [];

      let publicDir: string;
      if (this.isDev) {
        publicDir = path.join(process.cwd(), "public");
      } else {
        const cwd = process.cwd();
        if (cwd.endsWith(".output")) {
          publicDir = path.join(cwd, "public");
        } else if (cwd.includes(".output")) {
          const outputIndex = cwd.lastIndexOf(".output");
          const outputDir = cwd.substring(0, outputIndex + 7);
          publicDir = path.join(outputDir, "public");
        } else {
          publicDir = path.join(cwd, ".output", "public");
        }
      }

      if (!existsSync(publicDir)) {
        return "";
      }

      // Check manifest for CSS files (most reliable)
      const manifestPath = path.join(publicDir, ".vite", "manifest.json");
      if (existsSync(manifestPath)) {
        const fs = require("node:fs");
        const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        const clientEntry = manifestContent[".oxide/client.ts"];

        if (clientEntry?.css) {
          cssFiles.push(...clientEntry.css.map((f: string) => (f.startsWith("/") ? f : `/${f}`)));
        }
      }

      // Fallback: scan assets directory
      if (cssFiles.length === 0) {
        const assetsDir = path.join(publicDir, "assets");
        if (existsSync(assetsDir)) {
          const files = readdirSync(assetsDir);
          const foundCssFiles = files.filter((f: string) => f.endsWith(".css"));
          cssFiles.push(...foundCssFiles.map((f) => `/assets/${f}`));
        }
      }

      // Deduplicate CSS files
      const uniqueCssFiles = [...new Set(cssFiles)];

      return uniqueCssFiles.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");
    } catch (error) {
      console.error("[Oxide] Error finding CSS files:", error);
      return "";
    }
  }
}

export { withOxide } from "./with-oxide.js";
export type { OxideConfig } from "./config.js";
export type { RouteManifest } from "./types.js";
export {
  scanRoutesDirectory,
  generateRouteManifestArrays,
  generateImportStatements,
  filePathToUrl,
  getRoutePriority,
  normalizeRoutesDirPath,
} from "./route-utils.js";
export {
  getConfig,
  normalizePathWithTrailingSlash,
  shouldRedirectForTrailingSlash,
  getCanonicalUrl,
} from "./config.js";
export { parseUrl } from "./context.js";
export { parseRouteParams } from "./shared-utils.js";

import type { H3Event } from "nitro/h3";
import { addRoute, createRouter, findRoute } from "rou3";
import { render } from "svelte/server";
import dedent from "dedent";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { Route, Layout, ErrorBoundary, NavigationPayload, RouteManifest } from "./types.js";

const PAYLOAD_ROUTE_PREFIX = "/__oxide/payload";
const VITE_CLIENT_SCRIPT = '<script type="module" src="/@vite/client"></script>';
const DEFAULT_TITLE = "<title>Oxide</title>";

export class OxideHandler {
  private isDev: boolean;
  private routesManifest?: RouteManifest;
  private router = createRouter();

  constructor({
    routesDir,
    routesManifest,
  }: { routesDir?: string; routesManifest?: RouteManifest } = {}) {
    this.isDev = this.detectDevMode();
    this.routesManifest = routesManifest;

    if (this.routesManifest?.routes) {
      const sortedRoutes = [...this.routesManifest.routes].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.path.length - b.path.length;
      });

      for (const route of sortedRoutes) {
        addRoute(this.router, "GET", route.path, route);
      }
    }
  }

  async handle(event: H3Event): Promise<{ matched: boolean; response: Response }> {
    const url = new URL(event?.req?.url ?? "/", "http://localhost");
    const pathname = this.normalizePath(url.pathname);
    const isNavigationPayloadRequest = this.isNavigationRequest(event);

    try {
      if (!this.routesManifest) {
        return this.createErrorResponse("No routes manifest provided", 500);
      }

      if (isNavigationPayloadRequest || pathname.startsWith(PAYLOAD_ROUTE_PREFIX)) {
        const actualPath = this.extractPayloadPath(pathname);
        return this.handleNavigationPayload(actualPath);
      }

      const match = findRoute(this.router, "GET", pathname);

      if (!match?.data) {
        const catchAllMatch = this.routesManifest.routes?.find(
          (route) => route.path.includes("*") && this.matchesCatchAll(route.path, pathname),
        );

        if (catchAllMatch) {
          const params = this.extractCatchAllParams(catchAllMatch.path, pathname);
          return this.renderRoute(catchAllMatch, params);
        }

        return this.renderNotFound();
      }

      const route = match.data as Route;
      const params = match.params || {};

      return this.renderRoute(route, params);
    } catch (error: any) {
      return this.handleServerError(error);
    }
  }

  private async handleNavigationPayload(
    pathname: string,
  ): Promise<{ matched: boolean; response: Response }> {
    try {
      const normalizedPath = this.normalizePath(pathname);
      const match = findRoute(this.router, "GET", normalizedPath);

      if (!match?.data) {
        const catchAllMatch = this.routesManifest?.routes?.find(
          (route) => route.path.includes("*") && this.matchesCatchAll(route.path, normalizedPath),
        );

        if (catchAllMatch) {
          const params = this.extractCatchAllParams(catchAllMatch.path, normalizedPath);
          const payload: NavigationPayload = {
            url: normalizedPath,
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
          matched: false,
          response: new Response(JSON.stringify({ error: "Route not found" }), {
            headers: { "content-type": "application/json" },
            status: 404,
          }),
        };
      }

      const route = match.data as Route;
      const params = match.params || {};

      const payload: NavigationPayload = {
        url: normalizedPath,
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
        matched: false,
        response: new Response(JSON.stringify({ error: error.message }), {
          headers: { "content-type": "application/json" },
          status: 500,
        }),
      };
    }
  }

  private async renderRoute(
    route: Route,
    params: Record<string, string>,
  ): Promise<{ matched: boolean; response: Response }> {
    try {
      const routeLayouts = this.getLayoutsForRoute(route.handler);
      const routeErrors = this.getErrorBoundariesForRoute(route.handler);
      const routeData = await this.loadRouteData(route, params);

      const componentModule = await this.routesManifest?.importRoute?.(route.handler);
      const Component = componentModule?.default;

      if (!Component) {
        throw new Error(`No component found for ${route.handler}`);
      }

      let body: string;
      let head: string = "";

      try {
        const result = await this.renderWithLayouts(Component, routeLayouts, params, routeData);
        body = result.body;
        head = result.head;
      } catch (renderError: any) {
        body = await this.renderWithErrorBoundary(renderError, routeErrors, params);
      }

      const response = new Response(this.generateHtml(body, routeData, head), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });

      return { matched: true, response };
    } catch (error: any) {
      return this.handleServerError(error);
    }
  }

  private async renderNotFound(): Promise<{ matched: boolean; response: Response }> {
    const body = `
      <div style="padding: 2rem; text-align: center;">
        <h1>404 - Page not found</h1>
        <p>The requested page could not be found.</p>
        <a href="/">Go home</a>
      </div>
    `;

    return {
      matched: false,
      response: new Response(this.generateHtml(body), {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 404,
      }),
    };
  }

  private async handleServerError(error: Error): Promise<{ matched: boolean; response: Response }> {
    const rootErrors = this.routesManifest?.errors?.filter((e) => e.level === 0) || [];

    if (rootErrors.length > 0) {
      try {
        const body = await this.renderWithErrorBoundary(error, rootErrors, {});
        return {
          matched: false,
          response: new Response(this.generateHtml(body), {
            headers: { "content-type": "text/html; charset=utf-8" },
            status: 500,
          }),
        };
      } catch (errorRenderError) {
        // Fall through to default error response
      }
    }

    return this.createErrorResponse(error.message || "Internal Server Error", 500);
  }

  private createErrorResponse(
    message: string,
    status: number,
  ): { matched: boolean; response: Response } {
    const body = `
      <div style="padding: 2rem; text-align: center; color: #ef4444;">
        <h1>Error ${status}</h1>
        <p>${message}</p>
        <a href="/">Go home</a>
      </div>
    `;

    return {
      matched: false,
      response: new Response(this.generateHtml(body), {
        headers: { "content-type": "text/html; charset=utf-8" },
        status,
      }),
    };
  }

  private async loadRouteData(
    route: Route,
    params: Record<string, string>,
  ): Promise<Record<string, any>> {
    return {
      route: {
        path: route.path,
        handler: route.handler,
      },
      params,
    };
  }

  private getLayoutsForRoute(routeHandler: string): Layout[] {
    if (!this.routesManifest?.layouts) return [];

    const routePath = this.getRoutePath(routeHandler);
    const routeSegments = routePath.split("/").filter(Boolean);

    return this.routesManifest.layouts
      .filter((layout) => {
        const layoutPath = this.getRoutePath(layout.handler);
        const layoutSegments = layoutPath.split("/").filter(Boolean);

        if (layoutSegments.length === 0) return true;
        if (layoutSegments.length > routeSegments.length) return false;

        return layoutSegments.every((segment, index) => segment === routeSegments[index]);
      })
      .sort((a, b) => a.level - b.level);
  }

  private getErrorBoundariesForRoute(routeHandler: string): ErrorBoundary[] {
    if (!this.routesManifest?.errors) return [];

    const routePath = this.getRoutePath(routeHandler);
    const routeSegments = routePath.split("/").filter(Boolean);

    return this.routesManifest.errors
      .filter((error) => {
        const errorPath = this.getRoutePath(error.handler);
        const errorSegments = errorPath.split("/").filter(Boolean);

        if (errorSegments.length === 0) return true;
        if (errorSegments.length > routeSegments.length) return false;

        return errorSegments.every((segment, index) => segment === routeSegments[index]);
      })
      .sort((a, b) => a.level - b.level);
  }

  private getRoutePath(handler: string): string {
    const match = handler.match(/src\/routes\/(.+)\/[^/]+$/);
    return match?.[1] ?? "";
  }

  private async renderWithLayouts(
    Component: any,
    layouts: Layout[],
    params: Record<string, string>,
    data: Record<string, any>,
  ): Promise<{ body: string; head: string }> {
    const layoutComponents = [];
    for (const layout of layouts) {
      try {
        const layoutModule = await this.routesManifest?.importRoute?.(layout.handler);
        if (layoutModule?.default) {
          layoutComponents.push(layoutModule.default);
        }
      } catch (error) {
        // Skip failed layouts
      }
    }

    if (layoutComponents.length > 0) {
      const LayoutRenderer = this.routesManifest?.LayoutRenderer;

      if (!LayoutRenderer) {
        throw new Error("LayoutRenderer not found in routes manifest");
      }

      const result = render(LayoutRenderer, {
        props: {
          routeComponent: Component,
          layoutComponents,
          params,
        },
      });
      return { body: result.body, head: result.head || "" };
    } else {
      const result = render(Component, { props: { params } });
      return { body: result.body, head: result.head || "" };
    }
  }

  private async renderWithErrorBoundary(
    error: Error,
    errorBoundaries: ErrorBoundary[],
    params: Record<string, string>,
  ): Promise<string> {
    if (errorBoundaries.length === 0) {
      throw error;
    }

    const nearestError = errorBoundaries[errorBoundaries.length - 1];
    if (!nearestError) {
      throw error;
    }

    try {
      const errorModule = await this.routesManifest?.importRoute?.(nearestError.handler);
      const ErrorComponent = errorModule?.default;

      if (!ErrorComponent) {
        throw new Error(`No error component found for ${nearestError.handler}`);
      }

      const ErrorRenderer = this.routesManifest?.ErrorRenderer;

      if (ErrorRenderer) {
        const result = render(ErrorRenderer, {
          props: {
            error,
            errorComponent: ErrorComponent,
            params,
            retry: undefined,
          },
        });
        return result.body;
      } else {
        const result = render(ErrorComponent, {
          props: { error, params },
        });
        return result.body;
      }
    } catch (errorRenderError) {
      return `
        <div style="padding: 2rem; text-align: center; color: #ef4444; border: 1px solid #ef4444; border-radius: 8px; margin: 1rem; background: #fef2f2;">
          <h1 style="margin: 0 0 1rem 0; font-size: 1.5rem;">Something went wrong</h1>
          <p style="margin: 0 0 1rem 0; color: #7f1d1d;">
            ${error.message || "An unexpected error occurred"}
          </p>
          <a href="/" style="padding: 0.5rem 1rem; background: #6b7280; color: white; text-decoration: none; border-radius: 4px;">
            Go Home
          </a>
        </div>
      `;
    }
  }



  private detectDevMode(): boolean {
    return !process.cwd().includes(".output") && process.env.NODE_ENV !== "production";
  }

  private isNavigationRequest(event: H3Event): boolean {
    return (event.req.headers as any)["x-oxide-navigation"] === "true";
  }

  private extractPayloadPath(pathname: string): string {
    return pathname.startsWith(PAYLOAD_ROUTE_PREFIX)
      ? pathname.replace(PAYLOAD_ROUTE_PREFIX, "") || "/"
      : pathname;
  }

  private normalizePath(pathname: string): string {
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return pathname;
  }

  private matchesCatchAll(routePath: string, pathname: string): boolean {
    const pattern = routePath.replace(/\*\*:[^/]*/g, ".*");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(pathname);
  }

  private extractCatchAllParams(routePath: string, pathname: string): Record<string, string> {
    const params: Record<string, string> = {};
    const routeParts = routePath.split("/");
    const pathParts = pathname.split("/");

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      if (routePart?.startsWith("**:")) {
        const paramName = routePart.slice(3);
        const remainingPath = pathParts.slice(i).join("/");
        params[paramName] = remainingPath;
        break;
      } else if (routePart?.startsWith(":")) {
        const paramName = routePart.slice(1);
        params[paramName] = pathParts[i] || "";
      }
    }

    return params;
  }

  private generateHtml(body: string, ssrData?: Record<string, any>, head?: string): string {
    const viteClient = this.isDev ? VITE_CLIENT_SCRIPT : "";
    const cssImport = this.isDev ? "" : this.getCssLinks();
    const clientScript = this.isDev
      ? '<script type="module" src="/.oxide/client.ts"></script>'
      : this.getClientScript();

    const ssrDataScript = ssrData
      ? `<script>window.__OXIDE_SSR_DATA__ = ${JSON.stringify(ssrData)};</script>`
      : "";

    return dedent`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${head || DEFAULT_TITLE}
          ${viteClient}
          ${cssImport}
        </head>
        <body>
          <div id="app">${body}</div>
          <script>
            window.__OXIDE_ROUTES_MANIFEST__ = {
              routes: ${JSON.stringify(this.routesManifest?.routes || [])},
              layouts: ${JSON.stringify(this.routesManifest?.layouts || [])},
              errors: ${JSON.stringify(this.routesManifest?.errors || [])}
            };
          </script>
          ${ssrDataScript}
          ${clientScript}
        </body>
      </html>
    `;
  }

  private getClientScript(): string {
    if (this.isDev) {
      return '<script type="module" src="/.oxide/client.ts"></script>';
    }

    try {
      const manifestPath = path.join(process.cwd(), "public/.vite/manifest.json");
      if (existsSync(manifestPath)) {
        const manifestContent = require("fs").readFileSync(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent);
        const clientEntry = manifest[".oxide/client.ts"];
        if (clientEntry?.file) {
          return `<script type="module" src="/${clientEntry.file}"></script>`;
        }
      }
    } catch (error) {
      // Fallback to scanning directory
    }

    try {
      const publicDir = path.join(process.cwd(), "public/assets");
      if (existsSync(publicDir)) {
        const files = readdirSync(publicDir);
        const clientFile = files.find((file) => file.startsWith("client-") && file.endsWith(".js"));
        if (clientFile) {
          return `<script type="module" src="/assets/${clientFile}"></script>`;
        }
      }
    } catch (error) {
      // Fallback
    }

    return '<script type="module" src="/assets/client.js"></script>';
  }

  private getCssLinks(): string {
    if (this.isDev) {
      return "";
    }

    const cssFiles: string[] = [];

    try {
      const manifestPath = path.join(process.cwd(), "public/.vite/manifest.json");
      if (existsSync(manifestPath)) {
        const manifestContent = require("fs").readFileSync(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent);
        const clientEntry = manifest[".oxide/client.ts"];
        if (clientEntry?.css) {
          cssFiles.push(...clientEntry.css);
        }
      }
    } catch (error) {
      // Fallback to scanning directory
    }

    if (cssFiles.length === 0) {
      try {
        const publicDir = path.join(process.cwd(), "public/assets");
        if (existsSync(publicDir)) {
          const files = readdirSync(publicDir);
          const foundCssFiles = files.filter((file) => file.endsWith(".css"));
          cssFiles.push(...foundCssFiles.map(file => `/assets/${file}`));
        }
      } catch (error) {
        // Fallback
      }
    }

    return cssFiles
      .map((file) => {
        const href = file.startsWith('/') ? file : `/${file}`;
        return `<link rel="stylesheet" href="${href}">`;
      })
      .join("\n        ");
  }
}

export { withOxide } from "./with-oxide.js";
export type { RouteManifest } from "./types.js";

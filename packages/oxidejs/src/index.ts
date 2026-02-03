import type { H3Event } from "nitro/h3";
import { addRoute, createRouter, findRoute } from "rou3";
import { render } from "svelte/server";
import dedent from "dedent";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

export interface Route {
  path: string;
  handler: string;
}

export interface Layout {
  handler: string;
  level: number;
}

export class OxideHandler {
  private routesDir: string;
  private isDev: boolean;
  private routesManifest?: any;

  constructor({ routesDir, routesManifest }: { routesDir?: string; routesManifest?: any } = {}) {
    this.routesDir = routesDir ?? "src/routes";
    // Better dev mode detection - check if we're in .output directory
    this.isDev = !process.cwd().includes(".output") && process.env.NODE_ENV !== "production";
    this.routesManifest = routesManifest;
  }

  async handle(event: H3Event): Promise<{ matched: boolean; response: Response }> {
    const pathname = new URL(event.node?.req?.url ?? "/", "http://localhost").pathname;

    try {
      // Use provided routes manifest or fallback to empty arrays
      const routesManifest = this.routesManifest || {};
      const routes: Route[] = routesManifest?.routes || [];
      const layouts: Layout[] = routesManifest?.layouts || [];

      const router = createRouter();
      for (const route of routes) {
        addRoute(router, "GET", route.path, route);
      }

      const match = findRoute(router, "GET", pathname);
      let body = "";
      let matched = false;

      if (match?.data) {
        matched = true;
        try {
          const route = match.data as Route;
          const routeLayouts = this.getLayoutsForRoute(route.handler, layouts);

          // Use the routes manifest to get the component (same as client-side)
          const componentModule = await routesManifest?.importRoute?.(route.handler);
          const Component = componentModule?.default;

          if (Component) {
            body = await this.renderWithLayouts(
              Component,
              routeLayouts,
              routesManifest,
              match.params || {},
            );
          } else {
            throw new Error(`No component found for ${route.handler}`);
          }
        } catch (error: any) {
          console.error("SSR route loading error:", error);
          body = `
            <div style="padding: 2rem; text-align: center; color: #ef4444;">
              <h1>Component Error</h1>
              <p>Failed to load route: ${error?.message || "Unknown error"}</p>
              <a href="/">Go home</a>
            </div>
          `;
        }
      } else {
        body = `
          <div style="padding: 2rem; text-align: center;">
            <h1>404 - Page not found</h1>
            <p>The requested page could not be found.</p>
            <a href="/">Go home</a>
          </div>
        `;
      }

      const response = new Response(this.generateHtml(body, routes, layouts), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });

      return { matched, response };
    } catch (error: any) {
      console.error("Failed to handle request:", error);

      // If routes manifest is missing, provide a fallback
      if (!this.routesManifest) {
        const fallbackBody = `
          <div style="padding: 2rem; text-align: center; color: #ef4444;">
            <h1>Router Configuration Error</h1>
            <p>No routes manifest provided. Make sure Nitro is properly configured.</p>
            <a href="/">Go home</a>
          </div>
        `;
        return {
          matched: false,
          response: new Response(this.generateHtml(fallbackBody, [], []), {
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
        };
      }

      return {
        matched: false,
        response: new Response("Internal Server Error", { status: 500 }),
      };
    }
  }

  private getLayoutsForRoute(routeHandler: string, layouts: Layout[]): Layout[] {
    const routeLayouts: Layout[] = [];
    const routeDir = routeHandler.replace(/\/[^/]+\.svelte$/, "");

    for (const layout of layouts) {
      const layoutDir = layout.handler.replace(/\/\+layout\.svelte$/, "");

      // Check if the route is in this layout's directory or subdirectory
      if (routeDir.startsWith(layoutDir) || layoutDir === "src/routes") {
        routeLayouts.push(layout);
      }
    }

    return routeLayouts.sort((a, b) => a.level - b.level);
  }

  private async renderWithLayouts(
    Component: any,
    layouts: Layout[],
    routesManifest: any,
    params: any,
  ): Promise<string> {
    try {
      // Load all layout components
      const layoutComponents = [];
      for (const layout of layouts) {
        try {
          const layoutModule = await routesManifest?.importRoute?.(layout.handler);
          if (layoutModule?.default) {
            layoutComponents.push(layoutModule.default);
          }
        } catch (error) {
          console.warn(`Failed to load layout: ${layout.handler}`, error);
        }
      }

      // If we have layouts, use the LayoutRenderer to handle nesting
      if (layoutComponents.length > 0) {
        const LayoutRenderer = routesManifest.LayoutRenderer;

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
        return result.body;
      } else {
        // No layouts, render component directly
        return this.renderComponentToString(Component, params);
      }
    } catch (error: any) {
      console.error("Layout rendering error:", error);
      // Fallback to rendering just the component
      return this.renderComponentToString(Component, params);
    }
  }

  private renderComponentToString(Component: any, params: any): string {
    try {
      const result = render(Component, {
        props: { params },
      });
      return result.body;
    } catch (error: any) {
      console.error("SSR rendering error:", error);
      return `
        <div style="padding: 2rem; text-align: center; color: #ef4444;">
          <h1>SSR Error</h1>
          <p>Failed to render component: ${error?.message || "Unknown error"}</p>
        </div>
      `;
    }
  }

  private generateHtml(body: string, routes: Route[], layouts: Layout[]): string {
    const viteClient = this.isDev ? '<script type="module" src="/@vite/client"></script>' : "";
    const cssImport = this.isDev ? "" : this.getCssLinks();
    const clientScript = this.isDev
      ? '<script type="module" src="/.oxide/client.js"></script>'
      : this.getClientScript();

    return dedent`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Oxide</title>
          ${viteClient}
          ${cssImport}
        </head>
        <body>
          <div id="app">${body}</div>
          <script>
            window.__OXIDE_ROUTES__ = ${JSON.stringify(routes)};
            window.__OXIDE_LAYOUTS__ = ${JSON.stringify(layouts)};
            window.__OXIDE_ROUTES_MANIFEST__ = {
              routes: ${JSON.stringify(routes)},
              layouts: ${JSON.stringify(layouts)},
              importRoute: function(handler) {
                return import('./' + handler);
              },
              importRouteAssets: function(handler) {
                try {
                  return import('./' + handler + '?assets');
                } catch (e) {
                  return Promise.resolve({});
                }
              }
            };
          </script>
          ${clientScript}
        </body>
      </html>
    `;
  }

  private getClientScript(): string {
    if (this.isDev) {
      return '<script type="module" src="/.oxide/client.js"></script>';
    }

    // In production, find the hashed client asset (generated from .oxide/client.js)
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
      console.warn("Failed to find client asset:", error);
    }

    // Fallback
    return '<script type="module" src="/assets/client.js"></script>';
  }

  private getCssLinks(): string {
    if (this.isDev) {
      return "";
    }

    // In production, find the hashed CSS assets
    try {
      const publicDir = path.join(process.cwd(), "public/assets");
      if (existsSync(publicDir)) {
        const files = readdirSync(publicDir);
        const cssFiles = files.filter((file) => file.endsWith(".css"));
        return cssFiles
          .map((file) => `<link rel="stylesheet" href="/assets/${file}">`)
          .join("\n        ");
      }
    } catch (error) {
      console.warn("Failed to find CSS assets:", error);
    }

    return "";
  }
}

export type { RouteWithLayouts, RouteManifest } from "./types.js";
export { oxideNitroPlugin } from "./nitro-plugin.js";
export { initializeOxideRouter } from "./client.js";
export { withOxide } from "./with-oxide";

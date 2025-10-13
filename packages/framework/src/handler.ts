import { join } from "node:path";
import { render } from "svelte/server";
import type { Component } from "svelte";
import { RouteScanner } from "./scanner";
import type { PluginContext } from "./types";

export class OxideHandler {
  private routesDir: string;
  private app: Component<any>;
  private context: Map<string, any>;
  private cachedRoutes: any[] | null = null;

  constructor({
    app,
    routesDir,
    context,
  }: {
    app: Component<any>;
    routesDir?: string;
    context?: Map<string, any>;
  }) {
    this.app = app;
    this.routesDir = routesDir ?? join(process.cwd(), "src", "app");
    this.context = context ?? new Map();
  }

  async handle(
    req: Request,
  ): Promise<{ matched: boolean; response: Response }> {
    const url = new URL(req.url);
    const routes = await this.getRoutes();

    this.context.set("location", url);
    const app = render(this.app, {
      context: this.context,
    });

    const matched = this.matchRoute(url.pathname, routes);
    const response = new Response(this.generateHTML(app), {
      headers: {
        "Content-Type": "text/html",
      },
    });

    return { matched: !!matched, response };
  }

  private async getRoutes(): Promise<any[]> {
    if (this.cachedRoutes) {
      return this.cachedRoutes;
    }

    const context: PluginContext = {
      root: process.cwd(),
      options: {
        pagesDir: this.routesDir,
        extensions: [".svelte"],
        importMode: "async",
        virtualId: "virtual:oxide-routes",
      },
      cache: new Map(),
    };

    const scanner = new RouteScanner(context);

    const scanResult = await scanner.scan();
    const processedTree = await scanner.applyHooks(scanResult.tree);

    const routes = this.flattenRoutes(processedTree);
    this.cachedRoutes = routes;
    return routes;
  }

  private flattenRoutes(tree: any): any[] {
    const routes: any[] = [];

    if (tree.hasComponent) {
      routes.push(tree);
    }

    if (tree.children && tree.children.length > 0) {
      for (const child of tree.children) {
        routes.push(...this.flattenRoutes(child));
      }
    }

    return routes;
  }

  private matchRoute(pathname: string, routes: any[]): any {
    for (const route of routes) {
      const params: Record<string, string> = {};

      if (route.path === pathname) {
        return { route, params };
      }

      const segments = pathname.split("/").filter(Boolean);
      const routeSegments = route.path.split("/").filter(Boolean);

      // Handle catch-all routes (*)
      if (routeSegments.includes("*")) {
        const catchAllIndex = routeSegments.indexOf("*");

        // Check if the path segments match up to the catch-all
        let match = true;
        for (let i = 0; i < catchAllIndex; i++) {
          if (i >= segments.length || routeSegments[i] !== segments[i]) {
            if (!routeSegments[i].startsWith(":")) {
              match = false;
              break;
            } else {
              const paramName = routeSegments[i].slice(1);
              params[paramName] = decodeURIComponent(segments[i]!);
            }
          }
        }

        if (match) {
          // Get the catch-all parameter name from route.params
          const catchAllParam =
            route.params?.find(
              (p: string, index: number) => index === catchAllIndex,
            ) || "catchAll";

          // Capture remaining segments as catch-all parameter
          const remainingSegments = segments.slice(catchAllIndex);
          params[catchAllParam] = remainingSegments.join("/");

          return { route, params };
        }
        continue;
      }

      // Regular route matching
      if (segments.length !== routeSegments.length) {
        continue;
      }

      let match = true;
      for (let i = 0; i < routeSegments.length; i++) {
        const routeSegment = routeSegments[i];
        const pathSegment = segments[i];

        if (routeSegment.startsWith(":")) {
          const paramName = routeSegment.slice(1);
          if (!pathSegment) continue;
          params[paramName] = decodeURIComponent(pathSegment);
        } else if (routeSegment !== pathSegment) {
          match = false;
          break;
        }
      }

      if (match) {
        return { route, params };
      }
    }

    return null;
  }

  private generateHTML(app: { body: string; head: string }): string {
    const viteClient = import.meta.env?.DEV
      ? '<script type="module" src="/@vite/client"></script>'
      : "";

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Oxide</title>
    ${viteClient}
    ${app.head}
  </head>
  <body>
    <div id="app">${app.body}</div>
    <script type="module" src="${this.resolveEntry("src/client.ts")}"></script>
  </body>
</html>`;
  }

  private resolveEntry(entry: string): string {
    if (import.meta.env?.PROD) {
      const manifest = (globalThis as any).__VITE_MANIFEST__;
      const file = manifest?.[entry]?.file;
      if (!file) {
        throw new Error(
          manifest
            ? `Entry "${entry}" not found in Vite manifest.`
            : "Vite manifest is not available.",
        );
      }
      return `/${file}`;
    }
    return `/${entry}`;
  }
}

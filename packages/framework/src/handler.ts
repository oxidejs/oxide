import { render } from "svelte/server";
import type { Component } from "svelte";
import { RouteScanner } from "./scanner";
import type { PluginContext } from "./types";

export class OxideHandler {
  private app: Component<any>;
  private context: Map<string, any>;
  private cachedRoutes: any[] | null = null;

  constructor({
    app,
    context,
  }: {
    app: Component<any>;
    context?: Map<string, any>;
  }) {
    this.app = app;
    this.context = context ?? new Map();
  }

  async handle(
    req: Request,
  ): Promise<{ matched: boolean; response: Response }> {
    const url = new URL(req.url);

    // Skip static assets and API routes
    if (
      url.pathname.startsWith("/@") ||
      url.pathname.startsWith("/src/") ||
      url.pathname.startsWith("/virtual:") ||
      url.pathname.includes(".") ||
      url.pathname.startsWith("/api/")
    ) {
      return {
        matched: false,
        response: new Response("Not found", { status: 404 }),
      };
    }

    const routes = await this.getRoutes();
    const matched = this.findMatchingRoute(url.pathname, routes);

    this.context.set("location", url);
    if (matched) {
      this.context.set("ssrRoute", matched);
    }

    const app = render(this.app, {
      context: this.context,
    });

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
        pagesDir: "src/app",
        extensions: [".svelte"],
        importMode: "async",
        virtualId: "virtual:oxide-routes",
      },
      cache: new Map(),
    };

    const scanner = new RouteScanner(context);
    const scanResult = await scanner.scan();
    const processedTree = await scanner.applyHooks(scanResult.tree);

    const routes = processedTree.children || [];
    this.cachedRoutes = routes;
    return routes;
  }

  private findMatchingRoute(pathname: string, routes: any[]): any {
    function searchRoutes(
      routeList: any[],
      parentPath = "",
      ancestors: any[] = [],
    ): any {
      for (const route of routeList) {
        const routePath =
          parentPath === "/" ? route.path : `${parentPath}/${route.path}`;
        const fullPath = routePath.replace(/\/+/g, "/");

        if (fullPath === pathname) {
          return {
            leafRoute: route,
            layoutChain: ancestors,
            params: {},
          };
        }

        if (route.children && route.children.length > 0) {
          const childMatch = searchRoutes(route.children, fullPath, [
            ...ancestors,
            route,
          ]);
          if (childMatch) {
            return childMatch;
          }
        }
      }
      return null;
    }

    return searchRoutes(routes);
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

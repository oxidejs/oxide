import type { H3Event } from "nitro/h3";
import type { Route, Layout, RouteWithLayouts } from "./types.js";
import path from "node:path";
import { readdirSync } from "node:fs";
import { addRoute, createRouter, findRoute } from "rou3";
import { render } from "svelte/server";
import dedent from "dedent";
import LayoutRenderer from "./LayoutRenderer.svelte";

export function discoverLayouts(rootDir: string): Layout[] {
  const layouts: Layout[] = [];
  const root = path.resolve(rootDir);

  function walk(dir: string, level: number = 0) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, level + 1);
        continue;
      }

      if (entry.name === "+layout.svelte") {
        const relWithExt = path.relative(root, fullPath);
        const handler = relWithExt.split(path.sep).join("/");
        layouts.push({ handler, level });
      }
    }
  }

  walk(root);
  return layouts.sort((a, b) => a.level - b.level);
}

export function listSvelteRoutes(rootDir: string): Route[] {
  const result: Route[] = [];
  const root = path.resolve(rootDir);

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!fullPath.endsWith(".svelte")) continue;

      const relWithExt = path.relative(root, fullPath);
      const parsed = path.parse(relWithExt);
      const relNoExt = path.join(parsed.dir, parsed.name);

      let routePath = "/" + relNoExt.split(path.sep).join("/");

      if (routePath === "/index" || routePath.endsWith("/index")) {
        routePath = routePath.replace(/\/index$|^\/index$/, "") || "/";
      }

      routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");
      routePath = routePath.replace(/\[\.{3}([^\]]+)\]/g, "*$1");

      // Skip special files like +layout.svelte and +error.svelte
      if (parsed.name.startsWith("+")) {
        continue;
      }

      const handler = relWithExt.split(path.sep).join("/");
      result.push({ path: routePath, handler });
    }
  }

  walk(root);
  return result;
}

function resolveClientEntry(): string {
  // Use virtual module that Vite can handle
  return "/virtual:oxidejs-client";
}

export function getLayoutsForRoute(
  routePath: string,
  layouts: Layout[],
  rootDir: string,
): Layout[] {
  const routeLayouts: Layout[] = [];
  const root = path.resolve(rootDir);

  for (const layout of layouts) {
    const layoutDir = path.dirname(path.resolve(root, layout.handler));
    const routeDir = path.dirname(path.resolve(root, routePath));

    // Check if the route is in this layout's directory or subdirectory
    if (routeDir.startsWith(layoutDir) || layoutDir === root) {
      routeLayouts.push(layout);
    }
  }

  return routeLayouts.sort((a, b) => a.level - b.level);
}

function generateHtml(body: string, routes: Route[], layouts: Layout[]): string {
  const viteClient = (import.meta as any).env?.DEV
    ? '<script type="module" src="/@vite/client"></script>'
    : "";

  const cssImport = (import.meta as any).env?.DEV
    ? '<link rel="stylesheet" href="/src/app.css">'
    : "";

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
          window.__ROUTES__ = ${JSON.stringify(routes)};
          window.__LAYOUTS__ = ${JSON.stringify(layouts)};
        </script>
        <script type="module" src="/node_modules/oxidejs/src/client.ts"></script>
      </body>
    </html>
  `;
}

export class OxideHandler {
  private routesDir: string;

  constructor({ routesDir }: { routesDir?: string } = {}) {
    this.routesDir = routesDir ?? path.join(process.cwd(), "src/routes");
  }

  private async tryImportRoute(routeHandler: string): Promise<any> {
    const originalPath = path.resolve(this.routesDir, routeHandler);
    const module = await import(originalPath);
    return module.default;
  }

  async handle(event: H3Event): Promise<{ matched: boolean; response: Response }> {
    const pathname = new URL(event.node.req.url ?? "/", "http://localhost").pathname;

    const routes = listSvelteRoutes(this.routesDir);
    const layouts = discoverLayouts(this.routesDir);

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
        const routeLayouts = getLayoutsForRoute(route.handler, layouts, this.routesDir);

        const Component = await this.tryImportRoute(route.handler);

        if (Component) {
          body = await this.renderWithLayouts(Component, routeLayouts, match.params || {});
        } else {
          throw new Error(`No default export found in ${route.handler}`);
        }
      } catch (error) {
        console.error("SSR route loading error:", error);
        body = `
          <div style="padding: 2rem; text-align: center; color: #ef4444;">
            <h1>Component Error</h1>
            <p>Failed to render component</p>
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

    const response = new Response(generateHtml(body, routes, layouts), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    return { matched, response };
  }

  private async renderWithLayouts(
    RouteComponent: any,
    layouts: Layout[],
    params: any,
  ): Promise<string> {
    // Load layout components
    const layoutComponents = [];
    for (const layout of layouts) {
      const LayoutComponent = await this.tryImportRoute(layout.handler);
      if (LayoutComponent) {
        layoutComponents.push(LayoutComponent);
      }
    }

    // Render with LayoutRenderer
    const result = render(LayoutRenderer, {
      props: {
        routeComponent: RouteComponent,
        layoutComponents,
        params,
      },
      options: { hydratable: true },
    });
    return result.body;
  }
}

export type { Route, Layout, RouteWithLayouts } from "./types.js";

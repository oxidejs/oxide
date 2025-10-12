import { glob } from "node:fs/promises";
import { join } from "node:path";
import { render } from "svelte/server";
import type { Component } from "svelte";
import dedent from "dedent";
import { createRouter, addRoute, findRoute, type RouterContext } from "rou3";

export class OxideHandler {
  routesDir: string;
  app: Component<any>;
  context: Map<any, any> | undefined;

  constructor({
    app,
    routesDir,
    context,
  }: {
    app: Component<any>;
    routesDir?: string | undefined;
    context?: Map<any, any> | undefined;
  }) {
    this.app = app;
    this.routesDir = routesDir ?? join(process.cwd(), "src", "app");
    this.context = context;
  }

  private async buildRouter(): Promise<RouterContext<unknown>> {
    const router = createRouter();
    for await (const routeHandlerFile of glob("**/*.svelte", {
      cwd: this.routesDir,
    })) {
      const extensionlessPath = routeHandlerFile.replace(/\.svelte$/, "");
      const clearPath = extensionlessPath.endsWith("/index")
        ? extensionlessPath.replace(/\/index$/, "/")
        : extensionlessPath === "index"
          ? "/"
          : extensionlessPath;
      addRoute(router, "GET", clearPath, { handlerFile: routeHandlerFile });
    }
    return router;
  }

  async handle(
    req: Request,
  ): Promise<{ matched: boolean; response: Response }> {
    const url = new URL(req.url);
    const router = await this.buildRouter();
    const app = render(this.app, {
      props: { router, url },
      context: this.context,
    });
    const matched = !!findRoute(router, "GET", url.pathname);
    const response = new Response(indexHTML(app), {
      headers: {
        "Content-Type": "text/html",
      },
    });
    return { matched, response };
  }
}

function indexHTML(app: { body: string; head: string }) {
  return dedent`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Oxide</title>
        ${
          import.meta.env?.DEV
            ? '<script type="module" src="/@vite/client"></script>'
            : ""
        }
        ${app.head}
      </head>
      <body>
        <div id="app">${app.body}</div>
        <script type="module" src="${resolveEntry("src/client.ts")}"></script>
      </body>
    </html>
  `;
}

function resolveEntry(entry: string): string {
  if (import.meta.env?.PROD) {
    const manifest = globalThis.__VITE_MANIFEST__;
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

import { resolve } from "node:path";
import { glob } from "node:fs/promises";

interface BuildRoutesOptions {
  dir: string;
  root: string;
}

export async function buildRoutes({
  dir,
  root,
}: BuildRoutesOptions): Promise<Record<string, string>> {
  const routes: Record<string, string> = {};
  const routesDir = resolve(root, dir);

  for await (const file of glob("**/*.svelte", { cwd: routesDir })) {
    const path = file.replace(/\.svelte$/, "");
    const route = path.endsWith("/index")
      ? path.replace(/\/index$/, "/")
      : path === "index"
        ? "/"
        : `/${path}`;

    routes[route] = file;
  }

  return routes;
}

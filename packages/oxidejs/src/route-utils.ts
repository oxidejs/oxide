import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
export { parseRouteParams } from "./shared-utils.js";

export interface ScannedRoutes {
  routes: string[];
  layouts: string[];
  errors: string[];
}

export function scanRoutesDirectory(routesDirPath: string): ScannedRoutes {
  if (!existsSync(routesDirPath)) {
    return { routes: [], layouts: [], errors: [] };
  }

  const scanRecursive = (dir: string, basePath = ""): ScannedRoutes => {
    const result: ScannedRoutes = { routes: [], layouts: [], errors: [] };
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      const relativePath = relative(routesDirPath, fullPath);

      if (stat.isDirectory() && !entry.startsWith("(")) {
        const nested = scanRecursive(fullPath, join(basePath, entry));
        result.routes.push(...nested.routes);
        result.layouts.push(...nested.layouts);
        result.errors.push(...nested.errors);
      } else if (stat.isDirectory() && entry.startsWith("(")) {
        const nested = scanRecursive(fullPath, basePath);
        result.routes.push(...nested.routes);
        result.layouts.push(...nested.layouts);
        result.errors.push(...nested.errors);
      } else if (entry.endsWith(".svelte")) {
        if (entry === "+layout.svelte") {
          result.layouts.push(relativePath);
        } else if (entry === "+error.svelte") {
          result.errors.push(relativePath);
        } else {
          result.routes.push(relativePath);
        }
      }
    }

    return result;
  };

  return scanRecursive(routesDirPath);
}

export function filePathToUrl(filePath: string): string {
  let url = filePath.replace(/\\/g, "/").replace(/\.svelte$/, "");
  url = url.replace(/\/index$/, "");
  if (url === "index") {
    url = "";
  }
  url = url.replace(/\[\.\.\.(\w+)\]/g, "**:$1");
  url = url.replace(/\[(\w+)\]/g, ":$1");
  return "/" + url;
}

export function getRoutePriority(path: string): number {
  if (path.includes("**:")) return 1;
  if (path.includes(":")) return 50;
  return 100;
}

export function normalizeRoutesDirPath(routesDir: string): string {
  return routesDir.replace(/^\.\//, "");
}

export interface RouteManifestArrays {
  routesArray: string;
  layoutsArray: string;
  errorsArray: string;
  routeComponentsMap: string;
  layoutComponentsMap: string;
  errorComponentsMap: string;
}

export function generateRouteManifestArrays(
  routes: string[],
  layouts: string[],
  errors: string[],
  routesDir: string,
): RouteManifestArrays {
  const normalizedRoutesDir = normalizeRoutesDirPath(routesDir);

  const routesArray = routes
    .map((route) => {
      const url = filePathToUrl(route);
      const handler = `${normalizedRoutesDir}/${route.replace(/\\/g, "/")}`;
      const priority = getRoutePriority(url);
      return `  { "path": "${url}", "handler": "${handler}", "priority": ${priority} }`;
    })
    .join(",\n");

  const layoutsArray = layouts
    .map((layout) => {
      const segments = layout.replace(/\\/g, "/").split("/");
      const level = segments.length - 1;
      const segment = segments.slice(0, -1).join("/");
      const handler = `${normalizedRoutesDir}/${layout.replace(/\\/g, "/")}`;
      return `  { "handler": "${handler}", "level": ${level}, "segment": "${segment}" }`;
    })
    .join(",\n");

  const errorsArray = errors
    .map((error) => {
      const segments = error.replace(/\\/g, "/").split("/");
      const level = segments.length - 1;
      const segment = segments.slice(0, -1).join("/");
      const handler = `${normalizedRoutesDir}/${error.replace(/\\/g, "/")}`;
      return `  { "handler": "${handler}", "level": ${level}, "segment": "${segment}" }`;
    })
    .join(",\n");

  const routeComponentsMap = routes
    .map((route, idx) => {
      const handler = `${normalizedRoutesDir}/${route.replace(/\\/g, "/")}`;
      return `  "${handler}": Route${idx}`;
    })
    .join(",\n");

  const layoutComponentsMap = layouts
    .map((layout, idx) => {
      const handler = `${normalizedRoutesDir}/${layout.replace(/\\/g, "/")}`;
      return `  "${handler}": Layout${idx}`;
    })
    .join(",\n");

  const errorComponentsMap = errors
    .map((error, idx) => {
      const handler = `${normalizedRoutesDir}/${error.replace(/\\/g, "/")}`;
      return `  "${handler}": Error${idx}`;
    })
    .join(",\n");

  return {
    routesArray,
    layoutsArray,
    errorsArray,
    routeComponentsMap,
    layoutComponentsMap,
    errorComponentsMap,
  };
}

export function generateImportStatements(
  routes: string[],
  layouts: string[],
  errors: string[],
  routesDir: string,
  importPrefix: string,
): { routeImports: string; layoutImports: string; errorImports: string } {
  const routeImports = routes
    .map(
      (route, idx) =>
        `import Route${idx} from "${importPrefix}${routesDir}/${route.replace(/\\/g, "/")}";`,
    )
    .join("\n");

  const layoutImports = layouts
    .map(
      (layout, idx) =>
        `import Layout${idx} from "${importPrefix}${routesDir}/${layout.replace(/\\/g, "/")}";`,
    )
    .join("\n");

  const errorImports = errors
    .map(
      (error, idx) =>
        `import Error${idx} from "${importPrefix}${routesDir}/${error.replace(/\\/g, "/")}";`,
    )
    .join("\n");

  return { routeImports, layoutImports, errorImports };
}

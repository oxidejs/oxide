import type { RouteNode, PluginContext, GeneratedCode } from "./types";

export class RouteGenerator {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  generate(tree: RouteNode): GeneratedCode {
    const routes = this.flattenRoutes(tree);
    const moduleCode = this.generateModule(routes);
    const typeDefinitions = this.generateTypes(routes);

    return {
      moduleCode,
      typeDefinitions,
    };
  }

  private generateModule(routes: RouteNode[]): string {
    const { importMode } = this.context.options;

    const imports =
      importMode === "sync" ? this.generateSyncImports(routes) : "";

    const routeEntries: string[] = [];

    routes.forEach((route, index) => {
      if (!route.hasComponent) return;

      const component =
        importMode === "sync"
          ? `Component_${index}`
          : `() => import("${route.componentImport}")`;

      const parts = [
        `name: "${route.name}"`,
        `path: "${route.path}"`,
        `component: ${component}`,
      ];

      if (route.params.length > 0) {
        parts.push(`params: ${JSON.stringify(route.params)}`);
      }

      if (Object.keys(route.meta).length > 0) {
        parts.push(`meta: ${JSON.stringify(route.meta)}`);
      }

      if (route.alias && route.alias.length > 0) {
        parts.push(`alias: ${JSON.stringify(route.alias)}`);
      }

      routeEntries.push(`  {\n    ${parts.join(",\n    ")}\n  }`);
    });

    const routesArray = `export const routes = [\n${routeEntries.join(",\n")}\n];`;
    const helpers = this.generateHelperFunctions();

    return `${imports}${routesArray}\n\nexport default routes;\n\n${helpers}`;
  }

  private generateSyncImports(routes: RouteNode[]): string {
    const imports: string[] = [];

    routes.forEach((route, index) => {
      if (route.hasComponent) {
        imports.push(
          `import Component_${index} from "${route.componentImport}";`,
        );
      }
    });

    return imports.length > 0 ? imports.join("\n") + "\n\n" : "";
  }

  private generateHelperFunctions(): string {
    return `export function findRouteByName(name) {
  return routes.find(route => route.name === name);
}

export function generatePath(name, params = {}) {
  const route = findRouteByName(name);
  if (!route) throw new Error(\`Route "\${name}" not found\`);

  let path = route.path;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(\`:\${key}\`, String(value));
  }

  return path;
}

export function getRouteParams(path) {
  for (const route of routes) {
    const params = {};

    if (route.path === path) {
      return { route, params };
    }

    const segments = path.split('/').filter(Boolean);
    const routeSegments = route.path.split('/').filter(Boolean);

    // Handle catch-all routes (*)
    if (routeSegments.includes('*')) {
      const catchAllIndex = routeSegments.indexOf('*');

      // Check if the path segments match up to the catch-all
      let match = true;
      for (let i = 0; i < catchAllIndex; i++) {
        if (i >= segments.length || routeSegments[i] !== segments[i]) {
          if (!routeSegments[i].startsWith(':')) {
            match = false;
            break;
          } else {
            const paramName = routeSegments[i].slice(1);
            params[paramName] = decodeURIComponent(segments[i]);
          }
        }
      }

      if (match) {
        // Get the catch-all parameter name from route.params
        const catchAllParam = route.params?.find(p =>
          route.params.indexOf(p) === catchAllIndex
        ) || 'catchAll';

        // Capture remaining segments as catch-all parameter
        const remainingSegments = segments.slice(catchAllIndex);
        params[catchAllParam] = remainingSegments.join('/');

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

      if (routeSegment.startsWith(':')) {
        const paramName = routeSegment.slice(1);
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

  return { route: null, params: {} };
}`;
  }

  private generateTypes(routes: RouteNode[]): string {
    const routeNames =
      routes
        .filter((r) => r.hasComponent)
        .map((r) => `"${r.name}"`)
        .join(" | ") || "never";

    return `export interface RouteRecord {
  name: string;
  path: string;
  component: any;
  params?: string[];
  meta?: Record<string, any>;
  alias?: string[];
}

export type RouteNames = ${routeNames};

declare module "virtual:oxide-routes" {
  export const routes: RouteRecord[];
  export default routes;
  export function findRouteByName(name: RouteNames): RouteRecord | undefined;
  export function generatePath(name: RouteNames, params?: Record<string, any>): string;
  export function getRouteParams(path: string): { route: RouteRecord | null; params: Record<string, string> };
}`;
  }

  private getValidIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_$]/g, "_");
  }

  private flattenRoutes(tree: RouteNode): RouteNode[] {
    const routes: RouteNode[] = [];

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
}

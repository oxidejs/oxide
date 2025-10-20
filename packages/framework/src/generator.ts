import type { RouteNode, PluginContext, GeneratedCode } from "./types";

export class RouteGenerator {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  generate(tree: RouteNode): GeneratedCode {
    const routes = this.buildNestedRoutes(tree);
    const moduleCode = this.generateModule(routes);
    const typeDefinitions = this.generateTypes(routes);

    return {
      moduleCode,
      typeDefinitions,
    };
  }

  private generateModule(routes: RouteNode[]): string {
    const { importMode = "async" } = this.context.options;

    const flatRoutes = this.flattenRoutesForImports(routes);
    const imports =
      importMode === "sync" ? this.generateSyncImports(flatRoutes) : "";

    const routeEntries = this.generateRouteEntries(routes, importMode);

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

  private generateRouteEntries(
    routes: RouteNode[],
    importMode: string,
  ): string[] {
    const entries: string[] = [];
    const flatRoutes = this.flattenRoutesForImports(routes);

    const processRoute = (route: RouteNode): string => {
      if (!route.hasComponent) return "";

      const routeIndex = flatRoutes.findIndex(
        (r) => r.componentImport === route.componentImport,
      );
      const component =
        importMode === "sync"
          ? `Component_${routeIndex}`
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

      if (route.children && route.children.length > 0) {
        const childEntries = route.children
          .filter((child) => child.hasComponent)
          .map((child) => processRoute(child));

        if (childEntries.length > 0) {
          parts.push(
            `children: [\n      ${childEntries.join(",\n      ")}\n    ]`,
          );
        }
      }

      return `{\n      ${parts.join(",\n      ")}\n    }`;
    };

    routes.forEach((route) => {
      if (route.hasComponent) {
        entries.push(`  ${processRoute(route)}`);
      }
    });

    return entries;
  }

  private generateHelperFunctions(): string {
    return `function flattenRoutes(routes) {
  const flattened = [];

  function flatten(route) {
    flattened.push(route);
    if (route.children && route.children.length > 0) {
      route.children.forEach(child => {
        // Create full path by combining parent and child paths
        const fullPath = route.path === '/' ? '/' + child.path : route.path + '/' + child.path;
        flatten({ ...child, path: fullPath });
      });
    }
  }

  routes.forEach(flatten);
  return flattened;
}

export function findRouteByName(name) {
  const allRoutes = flattenRoutes(routes);
  return allRoutes.find(route => route.name === name);
}

export function generatePath(name, params = {}) {
  const route = findRouteByName(name);
  if (!route) throw new Error('Route "' + name + '" not found');

  let path = route.path;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(':' + key, String(value));
  }

  return path;
}

export function getRouteParams(path) {
  const allRoutes = flattenRoutes(routes);

  for (const route of allRoutes) {
    const params = {};

    if (route.path === path) {
      return { route, params };
    }

    const segments = path.split('/').filter(Boolean);
    const routeSegments = route.path.split('/').filter(Boolean);

    // Handle catch-all routes (*)
    if (routeSegments.includes('*')) {
      const catchAllIndex = routeSegments.indexOf('*');

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
        const catchAllParam = route.params?.find(p =>
          route.params.indexOf(p) === catchAllIndex
        ) || 'catchAll';

        const remainingSegments = segments.slice(catchAllIndex);
        params[catchAllParam] = remainingSegments.join('/');

        return { route, params };
      }
      continue;
    }

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
    const flatRoutes = this.flattenRoutesForImports(routes);
    const routeNames =
      flatRoutes
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
  children?: RouteRecord[];
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

  private buildNestedRoutes(tree: RouteNode): RouteNode[] {
    return tree.children || [];
  }

  private flattenRoutesForImports(routes: RouteNode[]): RouteNode[] {
    const flattened: RouteNode[] = [];

    const flatten = (route: RouteNode) => {
      if (route.hasComponent) {
        flattened.push(route);
      }
      if (route.children && route.children.length > 0) {
        route.children.forEach(flatten);
      }
    };

    routes.forEach(flatten);
    return flattened;
  }
}

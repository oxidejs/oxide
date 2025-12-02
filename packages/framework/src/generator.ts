import type { RouteNode, PluginContext, GeneratedCode } from "./types";

export class RouteGenerator {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  generate(tree: RouteNode): GeneratedCode {
    const routes = this.buildNestedRoutes(tree);
    const moduleCode = this.generateModule(routes, tree);
    const typeDefinitions = this.generateTypes(routes, tree);

    return {
      moduleCode,
      typeDefinitions,
    };
  }

  private generateModule(routes: RouteNode[], tree: RouteNode): string {
    const { importMode = "async" } = this.context.options;

    const flatRoutes = this.flattenRoutesForImports(routes);
    const imports =
      importMode === "sync" ? this.generateSyncImports(flatRoutes) : "";

    const routeEntries = this.generateRouteEntries(routes, importMode);
    const routesArray = `export const routes = [\n${routeEntries.join(",\n")}\n];`;

    const helpers = this.generateHelperFunctions();
    const virtualModuleExports = this.generateVirtualModuleExports();

    return `${imports}${routesArray}\n\nexport default routes;\n\n${helpers}\n\n${virtualModuleExports}`;
  }

  private generateVirtualModuleExports(): string {
    return `// Virtual module exports
import { getContext, setContext } from 'svelte';

// Declare window for SSR compatibility
const window = typeof globalThis !== 'undefined' && 'window' in globalThis ? globalThis.window : undefined;

const ROUTER_CONTEXT_KEY = Symbol('router');

export function useRouter() {
  const context = getContext(ROUTER_CONTEXT_KEY);

  if (!context) {
    throw new Error('useRouter() can only be called within a Router component');
  }

  return {
    push(path) {
      context.navigate(path);
    },
    replace(path) {
      context.navigate(path, { replace: true });
    },
    back() {
      if (window && window.history) {
        window.history.back();
      }
    },
    forward() {
      if (window && window.history) {
        window.history.forward();
      }
    }
  };
}

export function useRoute() {
  const context = getContext(ROUTER_CONTEXT_KEY);

  if (!context) {
    throw new Error('useRoute() can only be called within a Router component');
  }

  const location = context.location();
  const params = context.params();
  const query = new URLSearchParams(location.search);

  return {
    location,
    params,
    query
  };
}

export function href(strings, ...values) {
  let result = strings[0] ?? '';

  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    if (value instanceof URLSearchParams) {
      result += value.toString();
    } else if (Array.isArray(value)) {
      result += value.join('/');
    } else {
      result += encodeURIComponent(String(value));
    }

    result += strings[i + 1] ?? '';
  }

  return result;
}

export function setRouterContext(context) {
  setContext(ROUTER_CONTEXT_KEY, context);
}`;
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

    const processRoute = (route: RouteNode, depth = 0): string => {
      const childEntries = (route.children || [])
        .filter((child) => child.hasComponent)
        .map((child) => processRoute(child, depth + 1));

      if (!route.hasComponent && childEntries.length === 0) {
        return "";
      }

      const routeIndex = flatRoutes.findIndex(
        (r) => r.componentImport === route.componentImport,
      );
      const component =
        importMode === "sync"
          ? `Component_${routeIndex}`
          : `() => import("${route.componentImport}")`;

      const indent = "  ".repeat(depth + 1);
      const parts = [
        `${indent}name: "${route.name}"`,
        `${indent}path: "${route.path}"`,
        `${indent}component: ${component}`,
        `${indent}hasComponent: ${route.hasComponent}`,
      ];

      if (route.params.length > 0) {
        parts.push(`${indent}params: ${JSON.stringify(route.params)}`);
      }

      if (Object.keys(route.meta).length > 0) {
        parts.push(`${indent}meta: ${JSON.stringify(route.meta)}`);
      }

      if (route.alias && route.alias.length > 0) {
        parts.push(`${indent}alias: ${JSON.stringify(route.alias)}`);
      }

      if (route.children && route.children.length > 0) {
        const childEntries = route.children
          .filter((child) => child.hasComponent)
          .map((child) => processRoute(child, depth + 1));

        if (childEntries.length > 0) {
          parts.push(
            `${indent}children: [\n${childEntries.join(",\n")}\n${"  ".repeat(depth)}]`,
          );
        }
      }

      return `{\n${parts.join(",\n")}\n${"  ".repeat(depth)}}`;
    };

    routes.forEach((route) => {
      const entry = processRoute(route);
      if (entry) {
        entries.push(`  ${entry}`);
      }
    });

    return entries;
  }

  private flattenRoutesForImports(routes: RouteNode[]): RouteNode[] {
    const flattened: RouteNode[] = [];

    const flatten = (route: RouteNode) => {
      if (route.hasComponent) {
        flattened.push(route);
      }
      if (route.children) {
        route.children.forEach((child) => flatten(child));
      }
    };

    routes.forEach((route) => flatten(route));
    return flattened;
  }

  private generateHelperFunctions(): string {
    return `// Route utilities
function flattenRoutes(routes) {
  const flattened = [];

  function flatten(route, parentPath = '') {
    const fullPath = parentPath === '/'
      ? route.path
      : parentPath && route.path !== '/'
        ? parentPath + route.path
        : route.path || parentPath;

    const flatRoute = { ...route, fullPath };
    flattened.push(flatRoute);

    if (route.children && route.children.length > 0) {
      route.children.forEach(child => {
        flatten(child, fullPath === '/' ? '' : fullPath);
      });
    }
  }

  routes.forEach(route => flatten(route));
  return flattened;
}

export function findRouteByName(name) {
  const allRoutes = flattenRoutes(routes);
  return allRoutes.find(route => route.name === name);
}

export function generatePath(name, params = {}) {
  const route = findRouteByName(name);
  if (!route) {
    throw new Error("Route \\"" + name + "\\" not found");
  }

  let path = route.fullPath || route.path;

  // Replace parameters
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      // Handle catch-all parameters
      path = path.replace('*', value.join('/'));
    } else {
      // Handle regular parameters
      path = path.replace(":" + key, encodeURIComponent(String(value)));
    }
  }

  // Remove any remaining optional parameters
  path = path.replace(/\\/:[^/]+\\?/g, '');

  return path || '/';
}

export function getRouteParams(pathname, route) {
  const params = {};
  const pathSegments = pathname.split('/').filter(Boolean);
  const routeSegments = (route.fullPath || route.path).split('/').filter(Boolean);

  for (let i = 0; i < routeSegments.length; i++) {
    const segment = routeSegments[i];
    if (segment.startsWith(':')) {
      const paramName = segment.slice(1);
      params[paramName] = pathSegments[i] ? decodeURIComponent(pathSegments[i]) : '';
    }
  }

  return params;
}

export function matchRoute(pathname) {
  const allRoutes = flattenRoutes(routes);

  // Sort by priority: static first, then dynamic, then catch-all
  const sortedRoutes = allRoutes.sort((a, b) => {
    const aPriority = getRoutePriority(a.fullPath || a.path);
    const bPriority = getRoutePriority(b.fullPath || b.path);
    return aPriority - bPriority;
  });

  for (const route of sortedRoutes) {
    const result = matchSingleRoute(pathname, route);
    if (result.matches) {
      return { route, params: result.params, query: new URLSearchParams() };
    }
  }

  return { route: null, params: {}, query: new URLSearchParams() };
}

function getRoutePriority(path) {
  const segments = path.split('/').filter(Boolean);

  for (const segment of segments) {
    if (segment === '*') return 3; // Catch-all
    if (segment.startsWith(':')) return 2; // Dynamic
  }

  return 1; // Static
}

function matchSingleRoute(pathname, route) {
  const routePath = route.fullPath || route.path;
  const params = {};

  if (routePath === pathname) {
    return { matches: true, params };
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  const routeSegments = routePath.split('/').filter(Boolean);

  // Handle catch-all routes
  if (routeSegments.includes('*')) {
    const catchAllIndex = routeSegments.findIndex(seg => seg === '*');

    // Check if all segments before catch-all match
    let matches = true;
    for (let i = 0; i < catchAllIndex; i++) {
      if (i >= pathSegments.length) {
        matches = false;
        break;
      }

      const routeSegment = routeSegments[i];
      const pathSegment = pathSegments[i];

      if (routeSegment.startsWith(':')) {
        const paramName = routeSegment.slice(1);
        params[paramName] = decodeURIComponent(pathSegment);
      } else if (routeSegment !== pathSegment) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // Capture remaining segments for catch-all
      const catchAllParam = route.params?.find(p =>
        route.params.indexOf(p) === route.params.length - 1
      ) || 'catchAll';

      const remainingSegments = pathSegments.slice(catchAllIndex);
      params[catchAllParam] = remainingSegments.join('/');

      return { matches: true, params };
    }

    return { matches: false, params: {} };
  }

  // Handle regular dynamic routes
  if (pathSegments.length !== routeSegments.length) {
    return { matches: false, params: {} };
  }

  let matches = true;
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];

    if (routeSegment.startsWith(':')) {
      const paramName = routeSegment.slice(1);
      params[paramName] = decodeURIComponent(pathSegment);
    } else if (routeSegment !== pathSegment) {
      matches = false;
      break;
    }
  }

  return { matches, params };
}`;
  }

  private buildNestedRoutes(tree: RouteNode): RouteNode[] {
    if (!tree.children) {
      return [];
    }

    return tree.children.filter((route) => route.hasComponent);
  }

  private generateTypes(routes: RouteNode[], tree: RouteNode): string {
    const routeNames = this.generateRouteNames(routes);
    const routeParamTypes = this.generateRouteParamTypes(routes);

    return `declare module "$oxide" {
  import type { Router, Route } from './virtual';

  export interface RouteRecord {
    name: string;
    path: string;
    fullPath?: string;
    component: any;
    params?: string[];
    meta?: Record<string, any>;
    alias?: string[];
    children?: RouteRecord[];
  }

  export const routes: RouteRecord[];

  export function useRouter(): Router;
  export function useRoute(): Route;
  export function href(strings: TemplateStringsArray, ...values: any[]): string;

  export function findRouteByName(name: string): RouteRecord | undefined;
  export function generatePath(name: string, params?: Record<string, any>): string;
  export function matchRoute(pathname: string): { route: RouteRecord | null; params: Record<string, any>; query: URLSearchParams };

  ${routeNames}
  ${routeParamTypes}
}`;
  }

  private generateRouteNames(routes: RouteNode[]): string {
    const allRoutes = this.flattenRoutesForImports(routes);
    const names = allRoutes.map((route) => `"${route.name}"`);

    return names.length > 0
      ? `export type RouteNames = ${names.join(" | ")};`
      : `export type RouteNames = never;`;
  }

  private generateRouteParamTypes(routes: RouteNode[]): string {
    const allRoutes = this.flattenRoutesForImports(routes);
    const paramInterfaces: string[] = [];

    allRoutes.forEach((route) => {
      if (route.params.length > 0) {
        const params = route.params
          .map((param) => {
            const paramName = param.replace(/[[\]\.]/g, "");
            return `  ${paramName}: string;`;
          })
          .join("\n");

        paramInterfaces.push(`  "${route.name}": {\n${params}\n  };`);
      } else {
        paramInterfaces.push(`  "${route.name}": Record<string, never>;`);
      }
    });

    const interfaceBody =
      paramInterfaces.length > 0
        ? `{\n${paramInterfaces.join("\n")}\n}`
        : "Record<string, Record<string, never>>";

    return `export interface RouteParams ${interfaceBody}`;
  }
}

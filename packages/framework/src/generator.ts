import { RouteNode } from "./scanner.js";
import { PluginContext } from "./types.js";

export interface GeneratedOutput {
  moduleCode: string;
  typeDefinitions: string;
}

export class RouteGenerator {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  generate(routes: RouteNode[]): GeneratedOutput {
    const moduleCode = this.generateModule(routes);
    const typeDefinitions = this.generateTypes(routes);

    return {
      moduleCode,
      typeDefinitions,
    };
  }

  private generateModule(routes: RouteNode[]): string {
    const imports = this.generateSyncImports(routes);
    const routeEntries = this.generateRouteEntries(routes, "async");
    const helperFunctions = this.generateHelperFunctions();

    return `${imports}${helperFunctions}

// Routes
export const routes = [
${routeEntries.join(",\n")}
];

export default routes;`;
  }

  private generateHelperFunctions(): string {
    return `// Router utility functions
import { getContext, setContext } from 'svelte';

// Declare window for SSR compatibility
const window = typeof globalThis !== 'undefined' && 'window' in globalThis ? globalThis.window : undefined;

// Single shared Symbol instance
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

  private generateTypes(routes: RouteNode[]): string {
    const routeNames = this.extractRouteNames(routes);
    const paramTypes = this.generateParamTypes(routes);

    return `// Auto-generated route types
export type RouteNames = ${routeNames.length > 0 ? routeNames.map((name) => `"${name}"`).join(" | ") : "never"};

${paramTypes}

// Router utility types
export interface Location {
  pathname: string;
  search: string;
  hash: string;
}

export interface RouteParams {
  [key: string]: string;
}

export interface Router {
  push(path: string): void;
  replace(path: string): void;
  back(): void;
  forward(): void;
}

export interface Route {
  location: Location;
  params: RouteParams;
  query: URLSearchParams;
}

export interface RouterContext {
  navigate: (path: string, options?: { replace?: boolean }) => void;
  location: () => Location;
  params: () => RouteParams;
}`;
  }

  private extractRouteNames(routes: RouteNode[]): string[] {
    const names: string[] = [];

    const extractFromRoute = (route: RouteNode) => {
      if (route.name) {
        names.push(route.name);
      }
      if (route.children) {
        route.children.forEach(extractFromRoute);
      }
    };

    routes.forEach(extractFromRoute);
    return names;
  }

  private generateParamTypes(routes: RouteNode[]): string {
    const paramTypes: string[] = [];

    const extractParamsFromRoute = (route: RouteNode) => {
      if (route.params && route.params.length > 0 && route.name) {
        const paramType = route.params
          .map((param) => `${param}: string`)
          .join("; ");
        paramTypes.push(
          `export interface ${route.name}Params { ${paramType} }`,
        );
      }
      if (route.children) {
        route.children.forEach(extractParamsFromRoute);
      }
    };

    routes.forEach(extractParamsFromRoute);
    return paramTypes.join("\n");
  }
}

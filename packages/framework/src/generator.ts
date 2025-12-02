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
    const importMode = this.context.options.importMode || "async";
    const imports =
      importMode === "sync" ? this.generateSyncImports(routes) : "";
    const routeEntries = this.generateRouteEntries(routes, importMode);
    const helperFunctions = this.generateHelperFunctions();
    const utilityFunctions = this.generateUtilityFunctions();

    return `${imports}${helperFunctions}${utilityFunctions}

// Routes
export const routes = [
${routeEntries.join(",\n")}
];

export default routes;`;
  }

  private generateHelperFunctions(): string {
    return `// Router utility functions re-exported from shared module
export { useRouter, useRoute, href, setRouterContext } from './shared/router-utils.js';

`;
  }

  private generateUtilityFunctions(): string {
    return `// Helper functions
function flattenRoutes(routes) {
  const flattened = [];

  function flatten(route) {
    flattened.push(route);
    if (route.children) {
      route.children.forEach(flatten);
    }
  }

  routes.forEach(flatten);
  return flattened;
}

export function findRouteByName(name) {
  const flattened = flattenRoutes(routes);
  return flattened.find(route => route.name === name);
}

export function generatePath(name, params = {}) {
  const route = findRouteByName(name);
  if (!route) return null;

  let path = route.path;
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(new RegExp(\`:\${key}\`, 'g'), encodeURIComponent(String(value)));
  });

  return path;
}

export function matchRoute(pathname) {
  const flattened = flattenRoutes(routes);
  return flattened.find(route => {
    const routePath = route.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(\`^\${routePath}$\`);
    return regex.test(pathname);
  });
}

export function getRouteParams(pathname, route) {
  const params = {};
  const pathParts = pathname.split('/').filter(Boolean);
  const routeParts = route.path.split('/').filter(Boolean);

  routeParts.forEach((part, index) => {
    if (part.startsWith(':')) {
      const paramName = part.slice(1);
      params[paramName] = pathParts[index];
    }
  });

  return params;
}

`;
  }

  private generateSyncImports(routes: RouteNode[]): string {
    const imports: string[] = [];
    const flatRoutes = this.flattenRoutesForImports(routes);

    flatRoutes.forEach((route, index) => {
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
      if (!route.hasComponent) {
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

      if (route.params && route.params.length > 0) {
        parts.push(`${indent}params: ${JSON.stringify(route.params)}`);
      }

      if (route.meta && Object.keys(route.meta).length > 0) {
        parts.push(`${indent}meta: ${JSON.stringify(route.meta)}`);
      }

      if (route.alias && route.alias.length > 0) {
        parts.push(`${indent}alias: ${JSON.stringify(route.alias)}`);
      }

      if (route.children && route.children.length > 0) {
        const childEntries = route.children
          .filter((child) => child.hasComponent)
          .map((child) => processRoute(child, depth + 1))
          .filter((entry) => entry);

        if (childEntries.length > 0) {
          parts.push(
            `${indent}children: [\n${childEntries.join(",\n")}\n${"  ".repeat(depth + 1)}]`,
          );
        }
      }

      return `{\n${parts.join(",\n")}\n${"  ".repeat(depth)}}`;
    };

    routes.forEach((route) => {
      const entry = processRoute(route);
      if (entry) {
        entries.push(`${entry}`);
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
    const moduleDeclaration = this.generateModuleDeclaration(routes);

    return `${moduleDeclaration}

// Auto-generated route types
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

  private generateModuleDeclaration(routes: RouteNode[]): string {
    const routeNames = this.extractRouteNames(routes);
    const paramInterfaces = this.generateParamInterfaces(routes);

    return `declare module "$oxide" {
  export interface RouteRecord {
    name: string;
    path: string;
    component: any;
    hasComponent: boolean;
    params?: string[];
    meta?: Record<string, any>;
    alias?: string[];
    children?: RouteRecord[];
  }

  export type RouteNames = ${routeNames.length > 0 ? routeNames.map((name) => `"${name}"`).join(" | ") : "never"};

  export interface RouteParams {
${paramInterfaces}
  }

  export function useRouter(): Router;
  export function useRoute(): Route;
  export function href(strings: TemplateStringsArray, ...values: any[]): string;
  export function findRouteByName(name: string): RouteRecord | undefined;
  export function generatePath(name: string, params?: Record<string, any>): string | null;
  export function matchRoute(pathname: string): RouteRecord | undefined;
  export function getRouteParams(pathname: string, route: RouteRecord): Record<string, string>;

  export const routes: RouteRecord[];
  export default routes;
}`;
  }

  private generateParamInterfaces(routes: RouteNode[]): string {
    const interfaces: string[] = [];

    const extractParamsFromRoute = (route: RouteNode) => {
      if (route.name) {
        if (route.params && route.params.length > 0) {
          const paramProps = route.params
            .map((param) => `  ${param}: string;`)
            .join("\n");
          interfaces.push(`    "${route.name}": {\n${paramProps}\n  }`);
        } else {
          interfaces.push(`    "${route.name}": Record<string, never>`);
        }
      }
      if (route.children) {
        route.children.forEach(extractParamsFromRoute);
      }
    };

    routes.forEach(extractParamsFromRoute);
    return interfaces.join(";\n");
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

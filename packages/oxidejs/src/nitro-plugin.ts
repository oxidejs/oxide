import path from "node:path";
import { readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";

interface RouteCompilerOptions {
  routesDir?: string;
}

export function oxideNitroPlugin(options: RouteCompilerOptions = {}) {
  const routesDir = options.routesDir ?? path.join(process.cwd(), "src/routes");

  // Generate files immediately when plugin is loaded
  generateClientRoutesFile(routesDir);
  generateClientInitFile(routesDir);

  return {
    virtual: {
      "#oxide/routes": () => generateServerRoutesManifest(routesDir),
    },
  };
}

function generateServerRoutesManifest(routesDir: string): string {
  const routes = discoverRoutes(routesDir);
  const layouts = discoverLayouts(routesDir);

  // Generate static imports for server-side SSR
  const routeImports = routes
    .map((route, index) => `import Route${index} from '../../${route.handler}';`)
    .join("\n");

  const layoutImports = layouts
    .map((layout, index) => `import Layout${index} from '../../${layout.handler}';`)
    .join("\n");

  const routeRegistry = routes
    .map((route, index) => `  '${route.handler}': Route${index}`)
    .join(",\n");

  const layoutRegistry = layouts
    .map((layout, index) => `  '${layout.handler}': Layout${index}`)
    .join(",\n");

  return `// Auto-generated server routes manifest
import LayoutRenderer from 'oxidejs/src/LayoutRenderer.svelte';
${routeImports}
${layoutImports}

const routes = ${JSON.stringify(routes, null, 2)};
const layouts = ${JSON.stringify(layouts, null, 2)};

const routeComponents = {
${routeRegistry}
};

const layoutComponents = {
${layoutRegistry}
};

function importRoute(handler) {
  const component = routeComponents[handler] || layoutComponents[handler];
  if (!component) {
    console.error('Server route component not found:', handler);
    return Promise.reject(new Error(\`Server component not found: \${handler}\`));
  }
  return Promise.resolve({ default: component });
}

function importRouteAssets(handler) {
  return Promise.resolve({});
}

export default {
  routes,
  layouts,
  importRoute,
  importRouteAssets,
  LayoutRenderer
};
`;
}

function generateClientInitFile(routesDir: string) {
  const clientCode = `// Auto-generated client initialization
import { initializeOxideRouter } from "oxidejs/client";
import routesManifest from "./client-routes.js";
import "../src/app.css";

// Initialize Oxide router with routes manifest from generated file
initializeOxideRouter(routesManifest);
`;

  try {
    const outputDir = path.join(process.cwd(), ".oxide");
    const outputFile = path.join(outputDir, "client.js");

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputFile, clientCode);
  } catch (error) {
    console.error("❌ Failed to generate client init file:", error);
  }
}

function generateClientRoutesFile(routesDir: string) {
  const routes = discoverRoutes(routesDir);
  const layouts = discoverLayouts(routesDir);

  // Generate static imports for all routes
  const routeImports = routes
    .map((route, index) => `import Route${index} from '../${route.handler}';`)
    .join("\n");

  const layoutImports = layouts
    .map((layout, index) => `import Layout${index} from '../${layout.handler}';`)
    .join("\n");

  const routeRegistry = routes
    .map((route, index) => `  '${route.handler}': Route${index}`)
    .join(",\n");

  const layoutRegistry = layouts
    .map((layout, index) => `  '${layout.handler}': Layout${index}`)
    .join(",\n");

  const clientCode = `// Auto-generated routes file
import LayoutRenderer from 'oxidejs/src/LayoutRenderer.svelte';
${routeImports}
${layoutImports}

const routes = ${JSON.stringify(routes, null, 2)};
const layouts = ${JSON.stringify(layouts, null, 2)};

const routeComponents = {
${routeRegistry}
};

const layoutComponents = {
${layoutRegistry}
};

function importRoute(handler) {
  const component = routeComponents[handler] || layoutComponents[handler];
  if (!component) {
    console.error('Route component not found:', handler);
    return Promise.reject(new Error(\`Component not found: \${handler}\`));
  }
  return Promise.resolve({ default: component });
}

function importRouteAssets(handler) {
  return Promise.resolve({});
}

export default {
  routes,
  layouts,
  importRoute,
  importRouteAssets,
  LayoutRenderer
};
`;

  try {
    const outputDir = path.join(process.cwd(), ".oxide");
    const outputFile = path.join(outputDir, "client-routes.js");

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputFile, clientCode);
  } catch (error) {
    console.error("❌ Failed to generate client routes file:", error);
  }
}

function discoverRoutes(dir: string): Array<{ path: string; handler: string }> {
  const routes: Array<{ path: string; handler: string }> = [];
  const root = path.resolve(dir);

  if (!existsSync(root)) return routes;

  const walk = (currentDir: string) => {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".svelte")) continue;

      const relativePath = path.relative(root, fullPath);
      const parsed = path.parse(relativePath);

      // Skip special files like +layout.svelte and +error.svelte
      if (parsed.name.startsWith("+")) continue;

      const relNoExt = path.join(parsed.dir, parsed.name);
      let routePath = "/" + relNoExt.split(path.sep).join("/");

      // Convert index routes
      if (routePath === "/index" || routePath.endsWith("/index")) {
        routePath = routePath.replace(/\/index$|^\/index$/, "") || "/";
      }

      // Convert dynamic parameters
      routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");
      routePath = routePath.replace(/\[\.{3}([^\]]+)\]/g, "*$1");

      const handler = `src/routes/${relativePath}`;
      routes.push({ path: routePath, handler });
    }
  };

  walk(dir);
  return routes;
}

function discoverLayouts(dir: string): Array<{ handler: string; level: number }> {
  const layouts: Array<{ handler: string; level: number }> = [];
  const root = path.resolve(dir);

  if (!existsSync(root)) return layouts;

  const walk = (currentDir: string, level: number = 0) => {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, level + 1);
        continue;
      }

      if (entry.name === "+layout.svelte") {
        const relativePath = path.relative(root, fullPath);
        const handler = `src/routes/${relativePath}`;
        layouts.push({ handler, level });
      }
    }
  };

  walk(dir);
  return layouts.sort((a, b) => a.level - b.level);
}

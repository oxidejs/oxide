import type { NitroConfig } from "nitro/types";

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { OxideConfig } from "./config.js";

import { setConfig } from "./config.js";
import {
  scanRoutesDirectory,
  generateRouteManifestArrays,
  generateImportStatements,
} from "./route-utils.js";

interface WithOxideOptions extends OxideConfig {}

/**
 * Generates route manifest data by scanning the routes directory.
 */
function generateRouteManifest(routesDir: string) {
  const routesDirPath = resolve(process.cwd(), routesDir);
  const { routes, layouts, errors } = scanRoutesDirectory(routesDirPath);

  const { routeImports, layoutImports, errorImports } = generateImportStatements(
    routes,
    layouts,
    errors,
    routesDir,
  );

  const {
    routesArray,
    layoutsArray,
    errorsArray,
    routeComponentsMap,
    layoutComponentsMap,
    errorComponentsMap,
  } = generateRouteManifestArrays(routes, layouts, errors, routesDir);

  return {
    routes,
    layouts,
    errors,
    routeImports,
    layoutImports,
    errorImports,
    routesArray,
    layoutsArray,
    errorsArray,
    routeComponentsMap,
    layoutComponentsMap,
    errorComponentsMap,
  };
}

/**
 * Configures Nitro with Oxide framework support.
 *
 * This function sets up:
 * - Route discovery and manifest generation
 * - Client-side hydration entry point
 * - Server-side route manifest file
 * - Server handlers for navigation payloads
 *
 * @param options - Configuration options
 * @returns Nitro configuration object
 */
export function withOxide(options: WithOxideOptions = {}) {
  const routesDir = options.routesDir ?? "src/routes";
  const trailingSlash = options.trailingSlash ?? "never";

  setConfig({
    routesDir,
    trailingSlash,
  });

  /**
   * Generates the .oxide/client.ts entry point for client-side hydration.
   * This file imports all routes and initializes the client router.
   */
  const generateClientEntry = () => {
    const oxideDir = resolve(process.cwd(), ".oxide");
    mkdirSync(oxideDir, { recursive: true });

    const manifest = generateRouteManifest(routesDir);

    const clientEntry = `import "../src/app.css";
import { initializeOxideRouter } from "oxidejs/client";
import { setConfig } from "oxidejs";
import LayoutRenderer from "oxidejs/components/LayoutRenderer.svelte";
import ErrorRenderer from "oxidejs/components/ErrorRenderer.svelte";

setConfig({
  routesDir: "${routesDir}",
  trailingSlash: "${trailingSlash}"
});

${manifest.routeImports}
${manifest.layoutImports}
${manifest.errorImports}

const routes = [
${manifest.routesArray}
];

const layouts = [
${manifest.layoutsArray}
];

const errors = [
${manifest.errorsArray}
];

const routeComponents = {
${manifest.routeComponentsMap}
};

const layoutComponents = {
${manifest.layoutComponentsMap}
};

const errorComponents = {
${manifest.errorComponentsMap}
};

function importRoute(handler) {
  const component = routeComponents[handler] || layoutComponents[handler] || errorComponents[handler];
  if (!component) {
    console.error("Route component not found:", handler);
    return Promise.reject(new Error(\`Component not found: \${handler}\`));
  }
  return Promise.resolve({ default: component });
}

function importRouteAssets(handler) {
  return Promise.resolve({});
}

const routeManifest = {
  routes,
  layouts,
  errors,
  importRoute,
  importRouteAssets,
  LayoutRenderer,
  ErrorRenderer
};

initializeOxideRouter(routeManifest);
`;

    writeFileSync(resolve(oxideDir, "client.ts"), clientEntry);
  };

  /**
   * Generates the .oxide/server.ts entry point for SSR.
   * This file exports the router manifest for use with OxideHandler.
   */
  const generateServerEntry = () => {
    const oxideDir = resolve(process.cwd(), ".oxide");
    mkdirSync(oxideDir, { recursive: true });

    const manifest = generateRouteManifest(routesDir);

    const serverEntry = `import LayoutRenderer from 'oxidejs/components/LayoutRenderer.svelte';
import ErrorRenderer from 'oxidejs/components/ErrorRenderer.svelte';

${manifest.routeImports}
${manifest.layoutImports}
${manifest.errorImports}

const routes = [
${manifest.routesArray}
];

const layouts = [
${manifest.layoutsArray}
];

const errors = [
${manifest.errorsArray}
];

const routeComponents = {
${manifest.routeComponentsMap}
};

const layoutComponents = {
${manifest.layoutComponentsMap}
};

const errorComponents = {
${manifest.errorComponentsMap}
};

function importRoute(handler) {
  const component = routeComponents[handler] || layoutComponents[handler] || errorComponents[handler];
  if (!component) {
    console.error('Route component not found:', handler);
    return Promise.reject(new Error(\`Component not found: \${handler}\`));
  }
  return Promise.resolve({ default: component });
}

function importRouteAssets(handler) {
  return Promise.resolve({});
}

export const router = {
  routes,
  layouts,
  errors,
  importRoute,
  importRouteAssets,
  LayoutRenderer,
  ErrorRenderer,
  config: {
    trailingSlash: "${trailingSlash}" as const
  }
};
`;

    writeFileSync(resolve(oxideDir, "server.ts"), serverEntry);
  };

  const generateEntries = () => {
    generateClientEntry();
    generateServerEntry();
  };

  return {
    serverDir: "src",
    hooks: {
      "dev:start": generateEntries,
      "build:before": generateEntries,
    },
    errorHandler: "src/error.ts",
    experimental: {
      asyncContext: true,
    },
    routeRules: {
      "/__oxide/payload/**": {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
      "/assets/**": {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
      "/**": {
        headers: {
          "Cache-Control": "no-cache",
        },
      },
    },
  } satisfies NitroConfig;
}

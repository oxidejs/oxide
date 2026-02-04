import type { NitroConfig } from "nitro";

interface WithOxideOptions {
  routesDir?: string;
}

export function withOxide(options: WithOxideOptions = {}): NitroConfig {
  const routesDir = options.routesDir ?? "./src/routes";

  return {
    renderer: {
      handler: "src/renderer.ts",
    },
    errorHandler: "src/error.ts",
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
    serverHandlers: [
      {
        route: "/__oxide/payload/**",
        handler: "./src/payload.ts",
      },
    ],
    virtual: {
      "#oxide/routes": `
import LayoutRenderer from 'oxidejs/components/LayoutRenderer.svelte';
import ErrorRenderer from 'oxidejs/components/ErrorRenderer.svelte';

// Import all route components
import Route0 from '../../src/routes/index.svelte';
import Route1 from '../../src/routes/nested/ok.svelte';
import Route2 from '../../src/routes/user/[id].svelte';
import Route3 from '../../src/routes/docs/[...path].svelte';
import Route4 from '../../src/routes/docs/index.svelte';
import Layout0 from '../../src/routes/+layout.svelte';
import Error0 from '../../src/routes/user/+error.svelte';

const routes = [
  { "path": "/", "handler": "src/routes/index.svelte", "priority": 100 },
  { "path": "/nested/ok", "handler": "src/routes/nested/ok.svelte", "priority": 100 },
  { "path": "/user/:id", "handler": "src/routes/user/[id].svelte", "priority": 50 },
  { "path": "/docs/**:path", "handler": "src/routes/docs/[...path].svelte", "priority": 1 },
  { "path": "/docs", "handler": "src/routes/docs/index.svelte", "priority": 100 }
];

const layouts = [
  { "handler": "src/routes/+layout.svelte", "level": 0, "segment": "" }
];

const errors = [
  { "handler": "src/routes/user/+error.svelte", "level": 1, "segment": "user" }
];

const routeComponents = {
  'src/routes/index.svelte': Route0,
  'src/routes/nested/ok.svelte': Route1,
  'src/routes/user/[id].svelte': Route2,
  'src/routes/docs/[...path].svelte': Route3,
  'src/routes/docs/index.svelte': Route4
};

const layoutComponents = {
  'src/routes/+layout.svelte': Layout0
};

const errorComponents = {
  'src/routes/user/+error.svelte': Error0
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

export default {
  routes,
  layouts,
  errors,
  importRoute,
  importRouteAssets,
  LayoutRenderer,
  ErrorRenderer
};
      `,
    },
  };
}

import type { Plugin } from "vite";
import type { FsRouterOptions, PluginContext } from "./types";
import { RouteScanner } from "./scanner";
import { RouteGenerator } from "./generator";

const DEFAULT_OPTIONS: FsRouterOptions = {
  pagesDir: "src/pages",
  extensions: [".svelte"],
  importMode: "async",
  virtualId: "virtual:oxide-routes",
  routeBlock: true,
  dts: false,
  routeGroups: true,
};

export function OxidePlugin(options: FsRouterOptions = {}): Plugin {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (options.dir && !options.pagesDir) {
    opts.pagesDir = options.dir;
  }

  let root: string;
  let context: PluginContext;
  let scanner: RouteScanner;
  let generator: RouteGenerator;

  let cachedModuleCode: string | null = null;
  let cachedTypeDefinitions: string | null = null;

  async function generateRoutes() {
    try {
      const scanResult = await scanner.scan();
      const processedTree = await scanner.applyHooks(scanResult.tree);
      const generated = generator.generate(processedTree);

      cachedModuleCode = generated.moduleCode;
      cachedTypeDefinitions = generated.typeDefinitions;

      const totalRoutes = countRoutes(processedTree);
      console.log(`[oxide] Generated ${totalRoutes} routes`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[oxide] Route generation failed: ${message}`);

      cachedModuleCode = `export const routes = [];\nexport default routes;`;
      cachedTypeDefinitions = `export type RouteNames = never;`;
    }
  }

  function countRoutes(tree: any): number {
    let count = tree.hasComponent ? 1 : 0;
    if (tree.children) {
      for (const child of tree.children) {
        count += countRoutes(child);
      }
    }
    return count;
  }

  return {
    name: "oxide-fs-router",
    enforce: "pre",

    configResolved(resolvedConfig) {
      root = resolvedConfig.root;

      context = {
        root,
        options: opts,
        cache: new Map(),
        watcher: undefined,
      };

      scanner = new RouteScanner(context);
      generator = new RouteGenerator(context);
    },

    async buildStart() {
      await generateRoutes();
    },

    resolveId(id) {
      return id === opts.virtualId ? opts.virtualId : null;
    },

    load(id) {
      if (id === opts.virtualId) {
        return cachedModuleCode;
      }
    },

    async handleHotUpdate({ file, server }) {
      const relativePath = file.replace(root + "/", "");
      const pagesDir = opts.pagesDir!.replace(/^\//, "");

      if (relativePath.startsWith(pagesDir)) {
        await generateRoutes();

        const module = server.moduleGraph.getModuleById(opts.virtualId!);
        if (module) {
          server.reloadModule(module);
        }
      }
    },

    async generateBundle() {
      if (opts.dts && cachedTypeDefinitions) {
        this.emitFile({
          type: "asset",
          fileName:
            typeof opts.dts === "string" ? opts.dts : "router-types.d.ts",
          source: cachedTypeDefinitions,
        });
      }
    },
  };
}

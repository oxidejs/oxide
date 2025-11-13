import type { Plugin } from "vite";
import type { FsRouterOptions, PluginContext } from "./types";
import { RouteScanner } from "./scanner";
import { RouteGenerator } from "./generator";
import { promises as fs } from "fs";
import { resolve } from "path";
import {
  scanRouters,
  generateImports,
  buildRouterObject,
  buildRouterTypes,
} from "./orpc/routers";
import {
  generateClientCode,
  generateTypeDefinitions,
  generateEmptyTypeDefinitions,
} from "./orpc/client";

const DEFAULT_OPTIONS: FsRouterOptions = {
  pagesDir: "src/app",
  extensions: [".svelte"],
  importMode: "async",
  virtualId: "$oxide",
  routeBlock: true,
  dts: true,
  routeGroups: true,
  routersDir: "src/app",
  rpcExtensions: [".ts", ".js"],
  clientUrl: undefined,
  clientConfig: {},
  ssr: true,
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
  let cachedRpcCode: string | null = null;
  let cachedRpcTypes: string | null = null;

  function getDtsPath(): string {
    if (typeof opts.dts === "string") {
      return opts.dts;
    }
    return ".oxide/types.d.ts";
  }

  async function generateRoutes() {
    try {
      const scanResult = await scanner.scan();
      const processedTree = await scanner.applyHooks(scanResult.tree);
      const generated = generator.generate(processedTree);

      cachedModuleCode = generated.moduleCode;
      cachedTypeDefinitions = generated.typeDefinitions;

      const totalRoutes = countRoutes(processedTree);
    } catch (error) {
      cachedModuleCode = `export const routes = [];\nexport default routes;`;
      cachedTypeDefinitions = `export type RouteNames = never;`;
    }
  }

  async function generateRpcModule(): Promise<void> {
    try {
      const routers = await scanRouters({
        routersDir: opts.routersDir!,
        extensions: opts.rpcExtensions!,
        root,
      });

      if (routers.length === 0) {
        cachedRpcCode = generateClientCode({
          routers: [],
          routerObject: "{}",
          imports: "",
          ssr: opts.ssr!,
          clientUrl: opts.clientUrl,
        });
        cachedRpcTypes = generateEmptyTypeDefinitions({
          ssr: opts.ssr!,
        });
        return;
      }

      const imports = generateImports(routers);
      const routerObject = buildRouterObject(routers);
      const routerTypes = buildRouterTypes(routers);

      cachedRpcCode = generateClientCode({
        routers,
        routerObject,
        imports,
        ssr: opts.ssr!,
        clientUrl: opts.clientUrl,
      });

      cachedRpcTypes = generateTypeDefinitions({
        routerTypes,
        ssr: opts.ssr!,
      });

      console.log(
        `[oxide] Generated RPC module with ${routers.length} routers`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[oxide] RPC module generation failed: ${message}`);

      cachedRpcCode = generateClientCode({
        routers: [],
        routerObject: "{}",
        imports: "",
        ssr: opts.ssr!,
        clientUrl: opts.clientUrl,
      });
      cachedRpcTypes = generateEmptyTypeDefinitions({ ssr: opts.ssr! });
    }
  }

  async function generateUnifiedModule(): Promise<void> {
    await Promise.all([generateRoutes(), generateRpcModule()]);

    // Write types file during development
    if (opts.dts && (cachedTypeDefinitions || cachedRpcTypes)) {
      const typesPath = resolve(root, getDtsPath());
      const typesDir = resolve(typesPath, "..");
      await fs.mkdir(typesDir, { recursive: true });

      // Merge the type definitions into a single module declaration
      const unifiedTypes = mergeTypeDefinitions(
        cachedTypeDefinitions,
        cachedRpcTypes,
      );

      cachedTypeDefinitions = unifiedTypes;
      console.log(`[oxide] Writing types file to: ${typesPath}`);
      await fs.writeFile(typesPath, cachedTypeDefinitions);
    }
  }

  function mergeTypeDefinitions(
    routeTypes: string | null,
    rpcTypes: string | null,
  ): string {
    if (!routeTypes && !rpcTypes) return "";

    const moduleExports: string[] = [];
    let globalDeclarations = "";

    // Add RouterClient import at the top of the module
    moduleExports.push("import type { RouterClient } from '@orpc/server';", "");

    if (routeTypes) {
      // Add route interfaces and types inside the module
      moduleExports.push(
        "export interface RouteRecord {",
        "  name: string;",
        "  path: string;",
        "  component: any;",
        "  params?: string[];",
        "  meta?: Record<string, any>;",
        "  alias?: string[];",
        "  children?: RouteRecord[];",
        "}",
        "",
        'export type RouteNames = "home" | "foo" | "bar";',
        "",
        "export const routes: RouteRecord[];",
        "export default routes;",
        "export function findRouteByName(name: RouteNames): RouteRecord | undefined;",
        "export function generatePath(name: RouteNames, params?: Record<string, any>): string;",
        "export function getRouteParams(path: string): { route: RouteRecord | null; params: Record<string, string> };",
        "",
      );
    }

    if (rpcTypes) {
      // Add RPC exports
      moduleExports.push(
        "export const router: {",
        "  readonly example: typeof import('../src/routers/example').default",
        "};",
        "",
        "export const rpc: RouterClient<typeof router>;",
      );

      // Extract global declarations
      const globalMatch = rpcTypes.match(/declare global \{[\s\S]*?\}/);
      if (globalMatch) {
        globalDeclarations = globalMatch[0];
      }
    }

    // Build the final types
    const moduleContent = moduleExports.join("\n  ");

    return `declare module "$oxide" {
  ${moduleContent}
}${globalDeclarations ? "\n\n" + globalDeclarations : ""}`.trim();
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
    name: "oxide",
    enforce: "pre",

    async configResolved(resolvedConfig) {
      root = resolvedConfig.root;

      context = {
        root,
        options: opts,
        cache: new Map(),
        watcher: undefined,
      };

      scanner = new RouteScanner(context);
      generator = new RouteGenerator(context);

      await generateUnifiedModule();
    },

    async buildStart() {
      await generateUnifiedModule();
    },

    resolveId(id) {
      if (id === opts.virtualId || id === "$oxide") {
        return opts.virtualId;
      }
      return null;
    },

    load(id) {
      if (id === opts.virtualId) {
        // Generate the actual unified module code
        const routesCode =
          cachedModuleCode ||
          "export const routes = [];\nexport default routes;";

        let rpcCode = "export const rpc = null;\nexport const router = {};";
        if (cachedRpcCode) {
          // Include all RPC code but rename client export to rpc
          rpcCode = cachedRpcCode
            .replace(
              "export const client = globalThis.$orpcClient ?? clientSideClient;",
              "export const rpc = globalThis.$orpcClient ?? clientSideClient;",
            )
            .replace(
              "export const client = clientSideClient;",
              "export const rpc = clientSideClient;",
            )
            .replace(
              /export default { router, client };/,
              "// Default export removed - use named exports instead",
            );
        }

        return `${routesCode}\n\n// RPC exports\n${rpcCode}`;
      }
    },

    async handleHotUpdate({ file, server }) {
      const relativePath = file.replace(root + "/", "");
      const pagesDir = opts.pagesDir!.replace(/^\//, "");
      const routersDir = opts.routersDir!.replace(/^\//, "");

      let shouldReload = false;

      if (relativePath.startsWith(pagesDir)) {
        await generateRoutes();
        shouldReload = true;
      }

      if (relativePath.startsWith(routersDir)) {
        await generateRpcModule();
        shouldReload = true;
      }

      if (shouldReload) {
        await generateUnifiedModule();

        const module = server.moduleGraph.getModuleById(opts.virtualId!);
        if (module) {
          server.reloadModule(module);
        }

        // Update types file on hot reload
        if (opts.dts && cachedTypeDefinitions) {
          const typesPath = resolve(root, getDtsPath());
          await fs.mkdir(resolve(root, ".oxide"), { recursive: true });
          console.log(`[oxide] Hot reload - updating types file: ${typesPath}`);
          await fs.writeFile(typesPath, cachedTypeDefinitions);
        }
      }
    },

    async generateBundle() {
      if (opts.dts && cachedTypeDefinitions) {
        this.emitFile({
          type: "asset",
          fileName: getDtsPath(),
          source: cachedTypeDefinitions,
        });
      }
    },
  };
}

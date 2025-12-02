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
  let cachedRpcCodeSSR: string | null = null;
  let cachedRpcCodeClient: string | null = null;
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
      // Extract routes from the processed tree
      const routes =
        processedTree.children?.filter((route) => route.hasComponent) || [];
      const generated = generator.generate(routes);

      cachedModuleCode = generated.moduleCode;
      cachedTypeDefinitions = generated.typeDefinitions;
    } catch (error) {
      console.error("[oxide] Route generation failed:", error);
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
        cachedRpcCodeSSR = generateClientCode({
          routers: [],
          routerObject: "{}",
          imports: "",
          ssr: true,
          clientUrl: opts.clientUrl,
        });
        cachedRpcCodeClient = generateClientCode({
          routers: [],
          routerObject: "{}",
          imports: "",
          ssr: false,
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

      cachedRpcCodeSSR = generateClientCode({
        routers,
        routerObject,
        imports,
        ssr: true,
        clientUrl: opts.clientUrl,
      });

      cachedRpcCodeClient = generateClientCode({
        routers: [],
        routerObject: "{}",
        imports: "",
        ssr: false,
        clientUrl: opts.clientUrl,
      });

      cachedRpcTypes = generateTypeDefinitions({
        routerTypes,
        ssr: opts.ssr!,
      });
    } catch (error) {
      cachedRpcCodeSSR = generateClientCode({
        routers: [],
        routerObject: "{}",
        imports: "",
        ssr: true,
        clientUrl: opts.clientUrl,
      });
      cachedRpcCodeClient = generateClientCode({
        routers: [],
        routerObject: "{}",
        imports: "",
        ssr: false,
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
      await fs.writeFile(typesPath, cachedTypeDefinitions);
    }
  }

  function mergeTypeDefinitions(
    routeTypes: string | null,
    rpcTypes: string | null,
  ): string {
    if (!routeTypes && !rpcTypes) return "";

    let routeTopLevel = "";
    let routeModuleContent = "";

    if (routeTypes) {
      const routeModuleStart = routeTypes.indexOf('declare module "$oxide"');
      if (routeModuleStart >= 0) {
        routeTopLevel = routeTypes.substring(0, routeModuleStart).trim();
        const match = routeTypes.match(
          /declare module "\$oxide" \{([\s\S]*)\}$/,
        );
        if (match) routeModuleContent = match[1] || "";
      } else {
        routeTopLevel = routeTypes;
      }
    }

    let rpcModuleContent = "";
    let globalDeclarations = "";

    if (rpcTypes) {
      const match = rpcTypes.match(
        /declare module "\$oxide" \{([\s\S]*?)\}(?:\s*\n\ndeclare global|$)/,
      );
      if (match) rpcModuleContent = match[1] || "";

      const globalMatch = rpcTypes.match(/\ndeclare global \{[\s\S]*?\}$/);
      if (globalMatch) globalDeclarations = globalMatch[0].trim();
    }

    const parts: string[] = [];

    if (routeTopLevel) {
      parts.push(routeTopLevel);
      parts.push("");
    }

    parts.push('declare module "$oxide" {');

    if (routeModuleContent) {
      parts.push(routeModuleContent);
    }

    if (rpcModuleContent) {
      if (routeModuleContent) {
        parts.push("");
      }
      parts.push(rpcModuleContent);
    }

    parts.push("}");

    if (globalDeclarations) {
      parts.push("");
      parts.push(globalDeclarations);
    }

    return parts.join("\n");
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

    load(id, options) {
      if (id === opts.virtualId) {
        // Generate the actual unified module code
        const routesCode =
          cachedModuleCode ||
          "export const routes = [];\nexport default routes;";

        let rpcCode = "export const rpc = null;\nexport const router = {};";

        const isSSR = options?.ssr === true;
        const targetRpcCode = isSSR ? cachedRpcCodeSSR : cachedRpcCodeClient;

        if (targetRpcCode) {
          // Include all RPC code but rename client export to rpc
          rpcCode = targetRpcCode
            .replace(
              "export const client = globalThis.$orpcClient ?? clientSideClient;",
              "export const rpc = globalThis.$orpcClient ?? clientSideClient;",
            )
            .replace(
              "export const client = createORPCClient(link);",
              "export const rpc = createORPCClient(link);",
            )
            .replace(
              /export default { router, client };/,
              "// Default export removed - use named exports instead",
            );
        }

        const result = `${routesCode}\n\n// RPC exports\n${rpcCode}`;
        return result;
      }
      return null;
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

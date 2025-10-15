import type { Plugin } from "vite";
import { promises as fs } from "fs";
import { join, resolve, relative, extname, basename } from "path";
import { readdir } from "node:fs/promises";
import dedent from "dedent";

export interface ORPCPluginOptions {
  routersDir?: string;
  extensions?: string[];
  virtualId?: string;
  clientUrl?: string;
  clientConfig?: {
    baseUrl?: string;
    headers?: Record<string, string>;
  };
  dts?: string | boolean;
}

interface RouterInfo {
  name: string;
  filePath: string;
  importPath: string;
  segments: string[];
}

const DEFAULT_OPTIONS: ORPCPluginOptions = {
  routersDir: "src/routers",
  extensions: [".ts", ".js"],
  virtualId: "virtual:orpc",
  clientUrl: undefined,
  clientConfig: {},
  dts: true,
};

export function ORPCPlugin(options: ORPCPluginOptions = {}): Plugin {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let root: string;
  let cachedModuleCode: string | null = null;
  let cachedTypeDefinitions: string | null = null;

  function getDtsPath(): string {
    if (typeof opts.dts === "string") {
      return opts.dts;
    }
    return ".oxide/orpc-types.d.ts";
  }

  async function scanRouters(): Promise<RouterInfo[]> {
    const routersPath = resolve(root, opts.routersDir!);

    try {
      await fs.access(routersPath);
    } catch {
      return [];
    }

    const files: string[] = [];

    async function scanDirectory(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (opts.extensions!.includes(ext)) {
            const relativePath = relative(routersPath, fullPath);
            files.push(relativePath);
          }
        }
      }
    }

    await scanDirectory(routersPath);

    return files.map((file) => {
      const filePath = join(routersPath, file);
      const name = basename(file, extname(file));
      const importPath = relative(root, filePath).replace(/\\/g, "/");
      const segments = file.replace(/\\/g, "/").split("/").slice(0, -1);

      return {
        name,
        filePath,
        importPath,
        segments,
      };
    });
  }

  async function generateVirtualModule(): Promise<void> {
    try {
      const routers = await scanRouters();

      if (routers.length === 0) {
        cachedModuleCode = generateEmptyModule();
        cachedTypeDefinitions = generateEmptyTypes();
        return;
      }

      const imports = routers
        .map(
          (router, index) =>
            `import router${index} from './${router.importPath}';`,
        )
        .join("\n");

      function buildRouterObject(routers: RouterInfo[]): string {
        const tree: any = {};

        routers.forEach((router, index) => {
          let current = tree;
          for (const segment of router.segments) {
            if (!current[segment]) {
              current[segment] = {};
            }
            current = current[segment];
          }
          current[router.name] = `router${index}`;
        });

        function objectToString(obj: any, indent = 2): string {
          const entries = Object.entries(obj);
          if (entries.length === 0) return "{}";

          const items = entries.map(([key, value]) => {
            const spaces = " ".repeat(indent);
            if (typeof value === "string") {
              return `${spaces}${key}: ${value}`;
            } else {
              return `${spaces}${key}: ${objectToString(value, indent + 2)}`;
            }
          });

          return `{\n${items.join(",\n")}\n${" ".repeat(indent - 2)}}`;
        }

        return objectToString(tree);
      }

      const routerObject = buildRouterObject(routers);

      const linkConfig = {
        ...opts.clientConfig,
        ...(opts.clientUrl && { url: opts.clientUrl }),
      };
      const clientConfig = JSON.stringify(linkConfig, null, 2);

      cachedModuleCode = dedent`
        ${imports}
        import { createORPCClient } from '@orpc/client';
        import { RPCLink } from '@orpc/client/fetch';

        export const router = ${routerObject};

        const link = new RPCLink(${clientConfig});

        export const client = createORPCClient(link);

        export default { router, client };
        `;

      // Generate TypeScript definitions
      function buildRouterTypes(routers: RouterInfo[]): string {
        const tree: any = {};

        routers.forEach((router, index) => {
          let current = tree;
          for (const segment of router.segments) {
            if (!current[segment]) {
              current[segment] = {};
            }
            current = current[segment];
          }
          current[router.name] =
            `typeof import('../${router.importPath.replace(/\.(ts|js)$/, "")}').default`;
        });

        function typeToString(obj: any, indent = 2): string {
          const entries = Object.entries(obj);
          if (entries.length === 0) return "Record<string, never>";

          const items = entries.map(([key, value]) => {
            const spaces = " ".repeat(indent);
            if (typeof value === "string") {
              return `${spaces}readonly ${key}: ${value}`;
            } else {
              return `${spaces}readonly ${key}: ${typeToString(value, indent + 2)}`;
            }
          });

          return `{\n${items.join(";\n")}\n${" ".repeat(indent - 2)}}`;
        }

        return typeToString(tree);
      }

      const routerTypes = buildRouterTypes(routers);

      cachedTypeDefinitions = dedent`
        declare module "virtual:orpc" {
          import type { RouterClient } from '@orpc/server';

          export const router: ${routerTypes};

          export const client: RouterClient<typeof router>;

          const _default: {
            router: typeof router;
            client: typeof client;
          };

          export default _default;
        }

        declare module "~orpc" {
          export * from "virtual:orpc";
          export { default } from "virtual:orpc";
        }
      `;

      console.log(
        `[orpc] Generated virtual module with ${routers.length} routers`,
      );

      // Write types file during development
      if (opts.dts && cachedTypeDefinitions) {
        const typesPath = resolve(root, getDtsPath());
        await fs.mkdir(resolve(root, ".oxide"), { recursive: true });
        console.log(`[orpc] Writing types file to: ${typesPath}`);
        await fs.writeFile(typesPath, cachedTypeDefinitions);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[orpc] Virtual module generation failed: ${message}`);

      cachedModuleCode = generateEmptyModule();
      cachedTypeDefinitions = generateEmptyTypes();

      // Write types file even for empty module
      if (opts.dts && cachedTypeDefinitions) {
        const typesPath = resolve(root, getDtsPath());
        await fs.mkdir(resolve(root, ".oxide"), { recursive: true });
        console.log(`[orpc] Writing empty types file to: ${typesPath}`);
        await fs.writeFile(typesPath, cachedTypeDefinitions);
      }
    }
  }

  function generateEmptyModule(): string {
    const linkConfig = {
      ...opts.clientConfig,
      ...(opts.clientUrl && { url: opts.clientUrl }),
    };
    const clientConfig = JSON.stringify(linkConfig, null, 2);

    return dedent`
      import { createORPCClient } from '@orpc/client';
      import { RPCLink } from '@orpc/client/fetch';

      export const router = {};

      const link = new RPCLink(${clientConfig});

      export const client = createORPCClient(link);

      export default { router, client };
    `;
  }

  function generateEmptyTypes(): string {
    return dedent`
      declare module "virtual:orpc" {
        import type { RouterClient } from '@orpc/server';

        export const router: Record<string, never>;

        export const client: RouterClient<typeof router>;

        const _default: {
          router: typeof router;
          client: typeof client;
        };

        export default _default;
      }

      declare module "~orpc" {
        export * from "virtual:orpc";
        export { default } from "virtual:orpc";
      }
    `;
  }

  return {
    name: "orpc",
    enforce: "pre",

    async configResolved(resolvedConfig) {
      root = resolvedConfig.root;
      console.log(`[orpc] Plugin configResolved, root: ${root}`);
      await generateVirtualModule();
    },

    async buildStart() {
      console.log(`[orpc] buildStart hook called`);
      await generateVirtualModule();
    },

    resolveId(id) {
      if (id === opts.virtualId || id === "~orpc") {
        return opts.virtualId;
      }
      return null;
    },

    load(id) {
      if (id === opts.virtualId) {
        console.log(`[orpc] Loading virtual module: ${id}`);
        return cachedModuleCode;
      }
    },

    async handleHotUpdate({ file, server }) {
      const relativePath = relative(root, file).replace(/\\/g, "/");
      const routersDir = opts.routersDir!.replace(/^\//, "");

      if (relativePath.startsWith(routersDir)) {
        await generateVirtualModule();

        const module = server.moduleGraph.getModuleById(opts.virtualId!);
        if (module) {
          server.reloadModule(module);
        }

        // Update types file on hot reload
        if (opts.dts && cachedTypeDefinitions) {
          const typesPath = resolve(root, getDtsPath());
          await fs.mkdir(resolve(root, ".oxide"), { recursive: true });
          console.log(`[orpc] Hot reload - updating types file: ${typesPath}`);
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

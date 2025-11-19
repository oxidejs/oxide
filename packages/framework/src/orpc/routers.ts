import { promises as fs } from "fs";
import { join, resolve, relative, extname, basename } from "path";

export interface RouterInfo {
  name: string;
  filePath: string;
  importPath: string;
  segments: string[];
}

export interface RouterScanOptions {
  routersDir: string;
  extensions: string[];
  root: string;
}

export async function scanRouters(
  options: RouterScanOptions,
): Promise<RouterInfo[]> {
  const { routersDir, extensions, root } = options;
  const routersPath = resolve(root, routersDir);

  try {
    await fs.access(routersPath);
  } catch {
    return [];
  }

  const files: string[] = [];

  async function scanDirectory(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (extensions.includes(ext)) {
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

export function generateImports(routers: RouterInfo[]): string {
  return routers
    .map(
      (router, index) => `import router${index} from './${router.importPath}';`,
    )
    .join("\n");
}

export function buildRouterObject(routers: RouterInfo[]): string {
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

export function buildRouterTypes(routers: RouterInfo[]): string {
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

  return typeToString(tree, 4);
}

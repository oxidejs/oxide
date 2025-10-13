import { join, relative, extname } from "node:path";
import { readdir } from "node:fs/promises";
import type { RouteNode, PluginContext, ScanResult } from "./types";

export class RouteScanner {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async scan(): Promise<ScanResult> {
    const { pagesDir = "src/pages", extensions = [".svelte"] } =
      this.context.options;
    const pagesPath = join(this.context.root, pagesDir);

    const files = await this.scanFiles(pagesPath, extensions);
    const tree = await this.buildRouteTree(files, pagesPath);
    return { files, tree };
  }

  private async scanFiles(
    dir: string,
    extensions: string[],
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.scanFiles(fullPath, extensions);
          files.push(...subFiles);
        } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return files;
  }

  private async buildRouteTree(
    files: string[],
    pagesDir: string,
  ): Promise<RouteNode> {
    const root: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [],
      meta: {},
      params: [],
      hasComponent: false,
    };

    for (const file of files) {
      try {
        const relativePath = relative(pagesDir, file);
        const route = await this.createRouteFromFile(relativePath, file);
        if (route?.name && route.path !== undefined) {
          root.children.push(route);
        }
      } catch {
        continue;
      }
    }

    return root;
  }

  private async createRouteFromFile(
    relativePath: string,
    fullPath: string,
  ): Promise<RouteNode | null> {
    if (!relativePath || !fullPath) return null;

    const pathWithoutExt = relativePath.replace(/\.[^.]+$/, "");
    const segments = pathWithoutExt.split("/").filter(Boolean);

    const urlPath = this.convertToUrlPath(segments);
    const params = this.extractParams(segments);
    const name = this.generateRouteName(segments);

    if (!name) return null;

    return {
      name,
      path: urlPath,
      fullPath: urlPath,
      componentImport: "/" + relative(this.context.root, fullPath),
      children: [],
      meta: {},
      params: params || [],
      hasComponent: true,
      filePath: fullPath,
    };
  }

  private convertToUrlPath(segments: string[]): string {
    const pathParts: string[] = [];

    for (const segment of segments) {
      // Skip index files
      if (segment === "index") continue;
      if (!segment) continue;

      // Skip route groups (folders wrapped in parentheses)
      if (segment.startsWith("(") && segment.endsWith(")")) {
        continue;
      }

      // Handle dynamic parameters [param] -> :param
      if (segment.startsWith("[") && segment.endsWith("]")) {
        const paramName = segment.slice(1, -1);

        // Handle catch-all routes [...param] -> *
        if (paramName.startsWith("...")) {
          pathParts.push("*");
        } else {
          pathParts.push(`:${paramName}`);
        }
      } else {
        pathParts.push(segment);
      }
    }

    const path = "/" + pathParts.join("/");
    return path === "/" ? "/" : path.replace(/\/$/, "");
  }

  private extractParams(segments: string[]): string[] {
    const params: string[] = [];

    for (const segment of segments) {
      if (segment.startsWith("[") && segment.endsWith("]")) {
        const paramName = segment.slice(1, -1);

        // Handle catch-all routes [...param]
        if (paramName.startsWith("...")) {
          params.push(paramName.slice(3)); // Remove "..."
        } else {
          params.push(paramName);
        }
      }
    }

    return params;
  }

  private generateRouteName(segments: string[]): string {
    if (!segments?.length) return "home";

    const nameParts: string[] = [];

    for (const segment of segments) {
      if (!segment || segment === "index") {
        continue;
      }

      // Skip route groups in name generation
      if (segment.startsWith("(") && segment.endsWith(")")) {
        continue;
      }

      if (segment.startsWith("[") && segment.endsWith("]")) {
        const paramName = segment.slice(1, -1);
        if (paramName.startsWith("...")) {
          nameParts.push(paramName.slice(3)); // Remove "..."
        } else {
          nameParts.push(paramName);
        }
      } else {
        nameParts.push(segment);
      }
    }

    return nameParts.length > 0 ? nameParts.join("-") : "home";
  }

  async applyHooks(tree: RouteNode): Promise<RouteNode> {
    const { extendRoute } = this.context.options;

    if (extendRoute) {
      const processNode = async (node: RouteNode): Promise<RouteNode> => {
        if (node.hasComponent) {
          node = await extendRoute(node);
        }

        if (node.children) {
          const processedChildren: RouteNode[] = [];
          for (const child of node.children) {
            if (child) {
              processedChildren.push(await processNode(child));
            }
          }
          node.children = processedChildren;
        }

        return node;
      };

      tree = await processNode(tree);
    }

    return tree;
  }
}

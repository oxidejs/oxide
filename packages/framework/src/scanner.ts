import { join, relative, extname, basename } from "node:path";
import { readdir, stat } from "node:fs/promises";
import type { RouteNode, PluginContext, ScanResult } from "./types";

export class RouteScanner {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async scan(): Promise<ScanResult> {
    const { pagesDir = "src/app", extensions = [".svelte"] } =
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
          // Skip hidden directories and node_modules
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            const subFiles = await this.scanFiles(fullPath, extensions);
            files.push(...subFiles);
          }
        } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
          // Check if filename is valid before adding
          if (this.isValidFileName(entry.name)) {
            files.push(fullPath);
          }
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

    // Create route nodes for all files
    const routeMap = new Map<string, RouteNode>();
    for (const file of files) {
      const relativePath = relative(pagesDir, file);
      const route = await this.createRouteFromFile(relativePath, file);
      if (route) {
        routeMap.set(relativePath, route);
      }
    }

    // Organize routes: layouts and their children
    await this.organizeRoutes(root, routeMap, pagesDir);

    return root;
  }

  private async organizeRoutes(
    root: RouteNode,
    routeMap: Map<string, RouteNode>,
    pagesDir: string,
  ): Promise<void> {
    const processedPaths = new Set<string>();

    // Recursively process layouts starting from root level
    await this.processLayoutLevel(root, routeMap, pagesDir, processedPaths, []);

    // Add remaining files that aren't part of layouts
    for (const [relativePath, route] of routeMap) {
      if (!processedPaths.has(relativePath)) {
        // Check if this file is part of any layout hierarchy
        const segments = this.getPathSegments(relativePath);
        let isPartOfLayout = false;

        // Check if any parent directory has a corresponding layout file
        for (let i = 1; i < segments.length; i++) {
          const parentPath = segments.slice(0, i).join("/") + ".svelte";
          if (routeMap.has(parentPath)) {
            isPartOfLayout = true;
            break;
          }
        }

        if (!isPartOfLayout) {
          // This is a standalone route (not part of any layout)
          root.children.push(route);
        }
      }
    }
  }

  private async processLayoutLevel(
    parentNode: RouteNode,
    routeMap: Map<string, RouteNode>,
    pagesDir: string,
    processedPaths: Set<string>,
    pathPrefix: string[],
  ): Promise<void> {
    // Find all layout files at this level
    for (const [relativePath, route] of routeMap) {
      if (processedPaths.has(relativePath)) continue;

      const segments = this.getPathSegments(relativePath);

      // Check if this file is at the current level
      if (segments.length === pathPrefix.length + 1) {
        const fileName = segments[segments.length - 1];
        const currentPath = [...pathPrefix, fileName];

        // Check if there's a corresponding directory
        const hasCorrespondingDir = await this.hasCorrespondingDirectory(
          currentPath.join("/"),
          pagesDir,
        );

        if (hasCorrespondingDir) {
          // This is a layout file
          const layoutRoute = { ...route };
          const children: RouteNode[] = [];

          // Find direct children (non-layout files in the corresponding directory)
          for (const [childPath, childRoute] of routeMap) {
            const childSegments = this.getPathSegments(childPath);

            if (
              childSegments.length === pathPrefix.length + 2 &&
              this.arraysEqual(childSegments.slice(0, -1), currentPath)
            ) {
              // Check if this child is also a layout
              const childHasCorrespondingDir =
                await this.hasCorrespondingDirectory(
                  childSegments.join("/"),
                  pagesDir,
                );

              if (!childHasCorrespondingDir) {
                // This is a direct child page (not a layout)
                const adjustedChild = { ...childRoute };
                const childName = childSegments[childSegments.length - 1];

                if (childName === "index") {
                  adjustedChild.path = "/index";
                  adjustedChild.name = `${currentPath.join("-")}-index`;
                } else {
                  adjustedChild.path = `/${childName}`;
                  adjustedChild.name = `${currentPath.join("-")}-${childName}`;
                }

                children.push(adjustedChild);
                processedPaths.add(childPath);
              }
            }
          }

          // Recursively process nested layouts first
          await this.processLayoutLevel(
            layoutRoute,
            routeMap,
            pagesDir,
            processedPaths,
            currentPath,
          );

          // Then set children (includes both direct children and nested layouts)
          layoutRoute.children = [...children, ...layoutRoute.children];
          parentNode.children.push(layoutRoute);
          processedPaths.add(relativePath);
        } else if (pathPrefix.length === 0) {
          // Top-level regular file (not a layout)
          parentNode.children.push(route);
          processedPaths.add(relativePath);
        }
      }
    }
  }

  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    return (
      arr1.length === arr2.length && arr1.every((val, i) => val === arr2[i])
    );
  }

  private async hasCorrespondingDirectory(
    fileName: string,
    pagesDir: string,
  ): Promise<boolean> {
    const dirPath = join(pagesDir, fileName);
    try {
      const stats = await stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async createRouteFromFile(
    relativePath: string,
    fullPath: string,
  ): Promise<RouteNode | null> {
    if (!relativePath || !fullPath) return null;

    const pathSegments = this.getPathSegments(relativePath);
    const urlPath = this.convertToUrlPath(pathSegments);
    const params = this.extractParamsFromSegments(pathSegments);
    const name = this.generateRouteName(pathSegments);

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

  private isValidFileName(fileName: string): boolean {
    // Remove extension for checking
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");

    // Allow: a-z, A-Z, 0-9, _, -, [, ], (, ), . (for catch-all routes like [...rest])
    // Reject files with spaces, @, $, and other special characters
    const validPattern = /^[a-zA-Z0-9_\-\[\]().]+$/;

    return validPattern.test(nameWithoutExt);
  }

  private getPathSegments(relativePath: string): string[] {
    const pathWithoutExt = relativePath.replace(/\.[^.]+$/, "");
    return pathWithoutExt.split("/").filter(Boolean);
  }

  private convertToUrlPath(segments: string[]): string {
    const pathParts = segments
      .filter((segment) => segment && segment !== "index")
      .filter((segment) => !this.isGroupSegment(segment))
      .map((segment) => this.convertSegmentToUrlPart(segment));

    const path = "/" + pathParts.join("/");
    return path === "/" ? "/" : path.replace(/\/$/, "");
  }

  private isGroupSegment(segment: string): boolean {
    return (
      segment.startsWith("(") &&
      segment.endsWith(")") &&
      /^\([a-zA-Z0-9_\-]+\)$/.test(segment)
    );
  }

  private convertSegmentToUrlPart(segment: string): string {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const paramName = segment.slice(1, -1);

      if (paramName.startsWith("...")) {
        // Catch-all route
        return "*";
      } else {
        // Dynamic route
        return `:${paramName}`;
      }
    }
    return segment;
  }

  private extractParamsFromSegments(segments: string[]): string[] {
    return segments
      .filter((segment) => segment.startsWith("[") && segment.endsWith("]"))
      .map((segment) => {
        const paramName = segment.slice(1, -1);
        return paramName.startsWith("...") ? paramName.slice(3) : paramName;
      });
  }

  private generateRouteName(segments: string[]): string {
    if (!segments?.length) return "index";

    const nameParts = segments
      .filter((segment) => segment && segment !== "index")
      .filter((segment) => !this.isGroupSegment(segment))
      .map((segment) => this.extractNameFromSegment(segment));

    return nameParts.length > 0 ? nameParts.join("-") : "index";
  }

  private extractNameFromSegment(segment: string): string {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const paramName = segment.slice(1, -1);
      return paramName.startsWith("...")
        ? `catch-${paramName.slice(3)}`
        : paramName;
    }
    return segment;
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

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

    const routeMap = await this.buildRouteMap(files, pagesDir);
    this.organizeRoutesIntoTree(root, routeMap);

    return root;
  }

  private async buildRouteMap(
    files: string[],
    pagesDir: string,
  ): Promise<Map<string, RouteNode>> {
    const routeMap = new Map<string, RouteNode>();

    for (const file of files) {
      try {
        const relativePath = relative(pagesDir, file);
        const route = await this.createRouteFromFile(relativePath, file);
        if (route?.name && route.path !== undefined) {
          routeMap.set(relativePath, route);
        }
      } catch {
        continue;
      }
    }

    return routeMap;
  }

  private organizeRoutesIntoTree(
    root: RouteNode,
    routeMap: Map<string, RouteNode>,
  ): void {
    const layouts = new Map<string, RouteNode>();
    const pages = new Map<string, RouteNode[]>();

    // Group routes by their directory structure
    for (const [relativePath, route] of routeMap) {
      const pathSegments = this.getPathSegments(relativePath);

      if (pathSegments.length === 1) {
        this.handleTopLevelFile(
          pathSegments[0],
          route,
          layouts,
          pages,
          routeMap,
        );
      } else {
        this.handleNestedFile(pathSegments, route, pages);
      }
    }

    // Build the final tree structure
    this.buildFinalTree(root, layouts, pages);
  }

  private getPathSegments(relativePath: string): string[] {
    const pathWithoutExt = relativePath.replace(/\.[^.]+$/, "");
    return pathWithoutExt.split("/").filter(Boolean);
  }

  private handleTopLevelFile(
    layoutKey: string,
    route: RouteNode,
    layouts: Map<string, RouteNode>,
    pages: Map<string, RouteNode[]>,
    routeMap: Map<string, RouteNode>,
  ): void {
    const hasChildrenInDirectory = this.hasChildrenInDirectory(
      layoutKey,
      routeMap,
    );

    if (hasChildrenInDirectory) {
      layouts.set(layoutKey, route);
    } else {
      if (!pages.has("")) pages.set("", []);
      pages.get("")!.push(route);
    }
  }

  private handleNestedFile(
    pathSegments: string[],
    route: RouteNode,
    pages: Map<string, RouteNode[]>,
  ): void {
    const parentKey = pathSegments[0];
    if (!pages.has(parentKey)) pages.set(parentKey, []);

    // Create child route with relative path
    const childRoute = { ...route };
    const childSegments = pathSegments.slice(1);
    childRoute.path = this.convertToUrlPath(childSegments);
    childRoute.name = this.generateRouteName(childSegments);

    pages.get(parentKey)!.push(childRoute);
  }

  private hasChildrenInDirectory(
    layoutKey: string,
    routeMap: Map<string, RouteNode>,
  ): boolean {
    return Array.from(routeMap.keys()).some((path) => {
      const segments = this.getPathSegments(path);
      return segments.length > 1 && segments[0] === layoutKey;
    });
  }

  private buildFinalTree(
    root: RouteNode,
    layouts: Map<string, RouteNode>,
    pages: Map<string, RouteNode[]>,
  ): void {
    // Add regular pages
    const regularPages = pages.get("") || [];
    root.children.push(...regularPages);

    // Add layouts with their children
    for (const [layoutKey, layoutRoute] of layouts) {
      const childPages = pages.get(layoutKey) || [];
      layoutRoute.children = childPages;
      root.children.push(layoutRoute);
    }
  }

  private async createRouteFromFile(
    relativePath: string,
    fullPath: string,
  ): Promise<RouteNode | null> {
    if (!relativePath || !fullPath) return null;

    const pathSegments = this.getPathSegments(relativePath);
    const urlPath = this.convertToUrlPath(pathSegments);
    const params = this.extractParams(pathSegments);
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

  private convertToUrlPath(segments: string[]): string {
    const pathParts = segments
      .filter((segment) => segment && segment !== "index")
      .filter((segment) => !this.isGroupSegment(segment))
      .map((segment) => this.convertSegmentToUrlPart(segment));

    const path = "/" + pathParts.join("/");
    return path === "/" ? "/" : path.replace(/\/$/, "");
  }

  private isGroupSegment(segment: string): boolean {
    return segment.startsWith("(") && segment.endsWith(")");
  }

  private convertSegmentToUrlPart(segment: string): string {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const paramName = segment.slice(1, -1);
      return paramName.startsWith("...") ? "*" : `:${paramName}`;
    }
    return segment;
  }

  private extractParams(segments: string[]): string[] {
    return segments
      .filter((segment) => segment.startsWith("[") && segment.endsWith("]"))
      .map((segment) => {
        const paramName = segment.slice(1, -1);
        return paramName.startsWith("...") ? paramName.slice(3) : paramName;
      });
  }

  private generateRouteName(segments: string[]): string {
    if (!segments?.length) return "home";

    const nameParts = segments
      .filter((segment) => segment && segment !== "index")
      .filter((segment) => !this.isGroupSegment(segment))
      .map((segment) => this.extractNameFromSegment(segment));

    return nameParts.length > 0 ? nameParts.join("-") : "home";
  }

  private extractNameFromSegment(segment: string): string {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const paramName = segment.slice(1, -1);
      return paramName.startsWith("...") ? paramName.slice(3) : paramName;
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

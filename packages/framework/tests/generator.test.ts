import { describe, test, expect, beforeEach } from "bun:test";
import { RouteGenerator } from "../src/generator";
import type { RouteNode, PluginContext } from "../src/types";

describe("RouteGenerator", () => {
  let context: PluginContext;
  let generator: RouteGenerator;

  beforeEach(() => {
    context = {
      root: "/test",
      options: {
        pagesDir: "src/app",
        extensions: [".svelte"],
        importMode: "async",
      },
      cache: new Map(),
    };

    generator = new RouteGenerator(context);
  });

  function createMockRoute(overrides: Partial<RouteNode> = {}): RouteNode {
    return {
      name: "test",
      path: "/test",
      fullPath: "/test",
      componentImport: "./test.svelte",
      children: [],
      meta: {},
      params: [],
      hasComponent: true,
      filePath: "/test/src/app/test.svelte",
      ...overrides,
    };
  }

  test("generates basic routes structure", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "index",
          path: "/",
          componentImport: "./index.svelte",
        }),
        createMockRoute({
          name: "about",
          path: "/about",
          componentImport: "./about.svelte",
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain("export const routes = [");
    expect(result.moduleCode).toContain('name: "index"');
    expect(result.moduleCode).toContain('name: "about"');
    expect(result.moduleCode).toContain('path: "/"');
    expect(result.moduleCode).toContain('path: "/about"');
  });

  test("generates async imports by default", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "index",
          path: "/",
          componentImport: "./index.svelte",
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain('() => import("./index.svelte")');
    expect(result.moduleCode).not.toContain("import Component_");
  });

  test("generates sync imports when configured", () => {
    context.options.importMode = "sync";
    generator = new RouteGenerator(context);

    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "index",
          path: "/",
          componentImport: "./index.svelte",
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain(
      'import Component_0 from "./index.svelte"',
    );
    expect(result.moduleCode).toContain("component: Component_0");
  });

  test("includes route parameters", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "user-id",
          path: "/users/:id",
          params: ["id"],
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain('params: ["id"]');
  });

  test("includes route meta data", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "protected",
          path: "/protected",
          meta: { requiresAuth: true, title: "Protected Page" },
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain(
      'meta: {"requiresAuth":true,"title":"Protected Page"}',
    );
  });

  test("includes route aliases", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "home",
          path: "/home",
          alias: ["/", "/index"],
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain('alias: ["/","/index"]');
  });

  test("handles nested routes with children", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "users",
          path: "/users",
          children: [
            createMockRoute({
              name: "users-index",
              path: "/index",
              componentImport: "./users/index.svelte",
            }),
            createMockRoute({
              name: "users-profile",
              path: "/profile",
              componentImport: "./users/profile.svelte",
            }),
          ],
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain("children: [");
    expect(result.moduleCode).toContain('name: "users-index"');
    expect(result.moduleCode).toContain('name: "users-profile"');
  });

  test("generates helper functions", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain("function flattenRoutes(routes)");
    expect(result.moduleCode).toContain(
      "export function findRouteByName(name)",
    );
    expect(result.moduleCode).toContain(
      "export function generatePath(name, params = {})",
    );
    expect(result.moduleCode).toContain("export function matchRoute(pathname)");
    expect(result.moduleCode).toContain(
      "export function getRouteParams(pathname, route)",
    );
  });

  test("generates virtual module exports", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain("export function useRouter() {");
    expect(result.moduleCode).toContain("export function useRoute() {");
    expect(result.moduleCode).toContain(
      "export function href(strings, ...values) {",
    );
  });

  test("generates type definitions", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "index",
          path: "/",
        }),
        createMockRoute({
          name: "user-id",
          path: "/users/:id",
          params: ["id"],
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.typeDefinitions).toContain('declare module "$oxide"');
    expect(result.typeDefinitions).toContain("export interface RouteRecord");
    expect(result.typeDefinitions).toContain(
      'export type RouteNames = "index" | "user-id"',
    );
    expect(result.typeDefinitions).toContain("export interface RouteParams");
    expect(result.typeDefinitions).toContain(
      '"user-id": {\n  id: string;\n  }',
    );
    expect(result.typeDefinitions).toContain(
      "export function useRouter(): Router",
    );
    expect(result.typeDefinitions).toContain(
      "export function useRoute(): Route",
    );
    expect(result.typeDefinitions).toContain("export function href");
  });

  test("handles catch-all route parameters in types", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "docs-catch-path",
          path: "/docs/*",
          params: ["path"],
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.typeDefinitions).toContain(
      '"docs-catch-path": {\n  path: string;\n  }',
    );
  });

  test("handles routes without parameters", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "static",
          path: "/static",
          params: [],
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.typeDefinitions).toContain('"static": Record<string, never>');
  });

  test("skips non-component routes", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [
        createMockRoute({
          name: "with-component",
          hasComponent: true,
        }),
        createMockRoute({
          name: "without-component",
          hasComponent: false,
        }),
      ],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain('name: "with-component"');
    expect(result.moduleCode).not.toContain('name: "without-component"');
  });

  test("exports routes as default", () => {
    const tree: RouteNode = {
      name: "root",
      path: "",
      fullPath: "",
      componentImport: "",
      children: [],
      meta: {},
      params: [],
      hasComponent: false,
    };

    const result = generator.generate(tree);

    expect(result.moduleCode).toContain("export default routes;");
  });
});

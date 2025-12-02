import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { RouteScanner } from "../src/scanner";
import type { PluginContext } from "../src/types";

describe("RouteScanner", () => {
  const tempDir = join(process.cwd(), "temp-test-scanner");
  const appDir = join(tempDir, "src/app");

  let context: PluginContext;
  let scanner: RouteScanner;

  beforeEach(async () => {
    await mkdir(appDir, { recursive: true });

    context = {
      root: tempDir,
      options: {
        pagesDir: "src/app",
        extensions: [".svelte"],
      },
      cache: new Map(),
    };

    scanner = new RouteScanner(context);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function createFile(path: string, content = "<div>test</div>") {
    const fullPath = join(appDir, path);
    const dir = join(fullPath, "..");
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content);
  }

  test("scans basic route files", async () => {
    await createFile("index.svelte");
    await createFile("about.svelte");

    const result = await scanner.scan();

    expect(result.files).toHaveLength(2);
    expect(result.files.some((f) => f.includes("index.svelte"))).toBe(true);
    expect(result.files.some((f) => f.includes("about.svelte"))).toBe(true);
  });

  test("builds correct route tree for static routes", async () => {
    await createFile("index.svelte");
    await createFile("about.svelte");
    await createFile("contact.svelte");

    const result = await scanner.scan();
    const { tree } = result;

    expect(tree.children).toHaveLength(3);

    const indexRoute = tree.children.find((r) => r.name === "index");
    expect(indexRoute).toBeDefined();
    expect(indexRoute?.path).toBe("/");
    expect(indexRoute?.hasComponent).toBe(true);

    const aboutRoute = tree.children.find((r) => r.name === "about");
    expect(aboutRoute).toBeDefined();
    expect(aboutRoute?.path).toBe("/about");

    const contactRoute = tree.children.find((r) => r.name === "contact");
    expect(contactRoute).toBeDefined();
    expect(contactRoute?.path).toBe("/contact");
  });

  test("handles dynamic routes with parameters", async () => {
    await createFile("users/[id].svelte");
    await createFile("blog/[slug]/comments/[commentId].svelte");

    const result = await scanner.scan();
    const { tree } = result;

    const userRoute = tree.children.find((r) => r.path === "/users/:id");
    expect(userRoute).toBeDefined();
    expect(userRoute?.params).toEqual(["id"]);
    expect(userRoute?.name).toBe("users-id");

    const commentRoute = tree.children.find(
      (r) => r.path === "/blog/:slug/comments/:commentId",
    );
    expect(commentRoute).toBeDefined();
    expect(commentRoute?.params).toEqual(["slug", "commentId"]);
    expect(commentRoute?.name).toBe("blog-slug-comments-commentId");
  });

  test("handles catch-all routes", async () => {
    await createFile("docs/[...path].svelte");
    await createFile("[...notFound].svelte");

    const result = await scanner.scan();
    const { tree } = result;

    const docsRoute = tree.children.find((r) => r.path === "/docs/*");
    expect(docsRoute).toBeDefined();
    expect(docsRoute?.params).toEqual(["path"]);
    expect(docsRoute?.name).toBe("docs-catch-path");

    const catchAllRoute = tree.children.find((r) => r.path === "/*");
    expect(catchAllRoute).toBeDefined();
    expect(catchAllRoute?.params).toEqual(["notFound"]);
    expect(catchAllRoute?.name).toBe("catch-notFound");
  });

  test("handles route groups", async () => {
    await createFile("(auth)/login.svelte");
    await createFile("(auth)/register.svelte");
    await createFile("(dashboard)/stats.svelte");

    const result = await scanner.scan();
    const { tree } = result;

    const loginRoute = tree.children.find((r) => r.path === "/login");
    expect(loginRoute).toBeDefined();
    expect(loginRoute?.name).toBe("login");

    const registerRoute = tree.children.find((r) => r.path === "/register");
    expect(registerRoute).toBeDefined();
    expect(registerRoute?.name).toBe("register");

    const statsRoute = tree.children.find((r) => r.path === "/stats");
    expect(statsRoute).toBeDefined();
    expect(statsRoute?.name).toBe("stats");
  });

  test("identifies layout files correctly", async () => {
    // Create layout and its corresponding directory with children
    await createFile("users.svelte", "<div>{@render children?.()}</div>");
    await createFile("users/index.svelte");
    await createFile("users/profile.svelte");

    const result = await scanner.scan();
    const { tree } = result;

    const usersLayout = tree.children.find((r) => r.name === "users");
    expect(usersLayout).toBeDefined();
    expect(usersLayout?.hasComponent).toBe(true);
    expect(usersLayout?.children).toHaveLength(2);

    const usersIndex = usersLayout?.children.find(
      (r) => r.name === "users-index",
    );
    expect(usersIndex).toBeDefined();
    expect(usersIndex?.path).toBe("/index");

    const usersProfile = usersLayout?.children.find(
      (r) => r.name === "users-profile",
    );
    expect(usersProfile).toBeDefined();
    expect(usersProfile?.path).toBe("/profile");
  });

  test("handles nested layouts", async () => {
    await createFile("dashboard.svelte");
    await createFile("dashboard/settings.svelte");
    await createFile("dashboard/settings/profile.svelte");
    await createFile("dashboard/settings/security.svelte");

    const result = await scanner.scan();
    const { tree } = result;

    const dashboardLayout = tree.children.find((r) => r.name === "dashboard");
    expect(dashboardLayout?.children).toHaveLength(1);

    const settingsLayout = dashboardLayout?.children.find(
      (r) => r.name === "dashboard-settings",
    );
    expect(settingsLayout?.children).toHaveLength(2);
  });

  test("ignores invalid file names", async () => {
    await createFile("valid-file.svelte");
    await createFile("invalid@file.svelte");
    await createFile("another$invalid.svelte");
    await createFile("spaces in name.svelte");

    const result = await scanner.scan();

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toContain("valid-file.svelte");
  });

  test("handles mixed route types correctly", async () => {
    await createFile("index.svelte");
    await createFile("about.svelte");
    await createFile("(auth)/login.svelte");
    await createFile("users/[id].svelte");
    await createFile("docs/[...path].svelte");
    await createFile("api/users.ts"); // Should be ignored (not .svelte)

    const result = await scanner.scan();
    const { tree } = result;

    expect(tree.children).toHaveLength(5);

    const routes = tree.children.map((r) => ({ name: r.name, path: r.path }));
    expect(routes).toContainEqual({ name: "index", path: "/" });
    expect(routes).toContainEqual({ name: "about", path: "/about" });
    expect(routes).toContainEqual({ name: "login", path: "/login" });
    expect(routes).toContainEqual({ name: "users-id", path: "/users/:id" });
    expect(routes).toContainEqual({ name: "docs-catch-path", path: "/docs/*" });
  });

  test("generates correct component imports", async () => {
    await createFile("index.svelte");
    await createFile("users/[id].svelte");

    const result = await scanner.scan();
    const { tree } = result;

    const indexRoute = tree.children.find((r) => r.name === "index");
    expect(indexRoute?.componentImport).toContain("/src/app/index.svelte");

    const userRoute = tree.children.find((r) => r.name === "users-id");
    expect(userRoute?.componentImport).toContain("/src/app/users/[id].svelte");
  });

  test("applies extendRoute hook", async () => {
    context.options.extendRoute = async (route) => ({
      ...route,
      meta: { ...route.meta, custom: true },
    });

    scanner = new RouteScanner(context);

    await createFile("index.svelte");

    const result = await scanner.scan();
    const processedTree = await scanner.applyHooks(result.tree);

    const indexRoute = processedTree.children.find((r) => r.name === "index");
    expect(indexRoute?.meta.custom).toBe(true);
  });

  test("handles empty directory", async () => {
    const result = await scanner.scan();

    expect(result.files).toHaveLength(0);
    expect(result.tree.children).toHaveLength(0);
  });

  test("skips hidden directories and files", async () => {
    await createFile(".hidden/test.svelte");
    await createFile("node_modules/test.svelte");
    await createFile("valid.svelte");

    const result = await scanner.scan();

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toContain("valid.svelte");
  });
});

import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock Svelte context functions
const mockGetContext = mock(() => null as any);
const mockSetContext = mock(() => {});

mock.module("svelte", () => ({
  getContext: mockGetContext,
  setContext: mockSetContext,
}));

describe("Virtual Module", () => {
  let virtualModule: any;

  beforeEach(async () => {
    mockGetContext.mockClear();
    mockSetContext.mockClear();

    // Dynamic import to get fresh module after mocking
    virtualModule = await import("../src/virtual");
  });

  describe("useRouter", () => {
    test("throws error when called outside router context", () => {
      mockGetContext.mockReturnValue(null);

      expect(() => virtualModule.useRouter()).toThrow(
        "useRouter() can only be called within a Router component",
      );
    });

    test("returns router object with navigation methods", () => {
      const mockNavigate = mock(() => {});
      const mockContext = {
        navigate: mockNavigate,
        location: () => ({ pathname: "/users/123", search: "", hash: "" }),
        params: () => ({ id: "123" }),
      };

      mockGetContext.mockReturnValue(mockContext as any);

      const router = virtualModule.useRouter();

      expect(router).toHaveProperty("push");
      expect(router).toHaveProperty("replace");
      expect(router).toHaveProperty("back");
      expect(router).toHaveProperty("forward");

      // Test push method
      router.push("/test");
      expect(mockNavigate).toHaveBeenCalledWith("/test");

      // Test replace method
      router.replace("/new");
      expect(mockNavigate).toHaveBeenCalledWith("/new", { replace: true });
    });

    test("back and forward methods work in browser environment", () => {
      const mockNavigate = mock(() => {});
      const mockContext = {
        navigate: mockNavigate,
        location: () => ({ pathname: "/", search: "", hash: "" }),
        params: () => ({}),
      };

      mockGetContext.mockReturnValue(mockContext as any);

      // Mock window.history
      const mockHistory = {
        back: mock(() => {}),
        forward: mock(() => {}),
      };

      Object.defineProperty(global, "window", {
        value: { history: mockHistory },
        writable: true,
      });

      const router = virtualModule.useRouter();

      router.back();
      expect(mockHistory.back).toHaveBeenCalled();

      router.forward();
      expect(mockHistory.forward).toHaveBeenCalled();
    });
  });

  describe("useRoute", () => {
    test("throws error when called outside router context", () => {
      mockGetContext.mockReturnValue(null);

      expect(() => virtualModule.useRoute()).toThrow(
        "useRoute() can only be called within a Router component",
      );
    });

    test("returns route object with location, params, and query", () => {
      const mockLocation = {
        pathname: "/users/123",
        search: "?tab=profile&sort=name",
        hash: "#section1",
      };

      const mockParams = {
        id: "123",
      };

      const mockContext = {
        navigate: mock(() => {}),
        location: () => mockLocation,
        params: () => mockParams,
      };

      mockGetContext.mockReturnValue(mockContext);

      const route = virtualModule.useRoute();

      expect(route.location).toEqual(mockLocation);
      expect(route.params).toEqual(mockParams);
      expect(route.query).toBeInstanceOf(URLSearchParams);
      expect(route.query.get("tab")).toBe("profile");
      expect(route.query.get("sort")).toBe("name");
    });

    test("handles empty search params", () => {
      const mockLocation = {
        pathname: "/home",
        search: "",
        hash: "",
      };

      const mockContext = {
        navigate: mock(() => {}),
        location: () => mockLocation,
        params: () => ({}),
      };

      mockGetContext.mockReturnValue(mockContext);

      const route = virtualModule.useRoute();

      expect(route.query.toString()).toBe("");
    });
  });

  describe("href", () => {
    test("constructs basic URLs", () => {
      const result = virtualModule.href`/users/123`;
      expect(result).toBe("/users/123");
    });

    test("interpolates string values with URL encoding", () => {
      const userId = "user@example.com";
      const result = virtualModule.href`/users/${userId}`;
      expect(result).toBe("/users/user%40example.com");
    });

    test("handles URLSearchParams objects", () => {
      const params = new URLSearchParams({ q: "search term", page: "2" });
      const result = virtualModule.href`/search?${params}`;
      expect(result).toBe("/search?q=search+term&page=2");
    });

    test("handles array values by joining with slash", () => {
      const pathSegments = ["docs", "api", "reference"];
      const result = virtualModule.href`/${pathSegments}/overview`;
      expect(result).toBe("/docs/api/reference/overview");
    });

    test("handles multiple interpolations", () => {
      const category = "electronics";
      const productId = "123";
      const tab = "reviews";
      const result = virtualModule.href`/shop/${category}/products/${productId}?tab=${tab}`;
      expect(result).toBe("/shop/electronics/products/123?tab=reviews");
    });

    test("handles complex mixed interpolations", () => {
      const segments = ["api", "v1"];
      const resourceId = "test@resource";
      const params = new URLSearchParams({
        include: "metadata",
        format: "json",
      });

      const result = virtualModule.href`/${segments}/resources/${resourceId}?${params}`;
      expect(result).toBe(
        "/api/v1/resources/test%40resource?include=metadata&format=json",
      );
    });

    test("handles empty interpolations gracefully", () => {
      const emptyString = "";
      const emptyArray: string[] = [];
      const result = virtualModule.href`/path/${emptyString}/more/${emptyArray}/end`;
      expect(result).toBe("/path//more//end");
    });

    test("converts non-string values to strings", () => {
      const numberId = 42;
      const boolValue = true;
      const result = virtualModule.href`/items/${numberId}/active/${boolValue}`;
      expect(result).toBe("/items/42/active/true");
    });
  });

  describe("setRouterContext", () => {
    test("calls setContext with correct key and value", () => {
      const mockContext = {
        navigate: mock(() => {}),
        location: () => ({ pathname: "/", search: "", hash: "" }),
        params: () => ({}),
      };

      virtualModule.setRouterContext(mockContext);

      expect(mockSetContext).toHaveBeenCalledWith(
        expect.any(Symbol),
        mockContext,
      );
    });
  });

  describe("TypeScript interfaces", () => {
    test("Location interface properties", () => {
      const location: typeof virtualModule.Location = {
        pathname: "/test",
        search: "?q=test",
        hash: "#section",
      };

      expect(typeof location.pathname).toBe("string");
      expect(typeof location.search).toBe("string");
      expect(typeof location.hash).toBe("string");
    });

    test("RouteParams interface", () => {
      const params: typeof virtualModule.RouteParams = {
        id: "123",
        slug: "test-post",
      };

      expect(typeof params.id).toBe("string");
      expect(typeof params.slug).toBe("string");
    });

    test("Route interface properties", () => {
      const mockLocation = { pathname: "/", search: "", hash: "" };
      const mockParams = { id: "123" };
      const mockQuery = new URLSearchParams();

      const route: typeof virtualModule.Route = {
        location: mockLocation,
        params: mockParams,
        query: mockQuery,
      };

      expect(route.location).toBe(mockLocation);
      expect(route.params).toBe(mockParams);
      expect(route.query).toBe(mockQuery);
    });

    test("Router interface methods", () => {
      const router: typeof virtualModule.Router = {
        push: mock(() => {}),
        replace: mock(() => {}),
        back: mock(() => {}),
        forward: mock(() => {}),
      };

      expect(typeof router.push).toBe("function");
      expect(typeof router.replace).toBe("function");
      expect(typeof router.back).toBe("function");
      expect(typeof router.forward).toBe("function");
    });
  });
});

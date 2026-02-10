export interface OxideConfig {
  routesDir?: string;
  trailingSlash?: "never" | "always" | "ignore";
}

let config: OxideConfig = {
  routesDir: "src/routes",
  trailingSlash: "never",
};

export function setConfig(newConfig: Partial<OxideConfig>): void {
  config = { ...config, ...newConfig };
}

export function getConfig(): OxideConfig {
  return { ...config };
}

export function normalizePathWithTrailingSlash(
  pathname: string,
  trailingSlash: "never" | "always" | "ignore",
): string {
  if (trailingSlash === "ignore") {
    return pathname;
  }

  if (pathname === "/") {
    return "/";
  }

  const hasTrailingSlash = pathname.endsWith("/");

  if (trailingSlash === "always" && !hasTrailingSlash) {
    return pathname + "/";
  }

  if (trailingSlash === "never" && hasTrailingSlash) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function shouldRedirectForTrailingSlash(
  pathname: string,
  trailingSlash: "never" | "always" | "ignore",
): boolean {
  if (trailingSlash === "ignore" || pathname === "/") {
    return false;
  }

  const hasTrailingSlash = pathname.endsWith("/");

  return (
    (trailingSlash === "always" && !hasTrailingSlash) ||
    (trailingSlash === "never" && hasTrailingSlash)
  );
}

export function getCanonicalUrl(
  pathname: string,
  search: string,
  hash: string,
  trailingSlash: "never" | "always" | "ignore",
): string {
  const normalizedPath = normalizePathWithTrailingSlash(pathname, trailingSlash);
  return normalizedPath + search + hash;
}

export function parseRouteParams(path: string, matched: any): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};

  if (!matched || !matched.params) {
    return params;
  }

  for (const [key, value] of Object.entries(matched.params)) {
    if (path.includes(`**:${key}`)) {
      const segments = typeof value === "string" ? value.split("/").filter(Boolean) : [];
      params[key] = segments;
    } else {
      params[key] = value as string;
    }
  }

  return params;
}

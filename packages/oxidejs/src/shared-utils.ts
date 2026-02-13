export function parseRouteParams(
  path: string,
  matched: { params?: Record<string, string | string[]> },
): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};

  if (!matched?.params) {
    return params;
  }

  for (const [key, value] of Object.entries(matched.params)) {
    if (path.includes(`**:${key}`)) {
      params[key] = Array.isArray(value) ? value : String(value).split("/").filter(Boolean);
    } else {
      params[key] = Array.isArray(value) ? value[0] || "" : String(value);
    }
  }

  return params;
}

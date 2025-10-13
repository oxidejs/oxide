declare module "virtual:oxide-routes" {
  export interface RouteRecord {
    name: string;
    path: string;
    component: any;
    params?: string[];
    meta?: Record<string, any>;
    alias?: string[];
    children?: RouteRecord[];
  }

  export const routes: RouteRecord[];
  export default routes;

  export function findRouteByName(name: string): RouteRecord | null;
  export function generatePath(
    name: string,
    params?: Record<string, any>,
  ): string;
  export function getRouteParams(path: string): {
    route: RouteRecord | null;
    params: Record<string, string>;
  };
}

export type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractRouteParams<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
      ? { [K in Param]: string }
      : T extends `${infer _Start}[...${infer Param}]${infer _End}`
        ? { [K in Param]: string[] }
        : {};

export interface RouteLocation<T extends string = string> {
  name: T;
  path: string;
  params: ExtractRouteParams<T>;
  query: Record<string, string>;
  hash: string;
  meta: Record<string, any>;
}

declare global {
  namespace OxideRouter {
    interface RouteNameMap {}
    type RouteNames = keyof RouteNameMap extends never
      ? string
      : keyof RouteNameMap;
  }
}

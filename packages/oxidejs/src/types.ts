export type Route = {
  path: string;
  handler: string;
  load?: () => Promise<any>;
};

export type Layout = {
  handler: string;
  level: number;
};

export type RouteWithLayouts = {
  route: Route;
  layouts: Layout[];
};

export interface RouteManifest {
  routes?: Route[];
  layouts?: Layout[];
  importRoute?(handler: string): Promise<{ default: any }>;
  importRouteAssets?(handler: string): Promise<any>;
  LayoutRenderer?: any;
}

declare module "#oxide/routes" {
  export interface Route {
    path: string;
    handler: string;
  }

  export interface Layout {
    handler: string;
    level: number;
  }

  export interface RoutesManifest {
    routes?: Route[];
    layouts?: Layout[];
    importRoute?(handler: string): Promise<{ default: any }>;
    importRouteAssets?(handler: string): Promise<any>;
  }

  const manifest: RoutesManifest;
  export default manifest;
}

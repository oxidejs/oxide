import { Route, Layout } from "./types.js";

declare global {
  interface Window {
    __OXIDE_ROUTES__: Route[];
    __OXIDE_LAYOUTS__: Layout[];
    __OXIDE_ROUTER__: () => any;
  }
}

declare module "#oxide/router" {
  export const routes: Route[];
  export const layouts: Layout[];
  export function importRoute(handler: string): Promise<any>;
  export function importRouteAssets(handler: string): Promise<any>;
}

export {};

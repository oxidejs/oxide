import { Route } from "./types";

declare global {
  interface Window {
    __ROUTES__: Route[];
  }
}

export {};

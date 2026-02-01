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

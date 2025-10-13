export interface FsRouterOptions {
  pagesDir?: string;
  dir?: string;
  extensions?: string[];
  importMode?: "async" | "sync";
  virtualId?: string;
  routeBlock?: boolean;
  dts?: string | boolean;
  extendRoute?: (route: RouteNode) => RouteNode | Promise<RouteNode>;
  beforeWriteRoutes?: (
    routes: RouteNode[],
  ) => RouteNode[] | Promise<RouteNode[]>;
  routeNameGenerator?: (route: RouteNode) => string;
  routeGroups?: boolean;
}

export interface RouteNode {
  name: string;
  path: string;
  fullPath: string;
  componentImport: string;
  children: RouteNode[];
  meta: Record<string, any>;
  alias?: string[];
  params: string[];
  hasComponent: boolean;
  filePath?: string;
}

export interface RouteRecord {
  name: string;
  path: string;
  component: any;
  params?: string[];
  meta?: Record<string, any>;
  alias?: string[];
  children?: RouteRecord[];
}

export interface PluginContext {
  options: FsRouterOptions;
  root: string;
  cache: Map<string, any>;
  watcher?: any;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface ScanResult {
  files: string[];
  tree: RouteNode;
}

export interface GeneratedCode {
  moduleCode: string;
  typeDefinitions: string;
}

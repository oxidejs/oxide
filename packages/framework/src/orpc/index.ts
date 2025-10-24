// ORPC functionality is now integrated into the main OxidePlugin
// Import from the main plugin instead
export type { RouterInfo, RouterScanOptions } from "./routers";
export {
  scanRouters,
  generateImports,
  buildRouterObject,
  buildRouterTypes,
} from "./routers";
export type { ClientGenerationOptions } from "./client";
export {
  generateClientCode,
  generateTypeDefinitions,
  generateEmptyTypeDefinitions,
} from "./client";

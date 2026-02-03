import path from "node:path";
import { oxideNitroPlugin } from "./nitro-plugin.js";

interface WithOxideOptions {
  routesDir?: string;
}

export function withOxide(options: WithOxideOptions = {}) {
  const routesDir = options.routesDir || path.join(process.cwd(), "src/routes");

  return {
    noExternals: true,
    serverDir: "src",
    renderer: {
      handler: "src/renderer.ts",
    },
    errorHandler: "src/error.ts",
    ...oxideNitroPlugin({ routesDir }),
  };
}

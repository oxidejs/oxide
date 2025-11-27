import type { RouterInfo } from "./routers.js";

export interface ClientGenerationOptions {
  routers: RouterInfo[];
  routerObject: string;
  imports: string;
  ssr: boolean;
  clientUrl?: string;
}

function generateUrlReturn(clientUrl?: string): string {
  return clientUrl
    ? `    return '${clientUrl}';`
    : "    return `${window.location.origin}/rpc`;";
}

function generateLinkConfig(
  clientUrl: string | undefined,
  ssr: boolean,
): string[] {
  if (ssr) {
    return [
      "const link = new RPCLink({",
      "  url: () => {",
      "    if (typeof window === 'undefined') {",
      "      throw new Error('RPCLink is not allowed on the server side.');",
      "    }",
      generateUrlReturn(clientUrl),
      "  },",
      "});",
    ];
  } else {
    return [
      "const link = new RPCLink({",
      clientUrl
        ? `  url: '${clientUrl}',`
        : "  url: `${window.location.origin}/rpc`,",
      "});",
    ];
  }
}

function generateSSRSetup(): string[] {
  return [
    "// Server-side client setup",
    "if (import.meta.env.SSR && typeof globalThis !== 'undefined' && !globalThis.$orpcClient) {",
    "  globalThis.$orpcClient = createRouterClient(router);",
    "}",
  ];
}

function generateClientSideSetup(
  clientUrl: string | undefined,
  ssr: boolean,
): string[] {
  return [
    "// Client-side client setup",
    ...generateLinkConfig(clientUrl, ssr),
    "",
    "const clientSideClient = createORPCClient(link);",
  ];
}

function generateClientCode_Internal(
  routerObject: string,
  imports: string,
  ssr: boolean,
  clientUrl?: string,
): string {
  const parts: string[] = [];

  // Add imports
  if (imports) {
    parts.push(imports);
  }

  // Add required imports based on SSR mode
  if (ssr) {
    parts.push(
      "import { createRouterClient, os } from '@orpc/server';",
      "import { createORPCClient } from '@orpc/client';",
      "import { RPCLink } from '@orpc/client/fetch';",
    );
    parts.push("", `export const router = os.router(${routerObject});`);
  } else {
    parts.push(
      "import { createORPCClient } from '@orpc/client';",
      "import { RPCLink } from '@orpc/client/fetch';",
    );
    parts.push("", `export const router = ${routerObject};`);
  }

  if (ssr) {
    parts.push("", ...generateSSRSetup());
  }

  parts.push("", ...generateClientSideSetup(clientUrl, ssr));

  // Add client export
  const clientExport = ssr
    ? "export const client = globalThis.$orpcClient ?? clientSideClient;"
    : "export const client = createORPCClient(link);";

  parts.push("", clientExport, "", "export default { router, client };");

  return parts.join("\n");
}

export function generateClientCode(options: ClientGenerationOptions): string {
  const { routers, routerObject, imports, ssr, clientUrl } = options;

  if (routers.length === 0) {
    return generateClientCode_Internal("{}", "", ssr, clientUrl);
  }

  return generateClientCode_Internal(routerObject, imports, ssr, clientUrl);
}

export function generateEmptyClientCode(options: {
  ssr: boolean;
  clientUrl?: string;
}): string {
  const { ssr, clientUrl } = options;
  return generateClientCode_Internal("{}", "", ssr, clientUrl);
}

function generateGlobalDeclaration(ssr: boolean): string {
  return ssr
    ? `

declare global {
  var $orpcClient: import('@orpc/server').RouterClient<typeof import('$oxide').router> | undefined;
}`
    : "";
}

function generateModuleDeclaration(routerType: string, ssr: boolean): string {
  return `declare module "$oxide" {
  import type { RouterClient, Router } from '@orpc/server';

  export const router: Router<${routerType}, any>;

  export const rpc: RouterClient<typeof router>;
}${generateGlobalDeclaration(ssr)}`;
}

export function generateTypeDefinitions(options: {
  routerTypes: string;
  ssr: boolean;
}): string {
  const { routerTypes, ssr } = options;
  return generateModuleDeclaration(routerTypes, ssr);
}

export function generateEmptyTypeDefinitions(options: {
  ssr: boolean;
}): string {
  const { ssr } = options;
  return generateModuleDeclaration("Record<string, never>", ssr);
}

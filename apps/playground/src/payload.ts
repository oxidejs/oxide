import type { H3Event } from "nitro/h3";
import { OxideHandler } from "oxidejs";
import routesManifest from "#oxide/routes";

let oxideHandler: OxideHandler;

export default async function payloadHandler(event: H3Event) {
  try {
    if (!oxideHandler) {
      oxideHandler = new OxideHandler({ routesManifest });
    }

    if (!event.node?.req?.headers["x-oxide-navigation"]) {
      if (event.node?.req?.headers) {
        event.node.req.headers["x-oxide-navigation"] = "true";
      }
    }

    const { response } = await oxideHandler.handle(event);

    const body = await response.text();
    const headers = Object.fromEntries(response.headers.entries());

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Payload handler error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to generate navigation payload",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}

import { type H3Event, HTTPError } from "nitro/h3";
import { OxideHandler } from "oxidejs/nitro";
import routesManifest from "#oxide/routes";

const oxideHandler = new OxideHandler({ routesManifest });

async function renderer(event: H3Event) {
  const { matched, response } = await oxideHandler.handle(event);
  if (matched) {
    return response;
  }
  throw HTTPError.status(404);
}

export default renderer;

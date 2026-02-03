import { HTTPError } from "nitro/h3";
import { OxideHandler } from "oxidejs";
import routesManifest from "#oxide/routes";

const oxideHandler = new OxideHandler({ routesManifest });

async function renderer(event: any) {
  const { matched, response } = await oxideHandler.handle(event);
  if (matched) {
    return response;
  }
  throw HTTPError.status(404);
}

export default renderer;

import type { H3Event } from "nitro/h3";
import { OxideHandler } from "oxidejs";

const oxideHandler = new OxideHandler();

async function renderer(event: H3Event) {
  const { matched, response } = await oxideHandler.handle(event);
  if (matched) {
    return response;
  }
  return new Response("Not Found", { status: 404 });
}

export default renderer;

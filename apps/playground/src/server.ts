import { router } from "$oxide/server";
import { type H3Event, HTTPError } from "nitro/h3";
import { OxideHandler } from "oxidejs/nitro";

const oxideHandler = new OxideHandler({ router });

async function fetch(event: H3Event) {
  const { matched, response } = await oxideHandler.handle(event);
  if (matched) {
    return response;
  }
  throw HTTPError.status(404);
}

export default {
  fetch,
};

import { router } from "$oxide/server";
import { HTTPError } from "nitro/h3";
import { OxideHandler } from "oxidejs/nitro";

const oxideHandler = new OxideHandler({ router });

async function fetch(request: Request) {
  const { matched, response } = await oxideHandler.handle(request);
  if (matched) {
    return response;
  }
  throw HTTPError.status(404);
}

export default {
  fetch,
};

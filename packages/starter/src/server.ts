import App from "./app.svelte";
import { OxideHandler } from "@oxidejs/framework";

const oxide = new OxideHandler({ app: App });

export default {
  async fetch(req: Request) {
    const { matched, response } = await oxide.handle(req);
    if (matched) {
      return response;
    }
    return new Response("Not Found", { status: 404 });
  },
};

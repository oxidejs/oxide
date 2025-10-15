import { os } from "@orpc/server";

export default {
  ping: os.handler(async () => "pong"),
};

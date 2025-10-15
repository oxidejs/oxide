import { os } from "@orpc/server";

export default {
  hello: os.handler(async () => "world"),
};

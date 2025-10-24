import { os } from "@orpc/server";
import { z } from "zod";

export default {
  ping: os.handler(async () => "pong"),
  greet: os
    .input(z.object({ name: z.string() }))
    .handler(async ({ input }) => `Hello, ${input.name}`),
  redirect: os.handler(async () => {
    console.log(typeof window);
    throw new Error("unauthorized");
  }),
};

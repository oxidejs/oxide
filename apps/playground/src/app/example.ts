import { base } from "$lib/orpc";
import { z } from "zod";

export default {
  ping: base.handler(async () => "pong"),
  greet: base
    .input(z.object({ name: z.string() }))
    .handler(async ({ input }) => `Hello, ${input.name}`),
  redirect: base.handler(async ({ errors }) => {
    throw errors.UNAUTHORIZED();
  }),
  set: base
    .input(z.object({ value: z.string() }))
    .handler(async ({ input, context }) => {
      await context.kv.setItem("key", input.value);
      return "ok";
    }),
  get: base.handler(async ({ context }) => {
    const value = await context.kv.getItem("key");
    return value ?? "not found";
  }),
};

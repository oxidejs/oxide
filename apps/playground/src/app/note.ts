import { base, type } from "$lib/orpc";
import { note } from "$lib/schema";
import { db } from "$lib/db";

export const router = {
  create: base
    .input(type<{ name: string; content: string }>())
    .handler(async ({ input, context, errors }) => {
      if (!context.user) return errors.UNAUTHORIZED();
      const result = await db.insert(note).values({
        name: input.name,
        content: input.content,
        userId: context.user?.id,
      });
      return result;
    }),
};

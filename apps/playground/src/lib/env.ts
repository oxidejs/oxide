import "dotenv/config";
import { z } from "zod";

export const env = {
  public: z
    .object({
      VITE_API_URL: z.url(),
    })
    .parse(import.meta.env),
  private: z
    .object({
      DATABASE_URL: z.string(),
      BETTER_AUTH_SECRET: z.string(),
    })
    .parse(process.env),
};

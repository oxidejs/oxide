import { z } from "zod";

// Define your environment variables here

const PublicEnv = z.object({
  VITE_API_URL: z.string(),
});

const PrivateEnv = z.object({
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string(),
});

// Infer types from schemas

type PublicEnvType = z.infer<typeof PublicEnv>;
type PrivateEnvType = z.infer<typeof PrivateEnv>;

const publicEnv = import.meta.env.SSR
  ? PublicEnv.parse(process.env)
  : PublicEnv.parse(import.meta.env);

const privateEnv = import.meta.env.SSR ? PrivateEnv.parse(process.env) : null;

export const getPublicEnv = (): PublicEnvType => publicEnv;

export const getPrivateEnv = (): PrivateEnvType => {
  if (!import.meta.env.SSR || !privateEnv) {
    throw new Error("Private env can only be accessed server-side");
  }
  return privateEnv;
};

export const env = {
  public: publicEnv,
  get private() {
    return getPrivateEnv();
  },
};

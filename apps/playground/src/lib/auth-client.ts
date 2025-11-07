import { createAuthClient } from "better-auth/svelte";
import { env } from "./env";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: env.public.VITE_API_URL,
  plugins: [emailOTPClient()],
});

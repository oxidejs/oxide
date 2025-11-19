import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { emailOTP } from "better-auth/plugins";
import { env } from "./env";

export const auth = betterAuth({
  baseURL: env.public.VITE_API_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "sign-in") {
          console.log(">>>OTP", email, otp);
        }
      },
    }),
  ],
});

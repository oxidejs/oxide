import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { env } from "./env";

const client = createClient({ url: env.private.DATABASE_URL });
export const db = drizzle({ client });
export type Database = typeof db;

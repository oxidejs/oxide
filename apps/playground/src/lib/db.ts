import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { env } from "./env";
import * as schema from "./schema";

const client = createClient({ url: env.private.DATABASE_URL });
export const db = drizzle({ client, schema });
export type Database = typeof db;

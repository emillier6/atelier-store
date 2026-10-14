import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  /*
   * Guards the HTTP routes under /api/auth (on by default only in production;
   * defaults: 100 requests per 10s, 3 per 10s on /sign-in and /sign-up). It
   * never sees the Server Actions' direct auth.api calls, which use
   * src/lib/rate-limit.ts. "memory" is per instance; "database" would need a
   * rateLimit table, and "secondary-storage" a store such as Redis.
   */
  rateLimit: { enabled: true, storage: "memory" },
  // nextCookies must stay last so it can set cookies from server actions.
  plugins: [nextCookies()],
});

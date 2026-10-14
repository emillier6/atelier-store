import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      /*
       * input: false keeps it out of sign-up and of /api/auth/update-user,
       * which any signed-in user can call: without it, anyone could make
       * themselves admin. Only `pnpm db:make-admin` sets it.
       */
      role: {
        type: ["customer", "admin"],
        required: false,
        defaultValue: "customer",
        input: false,
      },
    },
  },
  /*
   * Guards the HTTP routes under /api/auth (on by default only in production;
   * defaults: 100 requests per 10s, 3 per 10s on /sign-in and /sign-up). It
   * never sees the Server Actions' direct auth.api calls, which use
   * src/lib/rate-limit.ts. "database" keeps the counters in the shared
   * rate_limit table (model `rateLimit` in src/db/schema.ts), so the limits
   * hold across server instances; rate-limit.ts keeps its own buckets there
   * under an "action:" prefix (Better Auth's keys are `<ip>|<path>`).
   */
  rateLimit: { enabled: true, storage: "database" },
  // nextCookies must stay last so it can set cookies from server actions.
  plugins: [nextCookies()],
});

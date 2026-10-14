import "server-only";
import { getIP } from "better-auth/api";
import { and, eq, like, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";
import { auth } from "@/lib/auth";

/*
 * Throttling for the auth Server Actions. Better Auth's own limiter only runs
 * in its HTTP router (/api/auth/*); direct auth.api.* calls skip it, so the
 * actions consume a bucket here before calling Better Auth.
 *
 * Buckets are fixed windows kept in the shared `rate_limit` table, so the
 * limits hold across every server instance and survive restarts. Better
 * Auth's limiter (storage "database" in auth.ts) uses the same table; our keys
 * all start with KEY_PREFIX, and Better Auth's are `<ip>|<path>`, so they
 * never collide.
 *
 * For our rows `last_request` holds the window's END (ms since epoch), not a
 * request time. Better Auth prunes every row whose last_request is older than
 * its longest window (about a minute) whenever one of its windows rolls over;
 * storing the end means it only ever deletes our buckets once they've expired,
 * instead of quietly resetting a 15-minute sign-in window after a minute.
 */

export type RateLimitRule = {
  /** Window length in seconds. */
  window: number;
  /** Attempts allowed per window. */
  max: number;
};

const KEY_PREFIX = "action:";

/** Share of consume() calls that also delete expired buckets. */
const PRUNE_PROBABILITY = 0.01;

/**
 * Counts one attempt against `key`. Returns false once the window's budget is
 * spent; the attempt is still counted, so hammering doesn't shorten the wait.
 *
 * One upsert does the read, the window check and the increment, so concurrent
 * attempts on any instance are all counted (no read-then-write race).
 *
 * If the database call fails this fails OPEN (logs and allows): a DB blip
 * shouldn't lock every customer out of sign-in. While the DB is down, sign-in
 * can't succeed anyway (Better Auth reads the user from it), and the password
 * check and Better Auth's HTTP limiter still apply.
 *
 * `now` is injectable for tests; production callers omit it.
 */
export async function consume(
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<boolean> {
  const windowEnd = now + rule.window * 1000;
  try {
    const [row] = await db
      .insert(rateLimit)
      .values({ key: KEY_PREFIX + key, count: 1, lastRequest: windowEnd })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: {
          // Window over: start a new one with this attempt. Otherwise count it.
          count: sql`case when ${rateLimit.lastRequest} <= ${now} then 1 else ${rateLimit.count} + 1 end`,
          lastRequest: sql`case when ${rateLimit.lastRequest} <= ${now} then ${windowEnd} else ${rateLimit.lastRequest} end`,
        },
      })
      .returning({ count: rateLimit.count });

    if (Math.random() < PRUNE_PROBABILITY) {
      // Not awaited: housekeeping stays off the attempt's latency.
      void pruneRateLimits().catch((error) =>
        console.error("rate-limit: prune failed", error),
      );
    }
    return row.count <= rule.max;
  } catch (error) {
    console.error("rate-limit: consume failed, allowing the attempt", error);
    return true;
  }
}

/** Forgets `key`, e.g. an account's failed sign-ins after a success. */
export async function reset(key: string) {
  try {
    await db.delete(rateLimit).where(eq(rateLimit.key, KEY_PREFIX + key));
  } catch (error) {
    // The bucket just expires on its own; not worth failing a sign-in over.
    console.error("rate-limit: reset failed", error);
  }
}

/**
 * Deletes our expired buckets. consume() runs it on about 1% of calls; Better
 * Auth prunes its own rows (and ours, once expired) itself. Always uses the
 * real clock, never a test's injected `now`.
 */
export async function pruneRateLimits() {
  await db
    .delete(rateLimit)
    .where(
      and(
        like(rateLimit.key, `${KEY_PREFIX}%`),
        lt(rateLimit.lastRequest, Date.now()),
      ),
    );
}

/**
 * The client IP, read the way Better Auth's limiter reads it (x-forwarded-for
 * by default, `advanced.ipAddress` in auth.ts to change that). When it can't
 * be trusted every such request shares one bucket, as Better Auth does: this
 * fails closed rather than letting unknown clients through unthrottled.
 */
export function clientKey(requestHeaders: Headers) {
  return getIP(requestHeaders, auth.options) ?? "unknown-ip";
}

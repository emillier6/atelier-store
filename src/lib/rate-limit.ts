import "server-only";
import { getIP } from "better-auth/api";
import { auth } from "@/lib/auth";

/*
 * Throttling for the auth Server Actions. Better Auth's own limiter only runs
 * in its HTTP router (/api/auth/*); direct auth.api.* calls skip it, so the
 * actions consume a bucket here before calling Better Auth.
 *
 * The store is an in-memory fixed window, so the limits hold per server
 * instance: a deployment with several instances (or a cold start) gives an
 * attacker a fresh budget on each. A shared store (Redis via Better Auth's
 * secondaryStorage, or a table) is needed to make them global.
 */

export type RateLimitRule = {
  /** Window length in seconds. */
  window: number;
  /** Attempts allowed per window. */
  max: number;
};

type Bucket = { count: number; resetAt: number };

const MAX_BUCKETS = 10_000;

// On globalThis so dev hot reloads don't hand out a fresh budget.
const store: Map<string, Bucket> = ((
  globalThis as { __authRateLimit?: Map<string, Bucket> }
).__authRateLimit ??= new Map());

function prune(now: number) {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key);
  }
  // Still full of live buckets: drop the oldest rather than grow forever.
  for (const key of store.keys()) {
    if (store.size < MAX_BUCKETS) break;
    store.delete(key);
  }
}

/**
 * Counts one attempt against `key`. Returns false once the window's budget is
 * spent; the attempt is still counted, so hammering doesn't shorten the wait.
 */
export function consume(key: string, rule: RateLimitRule) {
  const now = Date.now();
  if (store.size >= MAX_BUCKETS) prune(now);

  const bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + rule.window * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= rule.max;
}

/** Forgets `key`, e.g. an account's failed sign-ins after a success. */
export function reset(key: string) {
  store.delete(key);
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

import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";

/**
 * The signed-in customer, or null. Reading the session hits the database;
 * cache() shares one read per request between layouts, pages and actions.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

/** Where `?next=` lands when it is missing or untrustworthy. */
const FALLBACK_PATH = "/";
const MAX_NEXT_LENGTH = 512;

/**
 * `?next=` comes from the URL, and redirecting to an attacker's string right
 * after sign-in is an open redirect. Only same-origin absolute paths pass:
 * `//evil.com` and `/\evil.com` start with "/" but browsers treat both as
 * another origin.
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > MAX_NEXT_LENGTH) {
    return FALLBACK_PATH;
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return FALLBACK_PATH;
  }
  if (/[\u0000-\u001f\u007f]/.test(raw)) return FALLBACK_PATH;
  return raw;
}

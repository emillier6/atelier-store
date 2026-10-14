import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
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

/**
 * The signed-in customer, or a redirect to /sign-in that comes back to
 * `nextPath`. This is the check that protects a page or action.
 */
export async function requireUser(nextPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/**
 * The signed-in admin. Signed-out visitors go to /sign-in like requireUser;
 * signed-in customers get a 404, so /admin doesn't admit it exists. There is
 * no proxy.ts, layouts don't re-run on every navigation and Server Actions
 * can be POSTed to directly, so every admin page, action and query calls
 * this itself.
 */
export async function requireAdmin(nextPath: string) {
  const user = await requireUser(nextPath);
  if (user.role !== "admin") notFound();
  return user;
}

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

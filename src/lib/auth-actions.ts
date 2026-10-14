"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  type AuthFormState,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth-form-state";
import {
  clientKey,
  consume,
  type RateLimitRule,
  reset,
} from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/session";

/*
 * Server Actions call auth.api.* directly; nextCookies() in src/lib/auth.ts
 * writes the session cookie on the action's response. Actions can be POSTed
 * to without our forms, so every input is validated here, not in the markup.
 *
 * Better Auth's rate limiter only runs on its HTTP routes (/api/auth/*), so
 * these calls would be unthrottled; src/lib/rate-limit.ts limits them instead
 * (in the shared rate_limit table, see there).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
/** Better Auth's own maximum; the minimum is shared with the form. */
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 80;

/**
 * One message for every sign-in failure. Better Auth already answers the same
 * way for an unknown email and a wrong password; saying which would let anyone
 * test whether an address has an account.
 */
const SIGN_IN_ERROR = "Email or password is incorrect.";
/** Same text for every bucket, so it says nothing about the account. */
const RATE_LIMIT_ERROR = "Too many attempts. Try again in a few minutes.";

/** Per client IP: a few typos are fine, a guessing script is not. */
const SIGN_IN_PER_IP: RateLimitRule = { window: 60, max: 5 };
/**
 * Per address, from any IP: caps guessing spread over many IPs (or a spoofed
 * x-forwarded-for). An attacker can use it to block an address's sign-in for
 * up to 15 minutes, which beats letting the guessing through.
 */
const SIGN_IN_PER_EMAIL: RateLimitRule = { window: 15 * 60, max: 10 };
const SIGN_UP_PER_IP: RateLimitRule = { window: 60 * 60, max: 5 };

const PASSWORD_LENGTH_ERROR = `Choose a password between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Lower-cased address, or null if it can't be one. */
function readEmail(formData: FormData) {
  const email = readText(formData, "email").toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email)
    ? email
    : null;
}

/** Never trimmed: spaces are part of the password. */
function readPassword(formData: FormData) {
  const password = formData.get("password");
  return typeof password === "string" &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH
    ? password
    : null;
}

function errorCode(error: unknown) {
  if (!isAPIError(error)) return null;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : "";
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submitted = { email: readText(formData, "email") };
  const email = readEmail(formData);
  const password = readPassword(formData);
  // Neither can match an account, so give the same answer as a wrong password.
  if (!email || !password) return { ...submitted, error: SIGN_IN_ERROR };

  const requestHeaders = await headers();
  const emailKey = `sign-in:email:${email}`;
  // Both buckets count every attempt, whether or not the address has an account.
  const [underIpLimit, underEmailLimit] = await Promise.all([
    consume(`sign-in:ip:${clientKey(requestHeaders)}`, SIGN_IN_PER_IP),
    consume(emailKey, SIGN_IN_PER_EMAIL),
  ]);
  if (!underIpLimit || !underEmailLimit) {
    return { ...submitted, error: RATE_LIMIT_ERROR };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    if (isAPIError(error)) return { ...submitted, error: SIGN_IN_ERROR };
    throw error;
  }
  await reset(emailKey);

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = readText(formData, "name");
  const submitted = { name, email: readText(formData, "email") };

  if (!name || name.length > MAX_NAME_LENGTH) {
    return {
      ...submitted,
      error: `Enter a name of up to ${MAX_NAME_LENGTH} characters.`,
    };
  }
  const email = readEmail(formData);
  if (!email) return { ...submitted, error: "Enter a valid email address." };
  const password = readPassword(formData);
  if (!password) return { ...submitted, error: PASSWORD_LENGTH_ERROR };

  const requestHeaders = await headers();
  // Also slows probing which addresses have accounts ("email taken" below).
  if (!(await consume(`sign-up:ip:${clientKey(requestHeaders)}`, SIGN_UP_PER_IP))) {
    return { ...submitted, error: RATE_LIMIT_ERROR };
  }

  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    const code = errorCode(error);
    if (code === null) throw error;
    // Saying so confirms the address has an account. Hiding it would need a
    // verification email, which doesn't exist yet.
    if (code.startsWith("USER_ALREADY_EXISTS")) {
      return {
        ...submitted,
        emailTaken: true,
        error: "An account with this email already exists.",
      };
    }
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      return { ...submitted, error: PASSWORD_LENGTH_ERROR };
    }
    if (code === "INVALID_EMAIL") {
      return { ...submitted, error: "Enter a valid email address." };
    }
    return {
      ...submitted,
      error: "Your account could not be created. Try again in a moment.",
    };
  }

  // Outside the try: redirect() throws to navigate.
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // The cookie is cleared either way; the session row expires on its own.
    if (!isAPIError(error)) throw error;
  }
  redirect("/");
}

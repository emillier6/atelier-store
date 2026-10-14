/*
 * Readers for admin Server Action input. Actions can be POSTed to without our
 * forms, so each reader trims, checks and converts one field and reports a
 * message instead of throwing. Collect the messages into `fieldErrors`:
 *
 *   const errors: Record<string, string> = {};
 *   const name = field(errors, "name", readText(formData, "name", { max: 120 }));
 *   if (Object.keys(errors).length) return { error: FIELD_ERRORS_MESSAGE, ... };
 *
 * Plain functions with no server imports, so client code may share the
 * patterns too.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Read<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Read<T> => ({ ok: true, value });
const fail = <T>(error: string): Read<T> => ({ ok: false, error });

/**
 * Unwraps a read: returns the value, or records the message under `key` and
 * returns undefined. Check `errors` before using any value.
 */
export function field<T>(
  errors: Record<string, string>,
  key: string,
  read: Read<T>,
): T | undefined {
  if (read.ok) return read.value;
  errors[key] = read.error;
  return undefined;
}

function raw(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Required unless `optional`; an empty optional field reads as null. */
export function readText(
  formData: FormData,
  key: string,
  { max, optional = false }: { max: number; optional?: boolean },
): Read<string | null> {
  const value = raw(formData, key);
  if (!value) return optional ? ok(null) : fail("Required.");
  if (value.length > max) return fail(`Keep it under ${max} characters.`);
  return ok(value);
}

/** Lowercase words joined by single hyphens, e.g. "silk-shirt". */
export function readSlug(formData: FormData, key: string): Read<string> {
  const value = raw(formData, key).toLowerCase();
  if (!value) return fail("Required.");
  if (value.length > 120 || !SLUG_PATTERN.test(value)) {
    return fail("Use lowercase letters, numbers and single hyphens.");
  }
  return ok(value);
}

export function readUuid(formData: FormData, key: string): Read<string> {
  const value = raw(formData, key).toLowerCase();
  return UUID_PATTERN.test(value) ? ok(value) : fail("Not a valid id.");
}

/** A whole number in [min, max]. */
export function readInt(
  formData: FormData,
  key: string,
  { min, max }: { min: number; max: number },
): Read<number> {
  const value = raw(formData, key);
  if (!/^-?\d+$/.test(value)) return fail("Enter a whole number.");
  const n = Number(value);
  if (n < min || n > max) return fail(`Enter a number from ${min} to ${max}.`);
  return ok(n);
}

/**
 * A price typed in dollars ("295", "29.50") as integer cents, so money never
 * passes through a float that's stored.
 */
export function readCents(
  formData: FormData,
  key: string,
  { max = 10_000_000 }: { max?: number } = {},
): Read<number> {
  const value = raw(formData, key).replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return fail("Enter an amount like 295 or 29.50.");
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents > max) return fail("That amount is too large.");
  return ok(cents);
}

/** One of a fixed set of values, e.g. a status. */
export function readOneOf<T extends string>(
  formData: FormData,
  key: string,
  allowed: readonly T[],
): Read<T> {
  const value = raw(formData, key);
  return (allowed as readonly string[]).includes(value)
    ? ok(value as T)
    : fail("Choose one of the options.");
}

/** A checkbox: present means true. */
export function readBool(formData: FormData, key: string) {
  return formData.get(key) !== null;
}

/**
 * A textarea with one entry per line (details, sizes, image URLs). Blank
 * lines are dropped; each entry is capped at `maxLength`.
 */
export function readLines(
  formData: FormData,
  key: string,
  { maxItems, maxLength }: { maxItems: number; maxLength: number },
): Read<string[]> {
  const lines = raw(formData, key)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > maxItems) return fail(`Keep it to ${maxItems} lines.`);
  if (lines.some((line) => line.length > maxLength)) {
    return fail(`Keep each line under ${maxLength} characters.`);
  }
  return ok(lines);
}

/** An absolute https URL, e.g. an image. */
export function readHttpsUrl(value: string): Read<string> {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return fail("Use an https:// address.");
    return ok(url.toString());
  } catch {
    return fail("Not a valid web address.");
  }
}

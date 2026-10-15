import { formatPrice } from "@/lib/format";

/** Refund amounts use the shared format: 2950 → "$29.50", 100 → "$1". */
export const formatCents = formatPrice;

/** Cents as the amount field's text, e.g. 2950 → "29.50", 100 → "1". */
export function centsToInput(cents: number) {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(dollars) : `${dollars}.${String(rest).padStart(2, "0")}`;
}

/**
 * The amount field's text as cents, or null, for the button label only;
 * the action validates with readCents.
 */
export function inputToCents(text: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim().replace(/,/g, ""));
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

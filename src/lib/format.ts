const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Formats an amount in cents, e.g. 295000 → "$2,950". */
export function formatPrice(cents: number) {
  return usd.format(cents / 100);
}

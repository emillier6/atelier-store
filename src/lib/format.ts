const whole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const exact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an amount in cents, keeping the cents only when there are any:
 * 295000 → "$2,950", 4950 → "$49.50". Never rounds, so the price shown is
 * what Stripe charges.
 */
export function formatPrice(cents: number) {
  return (cents % 100 === 0 ? whole : exact).format(cents / 100);
}

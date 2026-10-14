/*
 * The shipping address as stored on an order. No DB imports, so client and
 * server components can both use it.
 */

/** Where Stripe Checkout may ship to: the US, Canada, the UK and the EU. */
export const SHIPPING_COUNTRIES = [
  "US", "CA", "GB",
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
] as const;

export type ShippingAddress = {
  name: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
};

type OrderAddressColumns = {
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
};

/** The order's address, or null for orders placed before it was collected. */
export function shippingAddressOf(
  order: OrderAddressColumns,
): ShippingAddress | null {
  if (!order.shippingLine1 || !order.shippingCountry) return null;
  return {
    name: order.shippingName,
    line1: order.shippingLine1,
    line2: order.shippingLine2,
    city: order.shippingCity,
    state: order.shippingState,
    postalCode: order.shippingPostalCode,
    country: order.shippingCountry,
  };
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "GB" → "United Kingdom"; falls back to the code. */
export function countryName(code: string) {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

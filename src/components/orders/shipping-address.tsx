import { countryName, type ShippingAddress } from "@/lib/shipping-address";

/**
 * A postal address as lines. Orders placed before addresses were collected
 * have none; `fallback` is shown instead.
 */
export function ShippingAddressBlock({
  address,
  fallback = "No shipping address on this order.",
}: {
  address: ShippingAddress | null;
  fallback?: string;
}) {
  if (!address) return <p className="type-meta">{fallback}</p>;

  const cityLine = [address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <address className="stack gap-0.5 text-body-sm not-italic">
      {address.name && <span className="font-medium">{address.name}</span>}
      <span>{address.line1}</span>
      {address.line2 && <span>{address.line2}</span>}
      {cityLine && <span>{cityLine}</span>}
      <span>{countryName(address.country)}</span>
    </address>
  );
}

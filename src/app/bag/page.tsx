import type { Metadata } from "next";
import Link from "next/link";
import { BagLineItem } from "@/components/bag/bag-line-item";
import { CheckoutButton } from "@/components/bag/checkout-button";
import { ListingHeader, pieceCount } from "@/components/listing-header";
import { getBag } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Bag" };

export default async function BagPage({ searchParams }: PageProps<"/bag">) {
  const user = await requireUser("/bag");
  const [{ cancelled }, bag] = await Promise.all([
    searchParams,
    getBag(user.id),
  ]);
  const blocked = bag.lines.some((line) => line.unavailable);

  return (
    <main className="flex-1 pb-section">
      <ListingHeader title="Bag" meta={pieceCount(bag.itemCount)} />

      {cancelled && bag.lines.length > 0 && (
        <p role="status" className="container-page pb-6 text-body-sm">
          Checkout was cancelled and you have not been charged. Your bag is
          as you left it.
        </p>
      )}

      {bag.lines.length === 0 ? (
        <div className="container-page stack items-start gap-6 hairline-t pt-8">
          <p className="text-body">Your bag is empty.</p>
          <Link href="/new-arrivals" className="btn btn-outline">
            See what has just arrived
          </Link>
        </div>
      ) : (
        <div className="container-page grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <ul className="hairline-t">
            {bag.lines.map((line) => (
              <BagLineItem key={line.id} line={line} />
            ))}
          </ul>

          <aside
            aria-labelledby="bag-summary"
            className="stack gap-6 hairline p-6 lg:sticky lg:top-[calc(var(--header-h)+2rem)]"
          >
            <h2 id="bag-summary" className="type-label">
              Summary
            </h2>
            <dl className="stack gap-3 text-body-sm">
              <div className="flex justify-between gap-4">
                <dt>Subtotal</dt>
                <dd className="type-price">{formatPrice(bag.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-muted">
                <dt>Shipping</dt>
                <dd>Complimentary</dd>
              </div>
            </dl>
            <p className="type-meta">Taxes are calculated at checkout.</p>
            {blocked && (
              <p className="text-body-sm text-danger">
                Some pieces are no longer available in the quantity in your
                bag. Update them above to check out.
              </p>
            )}
            <CheckoutButton disabled={blocked} />
            <Link href="/new-arrivals" className="btn btn-outline btn-block">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderLines, orderNumber } from "@/components/orders/order-lines";
import { PendingOrderRefresh } from "@/components/orders/pending-order-refresh";
import { formatPrice } from "@/lib/format";
import { getOrderBySession } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Order confirmed" };

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{1,200}$/;

/**
 * Where Stripe sends the customer after paying. It only reads: the order is
 * written by the webhook, which can land a moment after the customer does.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const { session_id: sessionId } = await searchParams;
  if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
    notFound();
  }
  const user = await requireUser(`/checkout/success?session_id=${sessionId}`);
  const order = await getOrderBySession(user.id, sessionId);

  if (!order) {
    // No order yet: only wait if Stripe confirms this is the customer's own
    // paid session, so the page can't be used to probe other sessions.
    const session = await getStripe()
      .checkout.sessions.retrieve(sessionId)
      .catch(() => null);
    if (
      !session ||
      session.client_reference_id !== user.id ||
      session.payment_status === "unpaid"
    ) {
      notFound();
    }
  }

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <div className="mx-auto stack max-w-xl gap-10">
          <header className="stack gap-4">
            <h1 className="type-display">Thank you</h1>
            {order ? (
              <p className="text-body text-muted">
                Your order {orderNumber(order.id)} is confirmed and paid.
              </p>
            ) : (
              <PendingOrderRefresh />
            )}
          </header>

          {order && (
            <section aria-labelledby="order-summary" className="stack gap-4">
              <h2 id="order-summary" className="type-label">
                Order {orderNumber(order.id)}
              </h2>
              <OrderLines lines={order.items} />
              <dl className="stack gap-3 text-body-sm">
                <div className="flex justify-between gap-4 text-muted">
                  <dt>Shipping</dt>
                  <dd>Complimentary</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium">Total paid</dt>
                  <dd className="type-price">{formatPrice(order.totalCents)}</dd>
                </div>
              </dl>
            </section>
          )}

          <div className="cluster gap-3">
            <Link href="/account" className="btn btn-primary">
              View your orders
            </Link>
            <Link href="/new-arrivals" className="btn btn-outline">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

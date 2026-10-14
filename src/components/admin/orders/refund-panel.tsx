import Link from "next/link";
import type { ReactNode } from "react";
import { formatCents } from "@/components/admin/orders/refund-format";
import { RefundForm } from "@/components/admin/orders/refund-form";
import { getRefundPanel } from "@/lib/refunds";

/*
 * The admin order page's refund section: what was paid and refunded, and a
 * form that refunds through Stripe. getRefundPanel checks the admin itself.
 * Refunds made in the Stripe Dashboard show up here through the
 * charge.refunded webhook.
 */

export async function RefundPanel({ orderId }: { orderId: string }) {
  const panel = await getRefundPanel(orderId);
  if (!panel) return null;

  return (
    <section aria-labelledby="refund-heading" className="stack gap-4">
      <h2 id="refund-heading" className="type-label">
        Refund
      </h2>
      <dl className="stack gap-3 text-body-sm">
        <Amount label="Paid">{formatCents(panel.totalCents)}</Amount>
        <Amount label="Refunded">{formatCents(panel.refundedCents)}</Amount>
        <Amount label="Remaining">{formatCents(panel.remainingCents)}</Amount>
      </dl>

      {!panel.stripePaymentIntentId ? (
        <p className="type-meta">
          This order has no Stripe PaymentIntent on record, so it can&apos;t
          be refunded here. Refund it from the Stripe Dashboard.
        </p>
      ) : panel.remainingCents === 0 ? (
        <p className="text-body-sm text-muted">Fully refunded.</p>
      ) : (
        <RefundForm
          orderId={panel.id}
          refundedCents={panel.refundedCents}
          remainingCents={panel.remainingCents}
        />
      )}

      <p className="type-meta">
        Refunding doesn&apos;t return stock. Use each product&apos;s stock
        panel if items come back
        {panel.products.length > 0 ? (
          <>
            {": "}
            {panel.products.map((product, index) => (
              <span key={product.id}>
                {index > 0 && ", "}
                <Link href={`/admin/products/${product.id}`} className="link">
                  {product.name}
                </Link>
              </span>
            ))}
            .
          </>
        ) : (
          "."
        )}
      </p>
    </section>
  );
}

function Amount({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

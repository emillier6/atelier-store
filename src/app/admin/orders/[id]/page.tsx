import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FulfillmentForms } from "@/components/admin/orders/fulfillment-forms";
import { formatOrderDate } from "@/components/admin/orders/order-date";
import { RefundPanel } from "@/components/admin/orders/refund-panel";
import { OrderLines, orderNumber } from "@/components/orders/order-lines";
import { ShippingAddressBlock } from "@/components/orders/shipping-address";
import { formatPrice } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/form-data";
import { fulfillmentLabels, fulfillmentTones } from "@/lib/fulfillment";
import { shippingAddressOf } from "@/lib/shipping-address";
import { getAdminOrder } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

const STRIPE_PAYMENTS_URL = "https://dashboard.stripe.com/test/payments/";

async function loadOrder(rawId: string) {
  const id = rawId.toLowerCase();
  await requireAdmin(`/admin/orders/${encodeURIComponent(rawId)}`);
  if (!UUID_PATTERN.test(id)) notFound();
  const order = await getAdminOrder(id);
  if (!order) notFound();
  return order;
}

export async function generateMetadata({
  params,
}: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const order = await loadOrder((await params).id);
  return { title: `Order ${orderNumber(order.id)}` };
}

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  const order = await loadOrder((await params).id);
  const number = orderNumber(order.id);
  const itemCount = order.items.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <AdminPageHeader
          title={`Order ${number}`}
          crumbs={[{ href: "/admin/orders", label: "Orders" }]}
          meta={`${formatOrderDate(order.createdAt)} · ${itemCount} ${
            itemCount === 1 ? "item" : "items"
          } · ${formatPrice(order.totalCents)}`}
        />

        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="stack gap-12">
            <section aria-labelledby="lines" className="stack gap-4">
              <h2 id="lines" className="type-label">
                Lines
              </h2>
              <OrderLines lines={order.items} />
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-body-sm font-medium">Charged</p>
                <p className="type-price">{formatPrice(order.totalCents)}</p>
              </div>
            </section>

            <section aria-labelledby="fulfilment" className="stack gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="fulfilment" className="type-label">
                  Fulfilment
                </h2>
                <span
                  className="badge"
                  data-tone={fulfillmentTones[order.fulfillmentStatus]}
                >
                  {fulfillmentLabels[order.fulfillmentStatus]}
                </span>
              </div>
              <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
                <Detail label="Carrier">{order.carrier || "—"}</Detail>
                <Detail label="Tracking number">
                  {order.trackingNumber ? (
                    <code className="break-all">{order.trackingNumber}</code>
                  ) : (
                    "—"
                  )}
                </Detail>
                <Detail label="Shipped">
                  {order.shippedAt ? formatOrderDate(order.shippedAt) : "—"}
                </Detail>
                <Detail label="Delivered">
                  {order.deliveredAt ? formatOrderDate(order.deliveredAt) : "—"}
                </Detail>
              </dl>
              <FulfillmentForms
                orderId={order.id}
                status={order.fulfillmentStatus}
                carrier={order.carrier}
                trackingNumber={order.trackingNumber}
              />
            </section>
          </div>

          <div className="stack gap-12">
            <section aria-labelledby="customer" className="stack gap-4">
              <h2 id="customer" className="type-label">
                Customer
              </h2>
              <dl className="stack gap-3 text-body-sm">
                <Detail label="Name">{order.user.name}</Detail>
                <Detail label="Account email">{order.user.email}</Detail>
                <Detail label="Charged email">{order.email || "—"}</Detail>
              </dl>
            </section>

            <section aria-labelledby="shipping" className="stack gap-4">
              <h2 id="shipping" className="type-label">
                Shipping
              </h2>
              <ShippingAddressBlock address={shippingAddressOf(order)} />
            </section>

            <section aria-labelledby="payment" className="stack gap-4">
              <h2 id="payment" className="type-label">
                Payment
              </h2>
              <dl className="stack gap-3 text-body-sm">
                <Detail label="Checkout Session">
                  <code className="break-all">
                    {order.stripeCheckoutSessionId}
                  </code>
                </Detail>
                <Detail label="PaymentIntent">
                  {order.stripePaymentIntentId ? (
                    <code className="break-all">
                      {order.stripePaymentIntentId}
                    </code>
                  ) : (
                    "—"
                  )}
                </Detail>
              </dl>
              {order.stripePaymentIntentId && (
                <a
                  href={`${STRIPE_PAYMENTS_URL}${encodeURIComponent(order.stripePaymentIntentId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm self-start"
                >
                  View in Stripe
                </a>
              )}
              <RefundPanel orderId={order.id} />
            </section>
          </div>
        </div>

        <section aria-labelledby="stock" className="stack gap-4 pt-12">
          <h2 id="stock" className="type-label">
            Stock changes
          </h2>
          {order.stockAdjustments.length === 0 ? (
            <p className="text-body-sm text-muted">
              No stock changes recorded for this order.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Reason</th>
                    <th scope="col" className="num">
                      Change
                    </th>
                    <th scope="col" className="num">
                      Stock after
                    </th>
                    <th scope="col">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {order.stockAdjustments.map((row) => (
                    <tr key={row.id}>
                      <td>{row.product.name}</td>
                      <td>
                        <span
                          className="badge"
                          data-tone={
                            row.reason === "oversell" ? "danger" : "muted"
                          }
                        >
                          {row.reason}
                        </span>
                      </td>
                      <td className="num">
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </td>
                      <td className="num">{row.stockAfter}</td>
                      <td className="whitespace-nowrap text-muted">
                        {formatOrderDate(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="stack gap-1">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

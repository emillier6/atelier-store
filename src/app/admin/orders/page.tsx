import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatOrderDate } from "@/components/admin/orders/order-date";
import { OrderSearch } from "@/components/admin/orders/order-search";
import { Pagination } from "@/components/admin/pagination";
import { orderNumber } from "@/components/orders/order-lines";
import { type FulfillmentStatus, fulfillmentStatuses } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { fulfillmentLabels, fulfillmentTones } from "@/lib/fulfillment";
import {
  encodeOrderCursor,
  getAdminOrders,
  type OrderCursor,
  parseOrderCursor,
} from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Orders" };

const MAX_QUERY_LENGTH = 200;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/** A known status, or null (all) for anything else. */
function parseStatus(value: string | undefined): FulfillmentStatus | null {
  return (fulfillmentStatuses as readonly string[]).includes(value ?? "")
    ? (value as FulfillmentStatus)
    : null;
}

function pageHref(
  q: string,
  status: FulfillmentStatus | null,
  key: "after" | "before",
  cursor: OrderCursor,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  params.set(key, encodeOrderCursor(cursor));
  return `/admin/orders?${params}`;
}

export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  await requireAdmin("/admin/orders");

  const params = await searchParams;
  const q = (single(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const status = parseStatus(single(params.status));
  // A malformed cursor reads as none: the first page.
  const after = parseOrderCursor(single(params.after));
  const before = after ? null : parseOrderCursor(single(params.before));

  const { orders, newerCursor, olderCursor } = await getAdminOrders({
    q,
    status,
    after,
    before,
  });
  const filtered = Boolean(q || status);

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <AdminPageHeader
          title="Orders"
          meta={
            q
              ? `Results for “${q}”${status ? ` · ${fulfillmentLabels[status]}` : ""}`
              : status
                ? `${fulfillmentLabels[status]} orders, newest first.`
                : "Newest first."
          }
        />

        {/* Keyed so the fields show the URL's filters after navigating. */}
        <OrderSearch key={`${q}|${status ?? ""}`} q={q} status={status} />

        {orders.length === 0 ? (
          <p className="py-12 text-body text-muted">
            {filtered ? "No orders match these filters." : "No orders yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Date</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Items
                  </th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium whitespace-nowrap">
                      {orderNumber(order.id)}
                    </td>
                    <td className="whitespace-nowrap text-muted">
                      {formatOrderDate(order.createdAt)}
                    </td>
                    <td>
                      <div className="stack gap-1">
                        <span>{order.customerName}</span>
                        <span className="type-meta">{order.email}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className="badge"
                          data-tone={fulfillmentTones[order.fulfillmentStatus]}
                        >
                          {fulfillmentLabels[order.fulfillmentStatus]}
                        </span>
                        {order.refundedCents > 0 && (
                          <span className="badge" data-tone="muted">
                            {order.refundedCents >= order.totalCents
                              ? "Refunded"
                              : "Part refunded"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="num">{order.itemCount}</td>
                    <td className="num">{formatPrice(order.totalCents)}</td>
                    <td className="text-end">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="link"
                        aria-label={`View order ${orderNumber(order.id)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          previousHref={newerCursor && pageHref(q, status, "before", newerCursor)}
          nextHref={olderCursor && pageHref(q, status, "after", olderCursor)}
        />
      </div>
    </main>
  );
}

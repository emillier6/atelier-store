import Link from "next/link";
import type { StockAdjustmentReason } from "@/db/schema";
import { getStockPanel, type StockHistoryRow } from "@/lib/admin-stock";
import { orderNumber } from "@/components/orders/order-lines";
import {
  AdjustStockForm,
  SetStockForm,
} from "@/components/admin/stock/stock-forms";

/*
 * The product edit page's stock section: the count, the two ways to change
 * it, and the latest history rows. getStockPanel checks the admin itself.
 */

const reasonTones: Record<StockAdjustmentReason, string | undefined> = {
  restock: "success",
  correction: undefined,
  sale: "muted",
  refund: undefined,
  oversell: "danger",
};

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function signed(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

function Who({ row }: { row: StockHistoryRow }) {
  if (row.admin) {
    return (
      <span className="stack gap-0">
        <span>{row.admin.name}</span>
        <span className="text-muted">{row.admin.email}</span>
      </span>
    );
  }
  // user_id is null for the webhook, or after an admin's account was deleted.
  const fromOrder =
    row.orderId !== null ||
    row.reason === "sale" ||
    row.reason === "oversell" ||
    row.reason === "refund";
  return (
    <span className="text-muted">{fromOrder ? "Checkout" : "Deleted user"}</span>
  );
}

export async function StockPanel({ productId }: { productId: string }) {
  const panel = await getStockPanel(productId);
  if (!panel) return null;
  const { stock, history } = panel;

  return (
    <section aria-labelledby="stock-heading" className="stack gap-8">
      <div className="stack gap-1">
        <h2 id="stock-heading" className="type-label">
          Stock
        </h2>
        <p className="type-title tabular-nums">
          {stock} {stock === 1 ? "piece" : "pieces"}
        </p>
        <p className="type-meta">Shared by every size.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <SetStockForm productId={productId} stock={stock} />
        <AdjustStockForm productId={productId} stock={stock} />
      </div>

      <div className="stack gap-4">
        <h3 className="type-label">History</h3>
        {history.length === 0 ? (
          <p className="text-body-sm text-muted">No changes recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reason</th>
                  <th scope="col" className="num">
                    Change
                  </th>
                  <th scope="col" className="num">
                    Stock after
                  </th>
                  <th scope="col">By</th>
                  <th scope="col">Order</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">
                      <time dateTime={row.createdAt.toISOString()}>
                        {dateTime.format(row.createdAt)}
                      </time>
                    </td>
                    <td>
                      <span className="badge" data-tone={reasonTones[row.reason]}>
                        {row.reason}
                      </span>
                    </td>
                    <td className="num">{signed(row.delta)}</td>
                    <td className="num">{row.stockAfter}</td>
                    <td>
                      <Who row={row} />
                    </td>
                    <td>
                      {row.orderId ? (
                        <Link
                          href={`/admin/orders/${row.orderId}`}
                          className="link"
                        >
                          {orderNumber(row.orderId)}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="type-meta">Latest 20 changes.</p>
      </div>
    </section>
  );
}

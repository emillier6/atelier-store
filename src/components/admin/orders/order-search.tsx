import Link from "next/link";
import { type FulfillmentStatus, fulfillmentStatuses } from "@/db/schema";
import { fulfillmentLabels } from "@/lib/fulfillment";

/**
 * A plain GET form: the query lands in ?q= and the status in ?status=, so a
 * search can be bookmarked and paging keeps it. Submitting drops the page
 * cursor.
 */
export function OrderSearch({
  q,
  status,
}: {
  q: string;
  status: FulfillmentStatus | null;
}) {
  return (
    <form
      action="/admin/orders"
      method="get"
      role="search"
      className="flex flex-wrap items-end gap-3 pb-6"
    >
      <div className="stack min-w-0 flex-1 basis-64 gap-2">
        <label htmlFor="q" className="text-body-sm font-medium">
          Search orders
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={200}
          placeholder="Email, order number or Stripe id"
          className="field"
        />
      </div>
      <div className="stack min-w-0 basis-40 gap-2">
        <label htmlFor="status" className="text-body-sm font-medium">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status ?? ""}
          className="field"
        >
          <option value="">All statuses</option>
          {fulfillmentStatuses.map((value) => (
            <option key={value} value={value}>
              {fulfillmentLabels[value]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-primary">
        Search
      </button>
      {(q || status) && (
        <Link href="/admin/orders" className="btn btn-outline">
          Clear
        </Link>
      )}
    </form>
  );
}

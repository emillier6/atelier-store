import Link from "next/link";

/**
 * A plain GET form: the query lands in ?q=, so a search can be bookmarked
 * and paging keeps it. Submitting drops the page cursor.
 */
export function OrderSearch({ q }: { q: string }) {
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
      <button type="submit" className="btn btn-primary">
        Search
      </button>
      {q && (
        <Link href="/admin/orders" className="btn btn-outline">
          Clear
        </Link>
      )}
    </form>
  );
}

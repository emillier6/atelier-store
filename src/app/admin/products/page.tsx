import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Pagination } from "@/components/admin/pagination";
import { productStatuses, type ProductStatus } from "@/db/schema";
import {
  countAdminProducts,
  decodeCursor,
  getAdminCategoryOptions,
  listAdminProducts,
} from "@/lib/admin-products";
import { formatPrice } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Products" };

const updatedDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  await requireAdmin("/admin/products");
  const params = await searchParams;

  const rawStatus = one(params.status);
  const status = (productStatuses as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as ProductStatus)
    : undefined;
  const rawCategory = one(params.category)?.toLowerCase();
  const categoryId =
    rawCategory && UUID_PATTERN.test(rawCategory) ? rawCategory : undefined;
  const q = one(params.q)?.trim().slice(0, 100) || undefined;
  const filters = { status, categoryId, q };

  const [page, total, categoryOptions] = await Promise.all([
    listAdminProducts(filters, {
      after: decodeCursor(one(params.after)),
      before: decodeCursor(one(params.before)),
    }),
    countAdminProducts(filters),
    getAdminCategoryOptions(),
  ]);

  function pageHref(cursor: { after?: string; before?: string }) {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (categoryId) search.set("category", categoryId);
    if (q) search.set("q", q);
    if (cursor.after) search.set("after", cursor.after);
    if (cursor.before) search.set("before", cursor.before);
    return `/admin/products?${search}`;
  }

  const filtered = Boolean(status || categoryId || q);
  const deleted = one(params.deleted) === "1";

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <AdminPageHeader
          title="Products"
          meta={`${total} ${total === 1 ? "product" : "products"}${filtered ? " match" : ""}`}
          actions={
            <Link href="/admin/products/new" className="btn btn-primary btn-sm">
              New product
            </Link>
          }
        />

        {deleted && (
          <p role="status" className="pb-6 text-body-sm text-success">
            Product deleted.
          </p>
        )}

        <Form
          action="/admin/products"
          // Remount on every search so the controls show the URL's filters.
          key={`${status}-${categoryId}-${q}`}
          className="hairline-t flex flex-wrap items-end gap-4 py-6"
        >
          <div className="stack min-w-48 flex-1 gap-2">
            <label htmlFor="q" className="text-body-sm font-medium">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              className="field"
              placeholder="Name, SKU or slug"
              defaultValue={q ?? ""}
              maxLength={100}
            />
          </div>
          <div className="stack gap-2">
            <label htmlFor="status" className="text-body-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="field"
              defaultValue={status ?? ""}
            >
              <option value="">All</option>
              {productStatuses.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="stack gap-2">
            <label htmlFor="category" className="text-body-sm font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              className="field"
              defaultValue={categoryId ?? ""}
            >
              <option value="">All</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="cluster gap-4">
            <button type="submit" className="btn btn-outline btn-sm">
              Filter
            </button>
            {filtered && (
              <Link href="/admin/products" className="link text-body-sm">
                Clear
              </Link>
            )}
          </div>
        </Form>

        {page.products.length === 0 ? (
          <p className="py-12 text-body text-muted">
            {filtered ? "No products match these filters." : "No products yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col" className="num">
                    Stock
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {page.products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="link"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{product.sku}</td>
                    <td>{product.categoryName}</td>
                    <td className="num">{formatPrice(product.priceCents)}</td>
                    <td className="num">{product.stockQuantity}</td>
                    <td>
                      <div className="cluster gap-2">
                        <span
                          className="badge"
                          data-tone={
                            product.status === "active" ? undefined : "muted"
                          }
                        >
                          {product.status}
                        </span>
                        {product.imageCount === 0 && (
                          <span className="badge" data-tone="danger">
                            No images
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {updatedDate.format(product.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          previousHref={page.previous ? pageHref({ before: page.previous }) : null}
          nextHref={page.next ? pageHref({ after: page.next }) : null}
        />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/admin/products/product-form";
import { ProductLifecycle } from "@/components/admin/products/product-lifecycle";
import { StockPanel } from "@/components/admin/stock/stock-panel";
import {
  getAdminCategoryOptions,
  getAdminProduct,
  productHasOrders,
} from "@/lib/admin-products";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getAdminProduct(id);
  return { title: product?.name ?? "Product" };
}

/** Cents as the dollars the price field takes: 29500 → "295", 2950 → "29.50". */
function centsToInput(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export default async function AdminProductPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/products/${id}`);

  const [product, categoryOptions, hasOrders, query] = await Promise.all([
    getAdminProduct(id),
    getAdminCategoryOptions(),
    productHasOrders(id),
    searchParams,
  ]);
  if (!product) notFound();

  const created = query.created === "1";

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <div className="stack max-w-3xl gap-16">
          <div>
            <AdminPageHeader
              title={product.name}
              crumbs={[{ href: "/admin/products", label: "Products" }]}
              meta={`${product.sku} · ${product.status} · ${product.stockQuantity} in stock`}
            />
            {created && (
              <p role="status" className="pb-6 text-body-sm text-success">
                Product created.
              </p>
            )}
            {product.images.length === 0 && (
              <p className="pb-6 text-body-sm text-danger">
                This product has no images, so the storefront hides it.
              </p>
            )}
            <ProductForm
              mode="edit"
              savedSlug={product.slug}
              categories={categoryOptions}
              initial={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                sku: product.sku,
                categoryId: product.categoryId,
                colour: product.colour,
                price: centsToInput(product.priceCents),
                badge: product.badge ?? "",
                description: product.description,
                details: product.details.join("\n"),
                sizes: product.sizes.join("\n"),
                status: product.status,
                images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
              }}
            />
          </div>

          {/* StockPanel brings its own "Stock" heading, count and history. */}
          <div className="hairline-t pt-8">
            <StockPanel productId={product.id} />
          </div>

          <section
            aria-labelledby="lifecycle-heading"
            className="hairline-t stack gap-6 pt-8"
          >
            <h2 id="lifecycle-heading" className="type-label">
              Archive or delete
            </h2>
            <ProductLifecycle
              productId={product.id}
              status={product.status}
              hasOrders={hasOrders}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

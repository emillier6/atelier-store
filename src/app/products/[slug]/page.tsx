import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlusIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ProductAccordion } from "@/components/product/product-accordion";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchase } from "@/components/product/product-purchase";
import { StockStatus } from "@/components/product/stock-status";
import { SectionHeader } from "@/components/section-header";
import {
  getProduct,
  getProductSlugs,
  getRelatedProducts,
} from "@/lib/products";
import { getStockState } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";

export const revalidate = 60;

// Unlisted slugs render on demand; unknown ones 404 via notFound().
export async function generateStaticParams() {
  return (await getProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    openGraph: { images: [product.image.src] },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const stockState = getStockState(product);
  const images = [product.image, ...(product.gallery ?? [])];
  const categoryHref = `/collections/${product.category.slug}`;
  const related = await getRelatedProducts(product);

  return (
    <main className="flex-1">
      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ProductGallery images={images} />

        <div className="px-gutter pt-8 pb-section lg:px-12 lg:pt-12 xl:px-16">
          <div className="stack gap-8 lg:sticky lg:top-[calc(var(--header-h)+3rem)]">
            <nav aria-label="Breadcrumb">
              <ol className="cluster gap-2 text-body-sm text-muted">
                <li>
                  <Link href="/" className="link-nav">
                    Home
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link href={categoryHref} className="link-nav">
                    {product.category.name}
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="stack gap-3">
              {product.badge && (
                <p className="text-micro font-medium">{product.badge}</p>
              )}
              <h1 className="text-heading font-normal">{product.name}</h1>
              <p className="text-body font-semibold tabular-nums">
                {formatPrice(product.price)}
              </p>
            </div>

            <dl className="stack gap-2 text-body-sm">
              <div className="flex gap-2">
                <dt className="text-muted">Category</dt>
                <dd>
                  <Link href={categoryHref} className="link">
                    {product.category.name}
                  </Link>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">Colour</dt>
                <dd className="font-medium">{product.color}</dd>
              </div>
            </dl>

            <div className="stack gap-4">
              <StockStatus state={stockState} stock={product.stock} />
              <ProductPurchase sizes={product.sizes} stockState={stockState} />
            </div>

            <ul className="stack gap-3 text-body-sm">
              <li className="flex items-center gap-2">
                <PlusIcon className="size-3.5" />
                <Link href="/services/shipping" className="link">
                  Complimentary shipping & returns
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <PlusIcon className="size-3.5" />
                <Link href="/services/appointments" className="link">
                  Find in store and book an appointment
                </Link>
              </li>
            </ul>

            <div className="stack gap-3">
              <h2 className="type-label">Product description</h2>
              <p className="type-meta">Style {product.sku}</p>
              <p className="text-body">{product.description}</p>
            </div>

            <ProductAccordion
              items={[
                {
                  title: "Product details",
                  content: (
                    <ul className="stack list-inside list-disc gap-1">
                      {product.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  ),
                },
                {
                  title: "Materials & care",
                  content: (
                    <p>
                      Store in the dust bag provided, away from direct sunlight
                      and humidity. Clean with a soft, dry cloth; for leather
                      and delicate fabrics, visit a specialist.
                    </p>
                  ),
                },
                {
                  title: "Shipping & returns",
                  content: (
                    <p>
                      Complimentary express delivery in 2–4 business days.
                      Returns and exchanges are free within 30 days of delivery.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <SectionHeader
            title="You May Also Like"
            action={{ label: `Shop ${product.category.name}`, href: categoryHref }}
          />
          <ul className="container-bleed grid-products hairline-t">
            {related.map((item, i) => (
              // 4 items fill 2 or 4 columns; hide the orphan in the 3-column layout.
              <li
                key={item.slug}
                className={i === 3 ? "md:max-lg:hidden" : undefined}
              >
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

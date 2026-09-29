import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingHeader, pieceCount } from "@/components/listing-header";
import { ProductGrid } from "@/components/product-grid";
import {
  getCategories,
  getCategory,
  getProductsByCategory,
} from "@/lib/products";

export const revalidate = 60;

const LISTING_LIMIT = 48;

// Unlisted slugs render on demand; unknown ones 404 via notFound().
export async function generateStaticParams() {
  return (await getCategories()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return {};
  return {
    title: category.name,
    description: `${category.name} from the Atelier collection.`,
  };
}

export default async function CollectionPage({
  params,
}: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const [products, allCategories] = await Promise.all([
    getProductsByCategory(slug, LISTING_LIMIT),
    getCategories(),
  ]);
  const others = allCategories.filter((c) => c.slug !== slug);

  return (
    <main className="flex-1 pb-section">
      <ListingHeader
        title={category.name}
        meta={`${pieceCount(products.length)}, newest first`}
      />

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <div className="container-page stack items-start gap-6 hairline-t pt-8">
          <p className="text-body">
            This collection is between deliveries. New pieces are on their way.
          </p>
          <Link href="/new-arrivals" className="btn btn-outline">
            See what has just arrived
          </Link>
        </div>
      )}

      {others.length > 0 && (
        <nav
          aria-labelledby="other-collections"
          className="container-page stack gap-4 pt-section"
        >
          <h2 id="other-collections" className="type-title">
            Other Collections
          </h2>
          <ul className="cluster gap-x-8 gap-y-3 text-body-sm">
            {others.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="link-nav">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}

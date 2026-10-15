import type { Metadata } from "next";
import Link from "next/link";
import { pieceCount } from "@/components/listing-header";
import { ProductGrid } from "@/components/product-grid";
import { SEARCH_MAX_LENGTH, searchProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

/** Searches active pieces by name, colour, SKU and category. */
export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const query = (typeof raw === "string" ? raw : "")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH);
  const products = query ? await searchProducts(query) : [];

  return (
    <main className="flex-1 pb-section">
      <div className="container-page stack gap-6 pt-8 pb-6 md:pt-12 md:pb-8">
        <h1 className="type-title">Search</h1>
        <form action="/search" role="search" className="flex max-w-xl gap-3">
          <label htmlFor="q" className="sr-only">
            Search the collection
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={SEARCH_MAX_LENGTH}
            placeholder="Search by piece, colour or category"
            autoComplete="off"
            className="field"
          />
          <button type="submit" className="btn btn-primary shrink-0">
            Search
          </button>
        </form>
        {query && (
          <p className="type-meta" aria-live="polite">
            {pieceCount(products.length)} for “{query}”
          </p>
        )}
      </div>

      {query && products.length > 0 && <ProductGrid products={products} />}

      {query && products.length === 0 && (
        <div className="container-page stack items-start gap-6 hairline-t pt-8">
          <p className="text-body">
            Nothing matches “{query}”. Try a piece, a colour or a category.
          </p>
          <Link href="/new-arrivals" className="btn btn-outline">
            See what has just arrived
          </Link>
        </div>
      )}
    </main>
  );
}

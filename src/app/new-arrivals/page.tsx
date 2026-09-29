import type { Metadata } from "next";
import Link from "next/link";
import { ListingHeader, pieceCount } from "@/components/listing-header";
import { ProductGrid } from "@/components/product-grid";
import { getNewArrivals } from "@/lib/products";

export const revalidate = 60;

/** The newest run of the catalog, not the whole archive. */
const LISTING_LIMIT = 24;

export const metadata: Metadata = {
  title: "New Arrivals",
  description: "The newest pieces from the atelier, listed as they arrive.",
};

export default async function NewArrivalsPage() {
  const products = await getNewArrivals(LISTING_LIMIT);

  return (
    <main className="flex-1 pb-section">
      <ListingHeader
        title="New Arrivals"
        meta={`${pieceCount(products.length)}, newest first`}
      />

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <div className="container-page stack items-start gap-6 hairline-t pt-8">
          <p className="text-body">
            Nothing has arrived yet. New pieces are on their way.
          </p>
          <Link href="/" className="btn btn-outline">
            Back to the homepage
          </Link>
        </div>
      )}
    </main>
  );
}

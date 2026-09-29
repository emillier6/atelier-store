import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/catalog";

/** Full-bleed hairline grid of product cards: 2, 3 or 4 columns. */
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="container-bleed grid-products hairline-t">
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

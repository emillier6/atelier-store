import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { getStockState, type Product } from "@/lib/catalog";

type ProductCardProps = {
  product: Product;
  /** Rendered width hint for next/image; defaults to the product grid. */
  sizes?: string;
};

export function ProductCard({
  product,
  sizes = "(min-width: 64rem) 25vw, (min-width: 48rem) 33vw, 50vw",
}: ProductCardProps) {
  const badge =
    getStockState(product) === "out_of_stock" ? "Sold out" : product.badge;

  return (
    <Link href={`/products/${product.slug}`} className="group stack h-full">
      <div className="relative aspect-product overflow-hidden bg-surface">
        <Image
          src={product.image.src}
          alt={product.image.alt}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-luxe group-hover:scale-[1.03]"
        />
        {badge && (
          <span className="absolute top-3 left-3 text-micro font-medium md:top-4 md:left-4">
            {badge}
          </span>
        )}
      </div>
      <div className="stack gap-1 px-3 pt-3 pb-6 md:px-4 md:pt-4 md:pb-8">
        <h3 className="text-body-sm">{product.name}</h3>
        <p className="type-price">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}

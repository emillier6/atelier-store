import { ProductCard } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import type { Product } from "@/lib/catalog";

type ProductRailProps = {
  title: string;
  products: Product[];
  action?: { label: string; href: string };
};

/** Horizontally scrolling product row; swipe on touch, scroll on desktop. */
export function ProductRail({ title, products, action }: ProductRailProps) {
  return (
    <section className="section">
      <SectionHeader title={title} action={action} />
      <ul className="container-bleed scroller-x gap-px hairline-t">
        {products.map((product) => (
          <li
            key={product.slug}
            className="w-[72vw] sm:w-[45vw] md:w-[31vw] lg:w-[24vw]"
          >
            <ProductCard
              product={product}
              sizes="(min-width: 64rem) 24vw, (min-width: 48rem) 31vw, 72vw"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

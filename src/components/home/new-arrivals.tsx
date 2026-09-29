import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { newArrivalsFeature as feature, type Product } from "@/lib/catalog";

export function NewArrivals({ products }: { products: Product[] }) {
  return (
    <section className="pb-section">
      <SectionHeader
        title="New Arrivals"
        meta={`${products.length} pieces`}
        action={{ label: "View all", href: "/new-arrivals" }}
      />
      <ul className="container-bleed grid-products hairline-t">
        <li className="span-feature">
          <Link
            href="/new-arrivals"
            className="group relative block h-full min-h-[28rem] overflow-hidden bg-surface text-on-media"
          >
            <Image
              src={feature.image.src}
              alt={feature.image.alt}
              fill
              sizes="(min-width: 48rem) 66vw, 100vw"
              className="object-cover transition-transform duration-700 ease-luxe group-hover:scale-[1.03]"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/50 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 stack items-center gap-2 p-6 text-center md:p-10">
              <p className="text-body-sm font-medium">{feature.eyebrow}</p>
              <p className="type-title">{feature.title}</p>
              <span className="link text-body-sm font-medium">Shop now</span>
            </div>
          </Link>
        </li>
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}

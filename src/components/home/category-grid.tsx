import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import type { CategoryCover } from "@/lib/products";

/**
 * One tile per category with something on sale, using its newest piece as
 * the cover, so the grid follows the categories managed in /admin.
 */
export function CategoryGrid({ categories }: { categories: CategoryCover[] }) {
  const tiles = categories.filter((c) => c.image !== null);
  if (tiles.length === 0) return null;

  return (
    <section className="pb-section">
      <SectionHeader title="Shop by Category" />
      <ul
        className="container-bleed grid grid-cols-2 gap-px md:grid-cols-3 lg:grid-cols-(--tiles)"
        style={
          {
            "--tiles": `repeat(${Math.min(tiles.length, 5)}, minmax(0, 1fr))`,
          } as React.CSSProperties
        }
      >
        {tiles.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/collections/${category.slug}`}
              className="group relative block aspect-portrait overflow-hidden bg-surface"
            >
              <Image
                src={category.image!.src}
                alt={category.image!.alt}
                fill
                sizes="(min-width: 64rem) 20vw, (min-width: 48rem) 33vw, 50vw"
                className="object-cover transition-transform duration-700 ease-luxe group-hover:scale-[1.03]"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/45 to-transparent"
              />
              <span className="absolute inset-x-0 bottom-0 p-4 type-label text-on-media md:p-6">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

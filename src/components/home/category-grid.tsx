import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { categories } from "@/lib/catalog";

export function CategoryGrid() {
  return (
    <section className="pb-section">
      <SectionHeader title="Shop by Category" />
      <ul className="container-bleed grid grid-cols-2 gap-px md:grid-cols-4">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/collections/${category.slug}`}
              className="group relative block aspect-portrait overflow-hidden bg-surface"
            >
              <Image
                src={category.image.src}
                alt={category.image.alt}
                fill
                sizes="(min-width: 48rem) 25vw, 50vw"
                className="object-cover transition-transform duration-700 ease-luxe group-hover:scale-[1.03]"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/45 to-transparent"
              />
              <span className="absolute inset-x-0 bottom-0 p-4 type-label text-on-media md:p-6">
                {category.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

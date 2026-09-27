import Image from "next/image";
import Link from "next/link";
import { editorialPair } from "@/lib/catalog";

export function EditorialPair() {
  return (
    <section className="container-bleed grid gap-px md:grid-cols-2">
      {editorialPair.map((story) => (
        <Link
          key={story.slug}
          href={`/collections/${story.slug}`}
          className="group relative block aspect-portrait overflow-hidden bg-surface text-on-media"
        >
          <Image
            src={story.image.src}
            alt={story.image.alt}
            fill
            sizes="(min-width: 48rem) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-luxe group-hover:scale-[1.03]"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/50 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 stack items-center gap-2 p-8 text-center md:p-12">
            <p className="text-body-sm font-medium">{story.eyebrow}</p>
            <h2 className="type-title md:text-[1.75rem] md:leading-8">
              {story.title}
            </h2>
            <span className="link text-body-sm font-medium">Discover</span>
          </div>
        </Link>
      ))}
    </section>
  );
}

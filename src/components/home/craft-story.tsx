import Image from "next/image";
import Link from "next/link";
import { craftStory as story } from "@/lib/catalog";

export function CraftStory() {
  return (
    <section className="relative min-h-[40rem] overflow-hidden bg-ink text-on-media md:h-[85svh]">
      <Image
        src={story.image.src}
        alt={story.image.alt}
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-black/60 via-black/15 to-transparent md:bg-linear-to-r"
      />
      <div className="container-page absolute inset-x-0 bottom-0 pb-12 md:inset-y-0 md:flex md:items-center md:pb-0">
        <div className="stack max-w-xl items-start gap-4">
          <p className="type-label">{story.eyebrow}</p>
          <h2 className="type-display">{story.title}</h2>
          <p className="text-body font-light">{story.description}</p>
          <Link
            href={`/stories/${story.slug}`}
            className="btn btn-secondary mt-2"
          >
            Explore the atelier
          </Link>
        </div>
      </div>
    </section>
  );
}

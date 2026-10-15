import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceholderNote } from "@/components/placeholder-note";
import { stories } from "@/lib/catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return stories.map(({ slug }) => ({ slug }));
}

function findStory(slug: string) {
  return stories.find((story) => story.slug === slug);
}

export async function generateMetadata({
  params,
}: PageProps<"/stories/[slug]">): Promise<Metadata> {
  const story = findStory((await params).slug);
  if (!story) return {};
  return { title: story.title, description: story.description };
}

/** Long-form editorial: full-bleed opener, then sections in a reading column. */
export default async function StoryPage({
  params,
}: PageProps<"/stories/[slug]">) {
  const story = findStory((await params).slug);
  if (!story) notFound();

  return (
    <main className="flex-1 pb-section">
      <section className="relative h-[70svh] min-h-[28rem] overflow-hidden bg-ink text-on-media">
        <Image
          src={story.image.src}
          alt={story.image.alt}
          fill
          preload
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/60 to-transparent"
        />
        <div className="container-page absolute inset-x-0 bottom-0 stack max-w-3xl gap-3 pb-12 md:pb-16">
          <p className="type-label">{story.eyebrow}</p>
          <h1 className="type-display">{story.title}</h1>
        </div>
      </section>

      <article className="container-narrow section stack gap-12">
        <p className="type-lead">{story.description}</p>
        <PlaceholderNote />

        {story.sections.map((section) => (
          <section key={section.heading} className="stack gap-4">
            <h2 className="type-label">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-body">
                {paragraph}
              </p>
            ))}
            {section.image && (
              <div className="relative mt-4 aspect-portrait overflow-hidden bg-surface">
                <Image
                  src={section.image.src}
                  alt={section.image.alt}
                  fill
                  sizes="(min-width: 48rem) 45rem, 100vw"
                  className="object-cover"
                />
              </div>
            )}
          </section>
        ))}

        <div className="cluster gap-4 hairline-t pt-8">
          <Link href="/new-arrivals" className="btn btn-primary">
            Shop new arrivals
          </Link>
          <Link href="/about" className="btn btn-outline">
            About Atelier
          </Link>
        </div>
      </article>
    </main>
  );
}

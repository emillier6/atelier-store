import Link from "next/link";
import { PlaceholderNote } from "@/components/placeholder-note";
import type { ContentPage as ContentPageData } from "@/lib/content-pages";

/**
 * An information page: footer group, display title, lead and sections in a
 * reading column. Sections with stand-in copy carry a "Placeholder" tag.
 */
export function ContentPage({ page }: { page: ContentPageData }) {
  const placeholderIntro = page.intro.startsWith("Placeholder");
  const placeholderSections = page.sections.some((s) => s.placeholder);

  return (
    <main className="flex-1 section">
      <article className="container-narrow stack gap-12">
        <header className="stack gap-6">
          <p className="type-label text-muted">{page.group}</p>
          <h1 className="type-display">{page.title}</h1>
          <p className="type-lead">{page.intro}</p>
          {placeholderIntro ? (
            <PlaceholderNote />
          ) : (
            placeholderSections && (
              <PlaceholderNote>
                Sections tagged Placeholder are stand-ins and will be replaced
                before launch; the rest describes how the store works today.
              </PlaceholderNote>
            )
          )}
        </header>

        {page.sections.length > 0 && (
          <div className="stack gap-10">
            {page.sections.map((section) => (
              <section
                key={section.heading}
                className="stack gap-3 hairline-t pt-6"
              >
                <div className="cluster gap-3">
                  <h2 className="type-label">{section.heading}</h2>
                  {section.placeholder && (
                    <span className="badge" data-tone="muted">
                      Placeholder
                    </span>
                  )}
                </div>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-body">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        )}

        {page.cta && (
          <Link href={page.cta.href} className="btn btn-outline self-start">
            {page.cta.label}
          </Link>
        )}
      </article>
    </main>
  );
}

/** Title and description for a content page's metadata. */
export function contentMetadata(page: ContentPageData) {
  return {
    title: page.title,
    description: page.intro.startsWith("Placeholder") ? undefined : page.intro,
  };
}

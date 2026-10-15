import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pieceCount } from "@/components/listing-header";
import { PlaceholderNote } from "@/components/placeholder-note";
import { ProductGrid } from "@/components/product-grid";
import { edits } from "@/lib/catalog";
import { getProductsInCategories } from "@/lib/products";

export const revalidate = 60;
export const dynamicParams = false;

const PIECE_LIMIT = 12;

export function generateStaticParams() {
  return edits.map(({ slug }) => ({ slug }));
}

function findEdit(slug: string) {
  return edits.find((edit) => edit.slug === slug);
}

export async function generateMetadata({
  params,
}: PageProps<"/edits/[slug]">): Promise<Metadata> {
  const edit = findEdit((await params).slug);
  if (!edit) return {};
  return { title: edit.title, description: edit.intro[0] };
}

/** A lookbook: full-bleed image, a short intro, then the pieces. */
export default async function EditPage({ params }: PageProps<"/edits/[slug]">) {
  const edit = findEdit((await params).slug);
  if (!edit) notFound();

  const products = await getProductsInCategories(
    edit.categorySlugs,
    PIECE_LIMIT,
  );

  return (
    <main className="flex-1 pb-section">
      <section className="relative h-[70svh] min-h-[28rem] overflow-hidden bg-ink text-on-media">
        <Image
          src={edit.image.src}
          alt={edit.image.alt}
          fill
          preload
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/55 to-transparent"
        />
        <div className="container-page absolute inset-x-0 bottom-0 stack items-center gap-3 pb-12 text-center md:pb-16">
          <p className="text-body-sm font-medium">{edit.eyebrow}</p>
          <h1 className="type-display">{edit.title}</h1>
        </div>
      </section>

      <div className="container-narrow section stack gap-6">
        {edit.intro.map((paragraph) => (
          <p key={paragraph} className="type-lead">
            {paragraph}
          </p>
        ))}
        <PlaceholderNote />
      </div>

      <div className="container-page flex items-end justify-between gap-4 pb-6 md:pb-8">
        <div className="stack gap-1">
          <h2 className="type-title">The Pieces</h2>
          <p className="type-meta">{pieceCount(products.length)}</p>
        </div>
        <Link href="/new-arrivals" className="link shrink-0 text-body-sm">
          See all new arrivals
        </Link>
      </div>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <div className="container-page stack items-start gap-6 hairline-t pt-8">
          <p className="text-body">
            The pieces for this edit are on their way.
          </p>
          <Link href="/new-arrivals" className="btn btn-outline">
            See what has just arrived
          </Link>
        </div>
      )}
    </main>
  );
}

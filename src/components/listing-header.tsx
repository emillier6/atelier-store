import Link from "next/link";

type ListingHeaderProps = {
  title: string;
  meta: string;
};

/** Breadcrumb and title for a product listing page (Home / {title}). */
export function ListingHeader({ title, meta }: ListingHeaderProps) {
  return (
    <div className="container-page stack gap-6 pt-8 pb-6 md:pt-12 md:pb-8">
      <nav aria-label="Breadcrumb">
        <ol className="cluster gap-2 text-body-sm text-muted">
          <li>
            <Link href="/" className="link-nav">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>

      <div className="stack gap-1">
        <h1 className="type-title">{title}</h1>
        <p className="type-meta">{meta}</p>
      </div>
    </div>
  );
}

export function pieceCount(count: number) {
  return `${count} ${count === 1 ? "piece" : "pieces"}`;
}
